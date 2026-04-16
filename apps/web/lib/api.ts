const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Projects
  createProject: (url: string) =>
    request<{ id: string; url: string; status: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  getProject: (id: string) =>
    request<{
      id: string
      url: string
      status: string
      flows: Array<{
        id: string
        title: string
        status: string
        clips: Array<{
          id: string
          title: string
          status: string
          duration_seconds: number
          narration_script: string
          voice: string
          music: string
          video_url: string
          thumbnail_url: string
        }>
      }>
    }>(`/api/projects/${id}`),

  getLogs: (id: string) =>
    request<Array<{ timestamp: string; level: string; message: string }>>(
      `/api/projects/${id}/logs`
    ),

  // Clips
  updateClip: (id: string, updates: { title?: string; voice?: string; music?: string }) =>
    request(`/api/clips/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  regenScript: (id: string, instruction?: string) =>
    request(`/api/clips/${id}/regen`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    }),

  // Stitch
  stitchClips: (project_id: string, clip_ids: string[]) =>
    request<{ job_id: string }>('/api/stitch', {
      method: 'POST',
      body: JSON.stringify({ project_id, clip_ids }),
    }),

  getStitchJob: (jobId: string) =>
    request<{ job_id: string; state: string; progress: number; result?: string }>(
      `/api/stitch/${jobId}`
    ),
}
