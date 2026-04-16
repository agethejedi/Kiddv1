'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import type { Clip, Project } from '@demoagent/shared'

const API = process.env.NEXT_PUBLIC_API_URL

const VOICES = ['nova', 'echo', 'shimmer', 'onyx', 'fable']
const MUSIC = ['soft-ambient', 'corporate-upbeat', 'lofi-focus', 'cinematic-build', 'none']

interface AgentLog { timestamp: string; level: string; message: string }
interface ProjectData extends Project { flows: Array<{ clips: Clip[] }> }

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectData | null>(null)
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [stitching, setStitching] = useState(false)
  const [stitchProgress, setStitchProgress] = useState(0)
  const [finalUrl, setFinalUrl] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  const clips: Clip[] = project?.flows?.flatMap((f) => f.clips) ?? []

  // Poll project + logs while not ready
  useEffect(() => {
    let interval: NodeJS.Timeout
    async function poll() {
      const [projRes, logRes] = await Promise.all([
        fetch(`${API}/api/projects/${id}`),
        fetch(`${API}/api/projects/${id}/logs`),
      ])
      const proj = await projRes.json()
      const logData = await logRes.json()
      setProject(proj)
      setLogs(logData)
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
      if (proj.status === 'ready') clearInterval(interval)
    }
    poll()
    interval = setInterval(poll, 2500)
    return () => clearInterval(interval)
  }, [id])

  async function updateClip(clipId: string, field: string, value: string) {
    await fetch(`${API}/api/clips/${clipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  async function regenScript(clipId: string) {
    await fetch(`${API}/api/clips/${clipId}/regen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction: 'Make it more concise and action-focused' }),
    })
  }

  async function stitch() {
    if (selected.size === 0) return
    setStitching(true)
    setStitchProgress(10)
    const res = await fetch(`${API}/api/stitch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: id, clip_ids: Array.from(selected) }),
    })
    const { job_id } = await res.json()

    // Poll stitch job
    const poll = setInterval(async () => {
      const jr = await fetch(`${API}/api/stitch/${job_id}`)
      const job = await jr.json()
      if (job.state === 'completed') {
        clearInterval(poll)
        setStitchProgress(100)
        setFinalUrl(job.result?.video_url || '')
        setStitching(false)
      } else if (job.state === 'failed') {
        clearInterval(poll)
        setStitching(false)
      } else {
        setStitchProgress((p) => Math.min(p + 12, 88))
      }
    }, 2000)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const statusColor: Record<string, string> = {
    pending: '#aaa', analyzing: '#EF9F27', recording: '#7F77DD',
    scripting: '#378ADD', encoding: '#1D9E75', ready: '#639922', error: '#E24B4A',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e5e5e5', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/" style={{ textDecoration: 'none', fontSize: 16, fontWeight: 500 }}>
          Demo<span style={{ color: '#7F77DD' }}>Agent</span>
        </a>
        <span style={{ color: '#aaa', fontSize: 13 }}>{project?.url}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 10px', borderRadius: 6, background: statusColor[project?.status || 'pending'] + '22', color: statusColor[project?.status || 'pending'] }}>
          {project?.status || 'loading'}
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Agent Log Sidebar */}
        <div style={{ width: 280, background: '#fff', borderRight: '0.5px solid #e5e5e5', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', fontSize: 11, fontWeight: 500, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '0.5px solid #f0f0f0' }}>Agent log</div>
          <div ref={logRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>
            {logs.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#ccc', flexShrink: 0 }}>{new Date(l.timestamp).toTimeString().slice(0, 8)}</span>
                <span style={{ color: l.level === 'ok' ? '#639922' : l.level === 'error' ? '#E24B4A' : '#7F77DD' }}>
                  {l.level === 'ok' ? '✓' : l.level === 'error' ? '✗' : '›'} {l.message}
                </span>
              </div>
            ))}
            {project?.status !== 'ready' && <div style={{ color: '#7F77DD', animation: 'pulse 1.2s infinite' }}>…</div>}
          </div>
        </div>

        {/* Clip Review Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {clips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🎬</div>
              <div style={{ fontSize: 16, color: '#888', marginBottom: 6 }}>Generating clips...</div>
              <div style={{ fontSize: 13 }}>The agent is crawling and recording. This takes about 60–90 seconds.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {clips.map((clip) => (
                <div key={clip.id} style={{
                  background: '#fff', border: selected.has(clip.id) ? '1.5px solid #7F77DD' : '0.5px solid #e5e5e5',
                  borderRadius: 12, overflow: 'hidden',
                }}>
                  {/* Thumbnail */}
                  <div style={{ background: '#f5f5f3', height: 140, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {clip.video_url ? (
                      <video src={clip.video_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                    ) : (
                      <div style={{ width: '80%', height: '75%', background: '#fff', borderRadius: 8, border: '0.5px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 11, color: '#aaa' }}>{clip.status}</span>
                      </div>
                    )}
                    {clip.duration_seconds && (
                      <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 11, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>
                        {Math.floor(clip.duration_seconds / 60)}:{String(clip.duration_seconds % 60).padStart(2, '0')}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '12px 14px' }}>
                    {/* Title + select */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div
                        onClick={() => toggleSelect(clip.id)}
                        style={{ width: 16, height: 16, borderRadius: 4, border: '0.5px solid #ddd', background: selected.has(clip.id) ? '#7F77DD' : '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {selected.has(clip.id) && <span style={{ fontSize: 10, color: '#fff' }}>✓</span>}
                      </div>
                      <input
                        defaultValue={clip.title}
                        onBlur={(e) => updateClip(clip.id, 'title', e.target.value)}
                        style={{ flex: 1, fontSize: 13, fontWeight: 500, border: 'none', outline: 'none', background: 'transparent' }}
                      />
                    </div>

                    {/* Script preview */}
                    {clip.narration_script && (
                      <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {clip.narration_script}
                      </p>
                    )}

                    {/* Voice + Music */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {[['Voice', 'voice', VOICES], ['Music', 'music', MUSIC]].map(([label, field, opts]) => (
                        <div key={field as string} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#aaa', width: 40 }}>{label}</span>
                          <select
                            defaultValue={(clip as Record<string, unknown>)[field as string] as string}
                            onChange={(e) => updateClip(clip.id, field as string, e.target.value)}
                            style={{ flex: 1, fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '0.5px solid #e0e0e0', background: '#f9f9f9' }}
                          >
                            {(opts as string[]).map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, paddingTop: 10, borderTop: '0.5px solid #f0f0f0' }}>
                      {clip.video_url && (
                        <a href={clip.video_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #e0e0e0', textDecoration: 'none', color: '#555' }}>
                          Preview
                        </a>
                      )}
                      <button onClick={() => regenScript(clip.id)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #e0e0e0', background: 'none', cursor: 'pointer', color: '#555' }}>
                        Re-gen script
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stitch Bar */}
      {clips.length > 0 && (
        <div style={{ background: '#fff', borderTop: '0.5px solid #e5e5e5', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {finalUrl ? (
            <a href={finalUrl} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: '#7F77DD', fontWeight: 500 }}>
              Download final video →
            </a>
          ) : stitching ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#7F77DD', width: `${stitchProgress}%`, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: 12, color: '#888' }}>Stitching...</span>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 13, color: '#888', flex: 1 }}><strong style={{ color: '#333' }}>{selected.size}</strong> clip{selected.size !== 1 ? 's' : ''} selected</span>
              <button onClick={() => setSelected(new Set(clips.map((c) => c.id)))} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #e0e0e0', background: '#fff', cursor: 'pointer' }}>
                Select all
              </button>
              <button onClick={stitch} disabled={selected.size === 0} style={{ fontSize: 13, padding: '6px 16px', borderRadius: 8, border: 'none', background: selected.size === 0 ? '#ccc' : '#7F77DD', color: '#fff', cursor: selected.size === 0 ? 'not-allowed' : 'pointer' }}>
                Stitch selected →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
