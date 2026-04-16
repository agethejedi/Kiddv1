export type ProjectStatus = 'pending' | 'analyzing' | 'recording' | 'ready' | 'error'
export type ClipStatus = 'pending' | 'recording' | 'scripting' | 'encoding' | 'ready' | 'error'
export type JobType = 'analyze' | 'record' | 'generate-script' | 'encode' | 'stitch'

export interface Project {
  id: string
  url: string
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface Flow {
  id: string
  project_id: string
  title: string
  description: string
  steps: FlowStep[]
  status: ClipStatus
}

export interface FlowStep {
  order: number
  action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait'
  selector?: string
  value?: string
  description: string
  screenshot_url?: string
  click_x?: number
  click_y?: number
}

export interface Clip {
  id: string
  flow_id: string
  project_id: string
  title: string
  duration_seconds?: number
  narration_script?: string
  voice: VoiceOption
  music: MusicOption
  video_url?: string
  thumbnail_url?: string
  status: ClipStatus
  created_at: string
}

export type VoiceOption =
  | 'nova'
  | 'echo'
  | 'shimmer'
  | 'onyx'
  | 'fable'

export type MusicOption =
  | 'soft-ambient'
  | 'corporate-upbeat'
  | 'lofi-focus'
  | 'cinematic-build'
  | 'none'

export interface StitchJob {
  project_id: string
  clip_ids: string[]
  output_title?: string
}

export interface JobPayload {
  type: JobType
  project_id: string
  flow_id?: string
  clip_id?: string
  data?: Record<string, unknown>
}

export interface AgentLogEntry {
  timestamp: string
  level: 'info' | 'ok' | 'warn' | 'error'
  message: string
  project_id: string
}
