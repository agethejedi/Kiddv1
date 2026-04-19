import { Worker } from 'bullmq'
import { redis } from '../lib/redis'
import { supabase, log } from '../lib/supabase'
import { uploadFile, r2Config } from '../lib/r2'
import { generateAudio } from '../lib/tts'
import Anthropic from '@anthropic-ai/sdk'
import { chromium } from 'playwright-core'
import { encodeQueue, recordQueue, scriptQueue } from '../jobs/queues'
import os from 'os'
import path from 'path'
import { mkdir } from 'fs/promises'
import { execSync } from 'child_process'
import * as fsPromises from 'fs/promises'
import { createReadStream } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30000, maxRetries: 1 })
const MODEL = 'claude-sonnet-4-5'
const BROWSERLESS_WS = process.env.BROWSERLESS_WS_ENDPOINT || 'wss://chrome.browserless.io'
const BROWSERLESS_KEY = process.env.BROWSERLESS_API_KEY || ''

async function getBrowser() {
  return chromium.connectOverCDP(`${BROWSERLESS_WS}?token=${BROWSERLESS_KEY}`)
}

async function analyzeSite(url: string) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    const dom_snapshot = await page.content()
    const nav_links = await page.$$eval('a[href]', (els) => els.map((el) => (el as HTMLAnchorElement).href).filter(Boolean))
    const interactive_elements = await page.$$eval('button, [role="button"], input, select, textarea', (els) =>
      els.map((el) => { const e = el as HTMLElement; return `${e.tagName.toLowerCase()} — "${e.textContent?.trim().slice(0, 60) || ''}"` })
    )
    return { dom_snapshot, nav_links, interactive_elements }
  } finally { await browser.close() }
}

async function recordFlow(url: string, flow: any, outputDir: string) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const click_events: any[] = []
  const startTime = Date.now()
  await page.setViewportSize({ width: 1280, height: 800 })
  const frames: Buffer[] = []
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Page.startScreencast', { format: 'png', quality: 80, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 })
  cdp.on('Page.screencastFrame', async ({ data, sessionId }: any) => {
    frames.push(Buffer.from(data, 'base64'))
    await cdp.send('Page.screencastFrameAck', { sessionId })
  })
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    for (const step of flow.steps || []) {
      if (step.action === 'click' && step.selector) {
        const el = await page.waitForSelector(step.selector, { timeout: 5000 }).catch(() => null)
        if (el) {
          const box = await el.boundingBox()
          if (box) click_events.push({ timestamp_ms: Date.now() - startTime, x: box.x + box.width / 2, y: box.y + box.height / 2, selector: step.selector, description: step.description })
          await el.click()
        }
      } else if (step.action === 'navigate' && step.value) {
        await page.goto(step.value, { waitUntil: 'networkidle' })
      } else if (step.action === 'type' && step.selector && step.value) {
        await page.fill(step.selector, step.value)
      }
      await page.waitForTimeout(800)
    }
    await cdp.send('Page.stopScreencast')
    await fsPromises.mkdir(outputDir, { recursive: true })
    for (let i = 0; i < frames.length; i++) {
      await fsPromises.writeFile(`${outputDir}/frame_${String(i).padStart(5, '0')}.png`, frames[i])
    }
    return { flow_id: flow.id, frames_dir: outputDir, click_events, duration_ms: Date.now() - startTime }
  } finally { await browser.close() }
}

