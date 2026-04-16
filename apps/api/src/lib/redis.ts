import { Redis } from 'ioredis'

export const redis = new Redis(process.env.UPSTASH_REDIS_URL!, {
  password: process.env.UPSTASH_REDIS_TOKEN,
  tls: { rejectUnauthorized: false },
  maxRetriesPerRequest: null,
})
