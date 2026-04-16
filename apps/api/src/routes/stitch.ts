import { Router } from 'express'
import { z } from 'zod'
import { stitchQueue } from '../jobs/queues'

export const stitchRouter = Router()

const StitchSchema = z.object({
  project_id: z.string().uuid(),
  clip_ids: z.array(z.string().uuid()).min(1),
  output_title: z.string().optional(),
})

// POST /api/stitch — queue a stitch job for selected clips
stitchRouter.post('/', async (req, res) => {
  try {
    const payload = StitchSchema.parse(req.body)

    const job = await stitchQueue.add('stitch', payload)

    return res.status(202).json({
      job_id: job.id,
      message: 'Stitch job queued',
    })
  } catch (err) {
    return res.status(400).json({ error: String(err) })
  }
})

// GET /api/stitch/:jobId — check stitch job status
stitchRouter.get('/:jobId', async (req, res) => {
  const job = await stitchQueue.getJob(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  const state = await job.getState()
  const progress = job.progress

  return res.json({
    job_id: job.id,
    state,
    progress,
    result: job.returnvalue,
  })
})
