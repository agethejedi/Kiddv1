import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { projectsRouter } from './routes/projects'
import { clipsRouter } from './routes/clips'
import { stitchRouter } from './routes/stitch'
import { startWorkers } from './workers'

const app = express()
const PORT = process.env.API_PORT || 3001

app.use(cors({ origin: process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000' }))
app.use(express.json())

// Routes
app.use('/api/projects', projectsRouter)
app.use('/api/clips', clipsRouter)
app.use('/api/stitch', stitchRouter)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Start BullMQ workers
startWorkers()

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`)
})
