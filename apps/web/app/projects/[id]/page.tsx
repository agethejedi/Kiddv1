'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { api } from '../../../lib/api'

type ClipStatus = 'pending' | 'recording' | 'scripting' | 'encoding' | 'ready' | 'error'
interface Clip { id: string; title: string; status: ClipStatus; duration_seconds?: number; narration_script?: string; voice: string; music: string; video_url?: string }
interface Flow { id: string; title: string; status: string; clips: Clip[] }
interface Project { id: string; url: string; status: string; flows: Flow[] }
interface LogEntry { timestamp: string; level: string; message: string }

const VOICES = ['nova', 'echo', 'shimmer', 'onyx', 'fable']
const MUSIC = ['soft-ambient', 'corporate-upbeat', 'lofi-focus', 'cinematic-build', 'none']
const STATUS_LABEL: Record<ClipStatus, string> = { pending: 'Queued', recording: 'Recording…', scripting: 'Writing script…', encoding: 'Encoding…', ready: 'Ready', error: 'Error' }

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [stitchJobId, setStitchJobId] = useState<string | null>(null)
  const [stitchState, setStitchState] = useState('')
  const [stitchResult, setStitchResult] = useState('')
  const [loading, setLoading] = useState(true)

  const loadProject = useCallback(async () => {
    try { const data = await api.getProject(projectId); setProject(data); setLoading(false) }
    catch { setLoading(false) }
  }, [projectId])

  const loadLogs = useCallback(async () => {
    const data = await api.getLogs(projectId); setLogs(data)
  }, [projectId])

  useEffect(() => {
    loadProject(); loadLogs()
    const ch = supabase.channel(`project-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, () => loadProject())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flows', filter: `project_id=eq.${projectId}` }, () => loadProject())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clips' }, () => loadProject())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs', filter: `project_id=eq.${projectId}` },
        (p: any) => setLogs((prev) => [...prev, p.new as LogEntry]))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId, loadProject, loadLogs])

  useEffect(() => {
    if (!stitchJobId || stitchState === 'completed' || stitchState === 'failed') return
    const interval = setInterval(async () => {
      const job = await api.getStitchJob(stitchJobId)
      setStitchState(job.state)
      if (job.result) setStitchResult(job.result)
    }, 2000)
    return () => clearInterval(interval)
  }, [stitchJobId, stitchState])

  function toggleSelect(clipId: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(clipId) ? n.delete(clipId) : n.add(clipId); return n })
  }

  async function handleStitch() {
    if (selected.size === 0) return
    const job = await api.stitchClips(projectId, Array.from(selected))
    setStitchJobId(job.job_id); setStitchState('waiting')
  }

  if (loading) return <div style={s.loading}>Loading project…</div>
  if (!project) return <div style={s.loading}>Project not found.</div>

  const allClips = project.flows.flatMap((f) => f.clips)
  const readyClips = allClips.filter((c) => c.status === 'ready')

  return (
    <div style={s.app}>
      <nav style={s.nav}>
        <a href="/" style={s.logo}>Demo<span style={{ color: '#c8a96e' }}>Agent</span></a>
        <span style={s.navUrl}>{project.url}</span>
        <span style={{ ...s.pill, background: project.status === 'ready' ? 'rgba(99,153,34,0.15)' : 'rgba(200,169,110,0.12)', color: project.status === 'ready' ? '#639922' : '#c8a96e' }}>{project.status}</span>
      </nav>

      <div style={s.body}>
        <aside style={s.sidebar}>
          <div style={s.sideTitle}>Flows</div>
          {project.flows.map((f) => (
            <div key={f.id} style={s.flowItem}>
              <div style={s.flowName}>{f.title}</div>
              <div style={s.flowSub}>{f.clips.length} clips</div>
            </div>
          ))}
          <div style={{ marginTop: 28, borderTop: '0.5px solid rgba(200,169,110,0.1)', paddingTop: 16 }}>
            <div style={s.sideTitle}>Agent log</div>
            <div style={s.logBox}>
              {logs.slice(-20).map((l, i) => (
                <div key={i} style={s.logLine}>
                  <span style={s.logTime}>{new Date(l.timestamp).toTimeString().slice(0,8)}</span>
                  <span style={{ color: l.level === 'ok' ? '#639922' : l.level === 'error' ? '#E24B4A' : '#c8a96e', fontSize: 11 }}>
                    {l.level === 'ok' ? '✓' : '›'} {l.message}
                  </span>
                </div>
              ))}
              {logs.length === 0 && <div style={{ color: '#6b6880', fontSize: 11 }}>Waiting for agent…</div>}
            </div>
          </div>
        </aside>

        <main style={s.main}>
          <div style={s.header}>
            <div>
              <span style={s.clipsTitle}>Clips</span>
              <span style={s.clipsCount}>{readyClips.length} of {allClips.length} ready</span>
            </div>
            {selected.size > 0 && <button onClick={handleStitch} style={s.stitchBtn}>Stitch {selected.size} clips →</button>}
          </div>

          {stitchJobId && (
            <div style={s.stitchBar}>
              {stitchResult
                ? <a href={stitchResult} target="_blank" rel="noopener noreferrer" style={{ color: '#c8a96e', fontFamily: "'DM Mono',monospace", fontSize: 13 }}>Download final video →</a>
                : <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: '#c8a96e' }}>Stitching… {stitchState}</span>}
            </div>
          )}

          <div style={s.grid}>
            {allClips.map((clip) => (
              <div key={clip.id} style={{ ...s.card, borderColor: selected.has(clip.id) ? '#c8a96e' : 'rgba(200,169,110,0.1)', borderWidth: selected.has(clip.id) ? '1.5px' : '0.5px' }}>
                <div style={s.thumb} onClick={() => clip.status === 'ready' && toggleSelect(clip.id)}>
                  {clip.video_url
                    ? <video src={clip.video_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={s.thumbPh}><div style={s.bar} /><div style={{ ...s.bar, width: '70%', background: 'rgba(200,169,110,0.25)' }} /><div style={{ ...s.bar, width: '50%' }} /></div>}
                  <div style={s.thumbStatus}>{STATUS_LABEL[clip.status]}</div>
                  {clip.duration_seconds && <div style={s.thumbDur}>{Math.round(clip.duration_seconds)}s</div>}
                  {clip.status === 'ready' && <div style={{ ...s.dot, background: selected.has(clip.id) ? '#c8a96e' : 'transparent', borderColor: selected.has(clip.id) ? '#c8a96e' : 'rgba(200,169,110,0.4)' }} />}
                </div>
                <div style={s.cardBody}>
                  <input defaultValue={clip.title} style={s.titleInput} onBlur={(e) => api.updateClip(clip.id, { title: e.target.value })} />
                  {clip.narration_script && <p style={s.script}>{clip.narration_script.slice(0, 100)}…</p>}
                  <div style={s.controls}>
                    <div style={s.ctrlRow}>
                      <span style={s.ctrlLbl}>Voice</span>
                      <select defaultValue={clip.voice} onChange={(e) => api.updateClip(clip.id, { voice: e.target.value })} style={s.select}>
                        {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div style={s.ctrlRow}>
                      <span style={s.ctrlLbl}>Music</span>
                      <select defaultValue={clip.music} onChange={(e) => api.updateClip(clip.id, { music: e.target.value })} style={s.select}>
                        {MUSIC.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={s.footer}>
                    {clip.video_url && <a href={clip.video_url} target="_blank" rel="noopener noreferrer" style={s.footBtn}>Preview</a>}
                    <button onClick={() => api.regenScript(clip.id)} style={s.footBtn}>Re-gen script</button>
                  </div>
                </div>
              </div>
            ))}
            {allClips.length === 0 && <div style={s.empty}><div style={{ fontSize: 28, marginBottom: 12 }}>🎬</div><div style={{ color: '#f5f2ec', marginBottom: 6 }}>Agent is working…</div><div style={{ color: '#6b6880', fontSize: 13 }}>Clips will appear as they're generated.</div></div>}
          </div>
        </main>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  app: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'DM Mono',monospace", fontSize: 14, color: '#6b6880' },
  nav: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '0.5px solid rgba(200,169,110,0.12)', background: 'rgba(10,10,15,0.95)', position: 'sticky', top: 0, zIndex: 50 },
  logo: { fontSize: 16, fontWeight: 800, textDecoration: 'none', color: '#f5f2ec', flexShrink: 0 },
  navUrl: { fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#6b6880', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pill: { fontFamily: "'DM Mono',monospace", fontSize: 10, padding: '3px 10px', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 },
  body: { display: 'flex', flex: 1 },
  sidebar: { width: 210, background: '#0a0a0f', borderRight: '0.5px solid rgba(200,169,110,0.1)', padding: 16, flexShrink: 0, overflowY: 'auto' },
  sideTitle: { fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b6880', marginBottom: 10 },
  flowItem: { padding: '7px 0', borderBottom: '0.5px solid rgba(200,169,110,0.06)', marginBottom: 3 },
  flowName: { fontSize: 12, color: '#f5f2ec', marginBottom: 2, lineHeight: 1.3 },
  flowSub: { fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b6880' },
  logBox: { maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 },
  logLine: { display: 'flex', gap: 6, fontFamily: "'DM Mono',monospace", lineHeight: 1.4 },
  logTime: { color: '#6b6880', flexShrink: 0, fontSize: 10 },
  main: { flex: 1, overflowY: 'auto', padding: 20 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  clipsTitle: { fontSize: 15, fontWeight: 700, color: '#f5f2ec', marginRight: 10 },
  clipsCount: { fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#6b6880' },
  stitchBtn: { padding: '8px 18px', background: '#c8a96e', color: '#0a0a0f', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.04em' },
  stitchBar: { marginBottom: 16, padding: '10px 14px', background: 'rgba(200,169,110,0.06)', border: '0.5px solid rgba(200,169,110,0.15)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 14 },
  card: { background: '#0f0e18', borderStyle: 'solid', overflow: 'hidden', transition: 'border-color 0.15s' },
  thumb: { height: 140, background: '#1a1828', position: 'relative', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  thumbPh: { width: '75%', display: 'flex', flexDirection: 'column', gap: 7 },
  bar: { height: 5, background: 'rgba(200,169,110,0.1)', borderRadius: 2, width: '100%' },
  thumbStatus: { position: 'absolute', bottom: 7, left: 9, fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b6880', background: 'rgba(10,10,15,0.7)', padding: '2px 5px' },
  thumbDur: { position: 'absolute', bottom: 7, right: 9, fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '2px 5px' },
  dot: { position: 'absolute', top: 9, right: 9, width: 16, height: 16, borderRadius: '50%', borderWidth: 1.5, borderStyle: 'solid', transition: 'all 0.15s' },
  cardBody: { padding: '12px 14px' },
  titleInput: { width: '100%', fontSize: 13, fontWeight: 500, color: '#f5f2ec', background: 'transparent', border: 'none', borderBottom: '0.5px solid transparent', outline: 'none', padding: '2px 0', marginBottom: 7, fontFamily: 'inherit' },
  script: { fontSize: 12, color: '#6b6880', lineHeight: 1.5, marginBottom: 10 },
  controls: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 },
  ctrlRow: { display: 'flex', alignItems: 'center', gap: 8 },
  ctrlLbl: { fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b6880', textTransform: 'uppercase', letterSpacing: '0.05em', width: 38, flexShrink: 0 },
  select: { flex: 1, fontSize: 11, padding: '3px 7px', background: '#1a1828', border: '0.5px solid rgba(200,169,110,0.15)', color: '#f5f2ec', fontFamily: "'DM Mono',monospace", outline: 'none' },
  footer: { display: 'flex', gap: 7, paddingTop: 9, borderTop: '0.5px solid rgba(200,169,110,0.08)' },
  footBtn: { padding: '4px 10px', background: 'transparent', border: '0.5px solid rgba(200,169,110,0.2)', color: '#8a6f42', fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: 'pointer', textDecoration: 'none', letterSpacing: '0.03em' },
  empty: { gridColumn: '1/-1', textAlign: 'center', padding: '60px 24px', color: '#6b6880' },
}