async function detectFlows(url: string, dom_snapshot: string, nav_links: string[], interactive_elements: string[]) {
  const response = await anthropic.messages.create({
    model: MODEL, max_tokens: 4096,
    messages: [{ role: 'user', content: `You are analyzing a web app to identify product demo flows.\nURL: ${url}\nInteractive elements:\n${interactive_elements.slice(0, 30).join('\n')}\nNav links:\n${nav_links.slice(0, 30).join('\n')}\nDOM (truncated):\n${dom_snapshot.slice(0, 2000)}\n\nIdentify 4-6 user flows for demo clips. Return ONLY a JSON array, each item with: title, description, steps (array of {order, action, selector?, value?, description}). No markdown.` }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

async function detectFlowFromDescription(url: string, description: string, dom_snapshot: string, interactive_elements: string[]) {
  const title = description
    .replace(/^how do i /i, '')
    .replace(/^how to /i, '')
    .replace(/^where do i /i, '')
    .replace(/[?]$/, '')
    .trim()
  const capitalised = title.charAt(0).toUpperCase() + title.slice(1)
  return [{
    title: capitalised,
    description: description,
    steps: [
      { order: 1, action: 'navigate', value: url, description: 'Navigate to the website' },
      { order: 2, action: 'wait', value: '2000', description: 'Wait for the page to fully load' },
      { order: 3, action: 'scroll', description: 'Scroll down to explore the page content' },
      { order: 4, action: 'wait', value: '1500', description: 'Review the available options and navigation' },
      { order: 5, action: 'scroll', description: 'Continue scrolling to find relevant information' },
    ]
  }]
}

async function generateScript(flow: any, dom_snapshot: string, click_events: any[]) {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Claude timeout')), 20000)
    )
    const claudePromise = anthropic.messages.create({
      model: MODEL, max_tokens: 500,
      messages: [{ role: 'user', content: `Write a 80-120 word narration script for a product demo video. Flow: "${flow.title}". Steps: ${flow.steps?.map((s: any, i: number) => `${i + 1}. ${s.description}`).join('. ')}. Tone: warm, direct. Return only the narration text.` }],
    })
    const response = await Promise.race([claudePromise, timeoutPromise]) as any
    return response.content[0].type === 'text' ? response.content[0].text : generateFallbackScript(flow)
  } catch (err) {
    console.error('generateScript error:', err)
    return generateFallbackScript(flow)
  }
}

function generateFallbackScript(flow: any): string {
  return `Welcome to this quick demo showing you how to ${flow.title.toLowerCase()}. We start by navigating to the website and exploring the available options. Follow along as we scroll through the page to locate exactly what you need. By the end of this clip, you will know precisely where to find this information and how to access it quickly on your own.`
}

async function regenerateScript(currentScript: string, instruction: string) {
  const response = await anthropic.messages.create({
    model: MODEL, max_tokens: 500,
    messages: [{ role: 'user', content: `Rewrite this demo narration script:\n"${currentScript}"\nInstruction: ${instruction}\nKeep it 80-120 words. Return only the new narration text.` }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export function startWorkers() {
  startAnalyzeWorker()
  startRecordWorker()
  startScriptWorker()
  startEncodeWorker()
  startStitchWorker()
  console.log('All BullMQ workers started')
}

function startAnalyzeWorker() {
  new Worker('analyze', async (job) => {
    const { project_id, url, flow_description } = job.data
    await supabase.from('projects').update({ status: 'analyzing' }).eq('id', project_id)
    let flows: any[]
    if (flow_description) {
      await log(project_id, `User-directed flow: "${flow_description}"`)
      await log(project_id, `Launching browser and navigating to ${url}`)
      const { dom_snapshot, nav_links, interactive_elements } = await analyzeSite(url)
      await log(project_id, `Page loaded — found ${interactive_elements.length} interactive elements`, 'ok')
      await log(project_id, 'Building flow from your description...')
      flows = await detectFlowFromDescription(url, flow_description, dom_snapshot, interactive_elements)
      await log(project_id, `Flow ready: "${flows[0]?.title}"`, 'ok')
    } else {
      await log(project_id, `Launching browser and navigating to ${url}`)
      const { dom_snapshot, nav_links, interactive_elements } = await analyzeSite(url)
      await log(project_id, `Page loaded — found ${interactive_elements.length} interactive elements`, 'ok')
      await log(project_id, 'Identifying demo flows with Claude...')
      flows = await detectFlows(url, dom_snapshot, nav_links, interactive_elements)
      await log(project_id, `Detected ${flows.length} flows`, 'ok')
    }
    for (const flow of flows) {
      const { data: savedFlow } = await supabase
        .from('flows').insert({ ...flow, project_id, status: 'pending' }).select().single()
      if (savedFlow) {
        await recordQueue.add('record', { project_id, flow_id: savedFlow.id, url })
        await log(project_id, `Flow queued for recording: "${flow.title}"`)
      }
    }
    await supabase.from('projects').update({ status: 'recording' }).eq('id', project_id)
  }, { connection: redis })
}

function startRecordWorker() {
  new Worker('record', async (job) => {
    const { project_id, flow_id, url } = job.data
    const { data: flow } = await supabase.from('flows').select('*').eq('id', flow_id).single()
    if (!flow) throw new Error(`Flow ${flow_id} not found`)

    await supabase.from('flows').update({ status: 'recording' }).eq('id', flow_id)
    await log(project_id, `Recording flow: "${flow.title}"`)

    // ── Step 1: Record browser session (frames stay in memory for this job) ──
    const tmpBase = path.join(os.tmpdir(), 'demoagent', flow_id)
    const framesDir = path.join(tmpBase, 'frames')
    await mkdir(framesDir, { recursive: true })

    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.setViewportSize({ width: 1280, height: 800 })
    const frames: Buffer[] = []
    const click_events: any[] = []
    const startTime = Date.now()

    // Helper: take N screenshots with delay between each
    async function captureFrames(count: number, delayMs: number) {
      for (let i = 0; i < count; i++) {
        try {
          const buf = await page.screenshot({ type: 'png' })
          frames.push(buf)
        } catch { /* ignore */ }
        if (i < count - 1) await page.waitForTimeout(delayMs)
      }
    }

    try {
      for (const step of flow.steps || []) {
        if (step.action === 'navigate' && step.value) {
          await page.goto(step.value, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {})
          // Capture 10 frames over 5 seconds on landing page
          await captureFrames(10, 500)
        } else if (step.action === 'click' && step.selector) {
          const el = await page.waitForSelector(step.selector, { timeout: 5000 }).catch(() => null)
          if (el) {
            const box = await el.boundingBox()
            if (box) click_events.push({ timestamp_ms: Date.now() - startTime, x: box.x + box.width / 2, y: box.y + box.height / 2 })
            await el.click().catch(() => {})
            // Capture 6 frames over 3 seconds after click
            await captureFrames(6, 500)
          }
        } else if (step.action === 'scroll') {
          // Scroll and capture simultaneously — 10 scroll+capture cycles
          for (let i = 0; i < 10; i++) {
            await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'smooth' }))
            await captureFrames(3, 300) // 3 frames per scroll step
          }
        } else if (step.action === 'wait') {
          await captureFrames(4, 500)
        }
      }

      // Extended scroll exploration — this is the bulk of the video
      // Scroll down capturing as we go
      for (let i = 0; i < 12; i++) {
        await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'smooth' }))
        await captureFrames(3, 300)
      }
      // Pause at bottom
      await captureFrames(8, 400)
      // Scroll back up
      for (let i = 0; i < 8; i++) {
        await page.evaluate(() => window.scrollBy({ top: -150, behavior: 'smooth' }))
        await captureFrames(3, 300)
      }
      // Final pause at top
      await captureFrames(6, 400)

    } finally {
      await browser.close()
    }

    await log(project_id, `Recording complete — ${frames.length} frames, ${click_events.length} clicks`, 'ok')

    // Write frames to disk immediately (still in same job)
    for (let i = 0; i < frames.length; i++) {
      await fsPromises.writeFile(`${framesDir}/frame_${String(i).padStart(5, '0')}.png`, frames[i])
    }

    const duration_ms = Date.now() - startTime
    await supabase.from('flows').update({ click_events, frames_dir: framesDir, duration_ms }).eq('id', flow_id)

    // ── Step 2: Generate script (same job) ──
    await log(project_id, `Generating narration script for: "${flow.title}"`)
    const script = await generateScript(flow, '', click_events)
    const { data: clipRecord } = await supabase.from('clips').insert({
      flow_id, project_id, title: flow.title, narration_script: script,
      voice: 'nova', music: 'soft-ambient', status: 'pending',
    }).select().single()
    const clip_id = clipRecord?.id
    if (!clip_id) throw new Error('Failed to create clip record')

    // ── Step 3: Generate audio (same job) ──
    await log(project_id, `Script ready — generating audio`, 'ok')
    const audioPath = path.join(tmpBase, 'narration.mp3')
    try {
      await generateAudio(script, 'nova', audioPath)
      await log(project_id, `Audio generated successfully`)
    } catch {
      execSync(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t ${Math.ceil(duration_ms/1000)} -q:a 9 -acodec libmp3lame "${audioPath}"`, { stdio: 'pipe' })
      await log(project_id, `Using silent audio fallback`)
    }
    const audioKey = `audio/${flow_id}/narration.mp3`
    const audioUrl = await uploadFile(audioKey, audioPath, 'audio/mpeg')
    await supabase.from('clips').update({ audio_url: audioUrl }).eq('id', clip_id)

    // ── Step 4: Encode video (same job — frames still on disk) ──
    await log(project_id, `Encoding clip: "${flow.title}"`)
    await supabase.from('clips').update({ status: 'encoding' }).eq('id', clip_id)

    const rawVideo = path.join(tmpBase, 'raw.mp4')
    const finalVideo = path.join(tmpBase, 'final.mp4')
    const audioFile = audioPath

    if (frames.length > 0) {
      execSync(
        `ffmpeg -y -framerate 15 -i "${framesDir}/frame_%05d.png" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -preset fast "${rawVideo}"`,
        { stdio: 'pipe' }
      )
    } else {
      execSync(
        `ffmpeg -y -f lavfi -i color=c=0x0a0a0f:size=1280x800:rate=15 -t 30 -c:v libx264 -pix_fmt yuv420p -preset fast "${rawVideo}"`,
        { stdio: 'pipe' }
      )
    }

    // Click circle overlays
    const clickFilters = click_events.map((e: any) => {
      const t = (e.timestamp_ms / 1000).toFixed(2)
      const end = (parseFloat(t) + 0.8).toFixed(2)
      return `drawcircle=x=${Math.round(e.x)}:y=${Math.round(e.y)}:r=28:color=0xFF5722@0.85:enable='between(t,${t},${end})'`
    })
    const safeTitle = flow.title.replace(/['"\:]/g, ' ').trim()
    const titleFilter = `drawtext=text='${safeTitle}':fontsize=26:fontcolor=white:x=40:y=h-72:box=1:boxcolor=black@0.6:boxborderw=10:enable='between(t,0,4)'`
    const vf = [...clickFilters, titleFilter].filter(Boolean).join(',') || titleFilter

    execSync(
      `ffmpeg -y -i "${rawVideo}" -i "${audioFile}" -vf "${vf},scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -profile:v baseline -level 3.0 -c:a aac -ar 44100 -shortest -preset fast -pix_fmt yuv420p -movflags +faststart "${finalVideo}"`,
      { stdio: 'pipe' }
    )

    // Upload final video to R2
    const r2 = new S3Client({
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
      region: 'auto',
    })
    const outputKey = `clips/${clip_id}/clip.mp4`
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!, Key: outputKey,
      Body: createReadStream(finalVideo), ContentType: 'video/mp4',
    }))
    const videoUrl = `${process.env.R2_PUBLIC_URL}/${outputKey}`

    await supabase.from('clips').update({
      video_url: videoUrl, status: 'ready',
      duration_seconds: Math.round(duration_ms / 1000),
    }).eq('id', clip_id)

    await log(project_id, `Clip ready: "${flow.title}"`, 'ok')

    // Cleanup
    await fsPromises.rm(tmpBase, { recursive: true, force: true }).catch(() => {})

    const { data: allClips } = await supabase.from('clips').select('status').eq('project_id', project_id)
    if (allClips?.every((c) => c.status === 'ready')) {
      await supabase.from('projects').update({ status: 'ready' }).eq('id', project_id)
      await log(project_id, 'All clips ready for review', 'ok')
    }

  }, { connection: redis, concurrency: 1 })
}

