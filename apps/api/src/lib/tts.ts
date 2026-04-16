import { writeFile } from 'fs/promises'

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

const VOICE_MAP: Record<string, string> = {
  nova: process.env.ELEVENLABS_VOICE_NOVA || '',
  echo: process.env.ELEVENLABS_VOICE_ECHO || '',
  shimmer: process.env.ELEVENLABS_VOICE_SHIMMER || '',
  onyx: process.env.ELEVENLABS_VOICE_ONYX || '',
  fable: process.env.ELEVENLABS_VOICE_FABLE || '',
}

export async function generateAudio(
  script: string,
  voice: string,
  outputPath: string
): Promise<string> {
  const voiceId = VOICE_MAP[voice] || VOICE_MAP['nova']

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
  })

  if (!response.ok) {
    throw new Error(`ElevenLabs error: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  await writeFile(outputPath, Buffer.from(buffer))
  return outputPath
}
