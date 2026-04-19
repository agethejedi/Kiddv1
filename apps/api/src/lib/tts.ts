import { writeFile } from 'fs/promises'
import { execSync } from 'child_process'

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

async function generateSilentAudio(outputPath: string, durationSeconds = 30): Promise<string> {
  execSync(
    `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t ${durationSeconds} -q:a 9 -acodec libmp3lame "${outputPath}"`,
    { stdio: 'pipe' }
  )
  return outputPath
}

export async function generateAudio(
  script: string,
  voice: string,
  outputPath: string,
  durationSeconds = 30
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY || ''
  const voiceId = process.env.ELEVENLABS_VOICE_NOVA || ''

  // Log what we have for debugging
  console.log(`ElevenLabs: key=${apiKey.slice(0, 8)}... voiceId=${voiceId.slice(0, 8)}...`)

  if (!apiKey || !voiceId) {
    console.warn(`ElevenLabs missing: key=${!!apiKey} voiceId=${!!voiceId} — silent fallback`)
    return generateSilentAudio(outputPath, durationSeconds)
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.warn(`ElevenLabs ${response.status}: ${body.slice(0, 200)} — silent fallback`)
      return generateSilentAudio(outputPath, durationSeconds)
    }

    const buffer = await response.arrayBuffer()
    await writeFile(outputPath, Buffer.from(buffer))
    console.log(`ElevenLabs: audio generated successfully`)
    return outputPath

  } catch (err) {
    console.warn('ElevenLabs failed:', err)
    return generateSilentAudio(outputPath, durationSeconds)
  }
}
