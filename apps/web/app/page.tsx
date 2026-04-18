'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../lib/api'

const EXAMPLES = [
  { url: 'irs.gov', flow: 'How do I find instructions for Form 5498?' },
  { url: 'linear.app', flow: 'How do I create a new project?' },
  { url: 'notion.so', flow: 'How do I create a new page from a template?' },
  { url: 'figma.com', flow: 'How do I share a design file with my team?' },
  { url: 'vercel.com', flow: 'How do I deploy a project from GitHub?' },
]

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [flow, setFlow] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleGenerate() {
    const trimmedUrl = url.trim()
    const trimmedFlow = flow.trim()
    if (!trimmedUrl || !trimmedFlow) return
    const fullUrl = trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`
    setLoading(true)
    setError('')
    try {
      const project = await api.createProject(fullUrl, trimmedFlow)
      router.push(`/projects/${project.id}`)
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  function fillExample(ex: typeof EXAMPLES[0]) {
    setUrl(`https://${ex.url}`)
    setFlow(ex.flow)
  }

  const canSubmit = url.trim() && flow.trim() && !loading

  return (
    <main style={styles.main}>
      <nav style={styles.nav}>
        <div style={styles.logo}>Demo<span style={{ color: '#c8a96e' }}>Agent</span></div>
        <a href="/pricing" style={styles.navLink}>Pricing</a>
      </nav>

      <section style={styles.hero}>
        <div style={styles.eyebrow}>AI-powered demo generation</div>
        <h1 style={styles.h1}>
          Describe it.<br />
          <em style={{ fontStyle: 'italic', color: '#c8a96e' }}>We record it.</em>
        </h1>
        <p style={styles.sub}>
          Give us a URL and describe the flow you want to demo.
          The agent records it, narrates it, and hands you a ready-to-share video clip.
        </p>

        <div style={styles.card}>
          <div style={styles.fieldRow}>
            <label style={styles.label}>Website URL</label>
            <input
              type="text"
              placeholder="https://irs.gov"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={styles.input}
              autoFocus
            />
          </div>

          <div style={styles.divider} />

          <div style={styles.fieldRow}>
            <label style={styles.label}>What should the demo show?</label>
            <textarea
              placeholder="How do I find instructions for Form 5498?"
              value={flow}
              onChange={(e) => setFlow(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && canSubmit && handleGenerate()}
              style={styles.textarea}
              rows={2}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!canSubmit}
            style={{
              ...styles.btn,
              opacity: canSubmit ? 1 : 0.45,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Starting…' : 'Generate clip →'}
          </button>

          {error && <p style={styles.error}>{error}</p>}
        </div>

        <div style={styles.examplesWrap}>
          <span style={styles.examplesLabel}>Try an example:</span>
          <div style={styles.examples}>
            {EXAMPLES.map((ex) => (
              <button key={ex.url} onClick={() => fillExample(ex)} style={styles.exampleChip}>
                {ex.url}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.steps}>
        {[
          { n: '01', title: 'Describe', desc: 'Tell us the URL and what flow to demo in plain English.' },
          { n: '02', title: 'Record', desc: 'Agent navigates the site and captures the exact flow.' },
          { n: '03', title: 'Narrate', desc: 'Script generated, voiced, and synced to the recording.' },
          { n: '04', title: 'Review', desc: 'Edit title, swap voice, choose music.' },
          { n: '05', title: 'Export', desc: 'Download MP4 or share via link.' },
        ].map((s) => (
          <div key={s.n} style={styles.step}>
            <div style={styles.stepNum}>{s.n}</div>
            <div style={styles.stepTitle}>{s.title}</div>
            <div style={styles.stepDesc}>{s.desc}</div>
          </div>
        ))}
      </section>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  main: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0f', color: '#f5f2ec' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 48px', borderBottom: '0.5px solid rgba(200,169,110,0.12)' },
  logo: { fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' },
  navLink: { fontSize: 13, color: '#6b6880', textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" },
  hero: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '64px 24px 48px', maxWidth: 680, margin: '0 auto', width: '100%' },
  eyebrow: { fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c8a96e', marginBottom: 20 },
  h1: { fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 400, lineHeight: 1.08, letterSpacing: '-0.02em', margin: '0 0 20px', color: '#f5f2ec' },
  sub: { fontSize: 15, color: '#6b6880', lineHeight: 1.65, maxWidth: 440, marginBottom: 36 },
  card: { width: '100%', background: '#0f0e18', border: '0.5px solid rgba(200,169,110,0.2)', padding: '0', display: 'flex', flexDirection: 'column' },
  fieldRow: { display: 'flex', flexDirection: 'column', gap: 8, padding: '20px 24px' },
  label: { fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a6f42', textAlign: 'left' },
  input: { fontSize: 15, fontFamily: "'DM Mono', monospace", background: 'transparent', border: 'none', color: '#f5f2ec', outline: 'none', padding: 0 },
  divider: { height: '0.5px', background: 'rgba(200,169,110,0.15)', margin: '0 24px' },
  textarea: { fontSize: 15, fontFamily: "'DM Mono', monospace", background: 'transparent', border: 'none', color: '#f5f2ec', outline: 'none', padding: 0, resize: 'none', lineHeight: 1.55 },
  btn: { margin: '16px 24px 24px', padding: '14px', background: '#c8a96e', color: '#0a0a0f', border: 'none', fontSize: 13, fontFamily: "'DM Mono', monospace", fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' },
  error: { color: '#E24B4A', fontSize: 12, fontFamily: "'DM Mono', monospace", margin: '-8px 24px 16px', textAlign: 'left' },
  examplesWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 24 },
  examplesLabel: { fontSize: 11, color: '#6b6880', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' },
  examples: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  exampleChip: { padding: '5px 14px', background: 'transparent', border: '0.5px solid rgba(200,169,110,0.2)', color: '#8a6f42', fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: 'pointer' },
  steps: { display: 'flex', borderTop: '0.5px solid rgba(200,169,110,0.1)', overflowX: 'auto' },
  step: { flex: 1, padding: '28px 24px', borderRight: '0.5px solid rgba(200,169,110,0.08)', minWidth: 140 },
  stepNum: { fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#c8a96e', letterSpacing: '0.1em', marginBottom: 8 },
  stepTitle: { fontSize: 14, fontWeight: 700, color: '#f5f2ec', marginBottom: 5 },
  stepDesc: { fontSize: 12, color: '#6b6880', lineHeight: 1.5 },
}
