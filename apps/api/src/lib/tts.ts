import { writeFile } from 'fs/promises'
import { execSync } from 'child_process'

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

const VOICE_MAP: Record<string, string> = {
  nova: process.env.ELEVENLABS_VOICE_NOVA || '',
  echo: process.env.ELEVENLABS_VOICE_ECHO || '',
  shimmer: process.env.ELEVENLABS_VOICE_SHIMMER || '',
  onyx: process.env.ELEVENLABS_VOICE_ONYX || '',
  fable: process.env.ELEVENLABS_VOICE_FABLE || '',
}

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
  outputPath: string
): Promise<string> {
  const voiceId = VOICE_MAP[voice] || VOICE_MAP['nova']

  if (!voiceId) {
    console.warn('No ElevenLabs voice ID — using silent audio fallback')
    return generateSilentAudio(outputPath)
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
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
      console.warn(`ElevenLabs error ${response.status} — using silent fallback`)
      return generateSilentAudio(outputPath)
    }

    const buffer = await response.arrayBuffer()
    await writeFile(outputPath, Buffer.from(buffer))
    return outputPath

  } catch (err) {
    console.warn('ElevenLabs failed — using silent fallback:', err)
    return generateSilentAudio(outputPath)
  }
}
