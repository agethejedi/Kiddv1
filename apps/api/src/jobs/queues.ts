import { Queue } from 'bullmq'
import { redis } from '../lib/redis'

export const analyzeQueue = new Queue('analyze', { connection: redis })
export const recordQueue = new Queue('record', { connection: redis })
export const scriptQueue = new Queue('script', { connection: redis })
export const encodeQueue = new Queue('encode', { connection: redis })
export const stitchQueue = new Queue('stitch', { connection: redis })
