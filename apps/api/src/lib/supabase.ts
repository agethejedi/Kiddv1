import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function log(
  project_id: string,
  message: string,
  level: 'info' | 'ok' | 'warn' | 'error' = 'info'
) {
  await supabase.from('agent_logs').insert({
    project_id,
    message,
    level,
    timestamp: new Date().toISOString(),
  })
}