function startScriptWorker() {
  // Script worker kept for regen use cases only
  new Worker('script', async (job) => {
    const { project_id, flow_id, clip_id, instruction } = job.data
    if (!instruction || !clip_id) return
    const { data: flow } = await supabase.from('flows').select('*').eq('id', flow_id).single()
    if (!flow) throw new Error(`Flow ${flow_id} not found`)
    const { data: clip } = await supabase.from('clips').select('*').eq('id', clip_id).single()
    await log(project_id, `Regenerating script for: "${flow.title}"`)
    const script = await regenerateScript(clip.narration_script, instruction)
    await supabase.from('clips').update({ narration_script: script }).eq('id', clip_id)
    await log(project_id, `Script updated`, 'ok')
  }, { connection: redis })
}

function startEncodeWorker() {
  new Worker('encode', async (job) => {
    const { project_id, flow_id, clip_id } = job.data
    const { data: clip } = await supabase.from('clips').select('*').eq('id', clip_id).single()
    const { data: flow } = await supabase.from('flows').select('*').eq('id', flow_id).single()
    if (!clip || !flow) throw new Error('Clip or flow not found')
    await supabase.from('clips').update({ status: 'encoding' }).eq('id', clip_id)
    await log(project_id, `Encoding clip: "${clip.title}"`)

    const tmpDir = `/tmp/demoagent/${clip_id}`
    await fsPromises.mkdir(tmpDir, { recursive: true })
    const rawVideo = `${tmpDir}/raw.mp4`
    const finalVideo = `${tmpDir}/final.mp4`
    const audioFile = `${tmpDir}/narration.mp3`

    const audioRes = await fetch(clip.audio_url)
    const audioBuffer = await audioRes.arrayBuffer()
    await fsPromises.writeFile(audioFile, Buffer.from(audioBuffer))

    // Use screenshot from R2 if available, otherwise title card
    const screenshotUrl = flow.frames_dir && flow.frames_dir.startsWith('http') ? flow.frames_dir : ''
    const screenshotPath = `${tmpDir}/screenshot.png`

    if (screenshotUrl) {
      await log(project_id, `Using page screenshot for video`)
      const imgRes = await fetch(screenshotUrl)
      const imgBuffer = await imgRes.arrayBuffer()
      await fsPromises.writeFile(screenshotPath, Buffer.from(imgBuffer))
      execSync(
        `ffmpeg -y -loop 1 -i "${screenshotPath}" -t 30 -c:v libx264 -pix_fmt yuv420p -preset fast -vf "scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2" "${rawVideo}"`,
        { stdio: 'pipe' }
      )
    } else {
      await log(project_id, `No screenshot — using title card`)
      execSync(
        `ffmpeg -y -f lavfi -i color=c=0x0a0a0f:size=1280x800:rate=30 -t 30 -c:v libx264 -pix_fmt yuv420p -preset fast "${rawVideo}"`,
        { stdio: 'pipe' }
      )
    }

    const safeTitle = clip.title.replace(/['":]/g, ' ')
    const titleFilter = `drawtext=text='${safeTitle}':fontsize=28:fontcolor=white:x=48:y=h-80:box=1:boxcolor=black@0.55:boxborderw=10`
    const allFilters = titleFilter

    execSync(
      `ffmpeg -y -i "${rawVideo}" -i "${audioFile}" -vf "${allFilters}" -c:v libx264 -c:a aac -shortest -preset fast -pix_fmt yuv420p -movflags +faststart "${finalVideo}"`,
      { stdio: 'pipe' }
    )

    const r2 = new S3Client({
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
      region: 'auto',
    })
    const outputKey = `clips/${clip_id}/clip.mp4`
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!, Key: outputKey,
      Body: createReadStream(finalVideo), ContentType: 'video/mp4',
    }))

    const videoUrl = `${process.env.R2_PUBLIC_URL}/${outputKey}`
    await supabase.from('clips').update({
      video_url: videoUrl, status: 'ready',
      duration_seconds: Math.round((flow.duration_ms || 30000) / 1000),
    }).eq('id', clip_id)
    await log(project_id, `Clip ready: "${clip.title}"`, 'ok')
    await fsPromises.rm(tmpDir, { recursive: true, force: true })

    const { data: allClips } = await supabase.from('clips').select('status').eq('project_id', project_id)
    const allReady = allClips?.every((c) => c.status === 'ready')
    if (allReady) {
      await supabase.from('projects').update({ status: 'ready' }).eq('id', project_id)
      await log(project_id, 'All clips ready for review', 'ok')
    }
  }, { connection: redis, concurrency: 1 })
}

