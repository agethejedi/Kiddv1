import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { scriptQueue } from '../jobs/queues'

export const clipsRouter = Router()

const UpdateClipSchema = z.object({
  title: z.string().optional(),
  voice: z.string().optional(),
  music: z.string().optional(),
})

// PATCH /api/clips/:id — update title, voice, or music
clipsRouter.patch('/:id', async (req, res) => {
  try {
    const updates = UpdateClipSchema.parse(req.body)

    const { data, error } = await supabase
      .from('clips')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) return res.status(500).json({ error })
    return res.json(data)
  } catch (err) {
    return res.status(400).json({ error: String(err) })
  }
})

// POST /api/clips/:id/regen — regenerate narration script
clipsRouter.post('/:id/regen', async (req, res) => {
  const { instruction } = req.body as { instruction?: string }

  const { data: clip } = await supabase
    .from('clips')
    .select('*')
    .eq('id', req.params.id)
    .single()

  if (!clip) return res.status(404).json({ error: 'Clip not found' })

  await supabase
    .from('clips')
    .update({ status: 'scripting' })
    .eq('id', req.params.id)

  await scriptQueue.add('regen-script', {
    clip_id: req.params.id,
    flow_id: clip.flow_id,
    instruction: instruction || 'Make it more concise and action-focused',
  })

  return res.json({ queued: true })
})
