import { Worker } from 'bullmq'
import { redis } from '../lib/redis'
import { supabase, log } from '../lib/supabase'
import { uploadFile, r2Config } from '../lib/r2'
import { generateAudio } from '../lib/tts'
import { analyzeSite, recordFlow } from '@demoagent/recorder'
import { detectFlows, generateScript, regenerateScript } from '@demoagent/ai'
import { encodeQueue, recordQueue, scriptQueue } from '../jobs/queues'
import os from 'os'
import path from 'path'
import { mkdir } from 'fs/promises'

export function startWorkers() {
  startAnalyzeWorker()
  startRecordWorker()
  startScriptWorker()
  startEncodeWorker()
  startStitchWorker()
  console.log('All BullMQ workers started')
}

// ── Analyze Worker ─────────────────────────────────────────────────────────────
// Crawls the site, detects flows, saves them to DB, queues recording jobs
function startAnalyzeWorker() {
  new Worker('analyze', async (job) => {
    const { project_id, url } = job.data

    await supabase.from('projects').update({ status: 'analyzing' }).eq('id', project_id)
    await log(project_id, `Launching browser and navigating to ${url}`)

    const { dom_snapshot, nav_links, interactive_elements } = await analyzeSite(url)
    await log(project_id, `Page loaded — found ${interactive_elements.length} interactive elements`, 'ok')

    await log(project_id, 'Identifying demo flows with Claude...')
    const flows = await detectFlows(url, dom_snapshot, nav_links, interactive_elements)
    await log(project_id, `Detected ${flows.length} flows`, 'ok')

    // Save flows to DB
    for (const flow of flows) {
      const { data: savedFlow } = await supabase
        .from('flows')
        .insert({ ...flow, project_id, status: 'pending' })
        .select()
        .single()

      if (savedFlow) {
        // Queue a recording job per flow
        await recordQueue.add('record', { project_id, flow_id: savedFlow.id, url })
        await log(project_id, `Flow queued for recording: "${flow.title}"`)
      }
    }

    await supabase.from('projects').update({ status: 'recording' }).eq('id', project_id)
  }, { connection: redis })
}

// ── Record Worker ──────────────────────────────────────────────────────────────
// Runs Playwright via Browserless, captures frames and click events
function startRecordWorker() {
  new Worker('record', async (job) => {
    const { project_id, flow_id, url } = job.data

    const { data: flow } = await supabase.from('flows').select('*').eq('id', flow_id).single()
    if (!flow) throw new Error(`Flow ${flow_id} not found`)

    await supabase.from('flows').update({ status: 'recording' }).eq('id', flow_id)
    await log(project_id, `Recording flow: "${flow.title}"`)

    const outputDir = path.join(os.tmpdir(), 'demoagent', flow_id, 'frames')
    await mkdir(outputDir, { recursive: true })

    const recording = await recordFlow(url, flow, outputDir)
    await log(project_id, `Recording complete — ${recording.click_events.length} click events captured`, 'ok')

    // Save click events alongside flow
    await supabase.from('flows').update({
      click_events: recording.click_events,
      frames_dir: outputDir,
      duration_ms: recording.duration_ms,
    }).eq('id', flow_id)

    // Queue script generation
    await scriptQueue.add('generate-script', { project_id, flow_id })
  }, { connection: redis, concurrency: 3 })
}

// ── Script Worker ──────────────────────────────────────────────────────────────
// Claude generates narration, ElevenLabs renders audio, queues encoding
function startScriptWorker() {
  new Worker('script', async (job) => {
    const { project_id, flow_id, clip_id, instruction } = job.data

    const { data: flow } = await supabase
      .from('flows')
      .select('*, clips(*)')
      .eq('id', flow_id)
      .single()

    if (!flow) throw new Error(`Flow ${flow_id} not found`)

    let script: string
    let targetClipId = clip_id

    if (instruction && clip_id) {
      // Regen path
      const { data: clip } = await supabase.from('clips').select('*').eq('id', clip_id).single()
      await log(project_id, `Regenerating script for: "${flow.title}"`)
      script = await regenerateScript(clip.narration_script, instruction)
    } else {
      // First generation
      await log(project_id, `Generating narration script for: "${flow.title}"`)
      script = await generateScript(flow, flow.dom_snapshot || '', flow.click_events || [])

      // Create clip record
      const { data: clip } = await supabase.from('clips').insert({
        flow_id,
        project_id,
        title: flow.title,
        narration_script: script,
        voice: 'nova',
        music: 'soft-ambient',
        status: 'pending',
      }).select().single()

      targetClipId = clip?.id
    }

    await log(project_id, `Script ready — generating audio`, 'ok')

    // Generate TTS audio
    const { data: clip } = await supabase.from('clips').select('voice').eq('id', targetClipId).single()
    const audioPath = path.join(os.tmpdir(), 'demoagent', flow_id, 'narration.mp3')
    await mkdir(path.dirname(audioPath), { recursive: true })
    await generateAudio(script, clip?.voice || 'nova', audioPath)

    // Upload audio to R2
    const audioKey = `audio/${flow_id}/narration.mp3`
    const audioUrl = await uploadFile(audioKey, audioPath, 'audio/mpeg')

    await supabase.from('clips').update({
      narration_script: script,
      audio_url: audioUrl,
      status: 'pending',
    }).eq('id', targetClipId)

    // Queue encoding
    await encodeQueue.add('encode', { project_id, flow_id, clip_id: targetClipId })
  }, { connection: redis })
}