function startStitchWorker() {
  new Worker('stitch', async (job) => {
    const { project_id, clip_ids, output_title } = job.data
    await log(project_id, `Stitching ${clip_ids.length} clips together...`)
    const { data: clips } = await supabase.from('clips').select('video_url, title').in('id', clip_ids)
    if (!clips || clips.some((c) => !c.video_url)) throw new Error('Some clips are missing video URLs')
    const outputKey = `final/${project_id}/${Date.now()}_final.mp4`
    const modalResponse = await fetch(
      `https://api.modal.com/v1/functions/demoagent-encoder/stitch_clips/call`,
      {
        method: 'POST',
        headers: { Authorization: `Token ${process.env.MODAL_TOKEN_ID}:${process.env.MODAL_TOKEN_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_urls: clips.map((c) => c.video_url), output_key: outputKey, r2_config: r2Config() }),
      }
    )
    if (!modalResponse.ok) throw new Error(`Modal stitch failed: ${modalResponse.statusText}`)
    const stitchResult = await modalResponse.json()
    const finalUrl = stitchResult.result as string
    await supabase.from('final_videos').insert({ project_id, video_url: finalUrl, title: output_title || 'Product Demo', clip_count: clip_ids.length })
    await log(project_id, 'Final video ready for download', 'ok')
    return { video_url: finalUrl }
  }, { connection: redis })
}
