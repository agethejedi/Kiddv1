import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { analyzeQueue } from '../jobs/queues'

export const projectsRouter = Router()

const CreateProjectSchema = z.object({
  url: z.string().url(),
  flow_description: z.string().optional(),
})

// POST /api/projects — create a new project and kick off site analysis
projectsRouter.post('/', async (req, res) => {
  try {
    const { url, flow_description } = CreateProjectSchema.parse(req.body)

    const { data: project, error } = await supabase
      .from('projects')
      .insert({ url, status: 'pending' })
      .select()
      .single()

    if (error || !project) {
      return res.status(500).json({ error: 'Failed to create project' })
    }

    // Enqueue analysis job
    await analyzeQueue.add('analyze', { project_id: project.id, url, flow_description })

    return res.status(201).json(project)
  } catch (err) {
    return res.status(400).json({ error: String(err) })
  }
})

// GET /api/projects/:id — get project with its flows and clips
projectsRouter.get('/:id', async (req, res) => {
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      flows (
        *,
        clips (*)
      )
    `)
    .eq('id', req.params.id)
    .single()

  if (error || !project) return res.status(404).json({ error: 'Not found' })
  return res.json(project)
})

// GET /api/projects/:id/logs — get agent log entries
projectsRouter.get('/:id/logs', async (req, res) => {
  const { data: logs } = await supabase
    .from('agent_logs')
    .select('*')
    .eq('project_id', req.params.id)
    .order('timestamp', { ascending: true })

  return res.json(logs || [])
})