// ── Encode Worker ──────────────────────────────────────────────────────────────
// Calls Modal to run ffmpeg, saves final clip URL
function startEncodeWorker() {
  new Worker('encode', async (job) => {
    const { project_id, flow_id, clip_id } = job.data

    const { data: clip } = await supabase.from('clips').select('*').eq('id', clip_id).single()
    const { data: flow } = await supabase.from('flows').select('*').eq('id', flow_id).single()

    if (!clip || !flow) throw new Error('Clip or flow not found')

    await supabase.from('clips').update({ status: 'encoding' }).eq('id', clip_id)
    await log(project_id, `Encoding clip: "${clip.title}"`)

    // Call Modal encode function via HTTP
    const modalResponse = await fetch(
      `https://api.modal.com/v1/functions/demoagent-encoder/encode_clip/call`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${process.env.MODAL_TOKEN_ID}:${process.env.MODAL_TOKEN_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          frames_dir: flow.frames_dir,
          audio_url: clip.audio_url,
          click_events: flow.click_events || [],
          title: clip.title,
          duration_seconds: (flow.duration_ms || 30000) / 1000,
          output_key: `clips/${clip_id}/clip.mp4`,
          r2_config: r2Config(),
        }),
      }
    )

    if (!modalResponse.ok) throw new Error(`Modal encode failed: ${modalResponse.statusText}`)

    const { result: videoUrl } = await modalResponse.json()

    await supabase.from('clips').update({
      video_url: videoUrl,
      status: 'ready',
      duration_seconds: Math.round((flow.duration_ms || 30000) / 1000),
    }).eq('id', clip_id)

    await log(project_id, `Clip ready: "${clip.title}"`, 'ok')

    // Check if all clips for this project are ready
    const { data: allClips } = await supabase
      .from('clips')
      .select('status')
      .eq('project_id', project_id)

    const allReady = allClips?.every((c) => c.status === 'ready')
    if (allReady) {
      await supabase.from('projects').update({ status: 'ready' }).eq('id', project_id)
      await log(project_id, 'All clips ready for review', 'ok')
    }
  }, { connection: redis, concurrency: 2 })
}

// ── Stitch Worker ──────────────────────────────────────────────────────────────
// Concatenates selected clips into a final video via Modal
function startStitchWorker() {
  new Worker('stitch', async (job) => {
    const { project_id, clip_ids, output_title } = job.data

    await log(project_id, `Stitching ${clip_ids.length} clips together...`)

    const { data: clips } = await supabase
      .from('clips')
      .select('video_url, title')
      .in('id', clip_ids)

    if (!clips || clips.some((c) => !c.video_url)) {
      throw new Error('Some clips are missing video URLs')
    }

    const outputKey = `final/${project_id}/${Date.now()}_final.mp4`

    const modalResponse = await fetch(
      `https://api.modal.com/v1/functions/demoagent-encoder/stitch_clips/call`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${process.env.MODAL_TOKEN_ID}:${process.env.MODAL_TOKEN_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clip_urls: clips.map((c) => c.video_url),
          output_key: outputKey,
          r2_config: r2Config(),
        }),
      }
    )

    if (!modalResponse.ok) throw new Error(`Modal stitch failed: ${modalResponse.statusText}`)

    const { result: finalUrl } = await modalResponse.json()

    await supabase.from('final_videos').insert({
      project_id,
      video_url: finalUrl,
      title: output_title || 'Product Demo',
      clip_count: clip_ids.length,
    })

    await log(project_id, 'Final video ready for download', 'ok')

    return { video_url: finalUrl }
  }, { connection: redis })
}
