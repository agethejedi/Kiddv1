'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../lib/api'

const EXAMPLES = ['claude.ai', 'linear.app', 'notion.so', 'figma.com', 'vercel.com']

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleAnalyze() {
    const trimmed = url.trim()
    if (!trimmed) return
    const fullUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    setLoading(true)
    setError('')
    try {
      const project = await api.createProject(fullUrl)
      router.push(`/projects/${project.id}`)
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  return (
    <main style={styles.main}>
      <nav style={styles.nav}>
        <div style={styles.logo}>Demo<span style={{ color: '#c8a96e' }}>Agent</span></div>
        <a href="/pricing" style={styles.navLink}>Pricing</a>
      </nav>

      <section style={styles.hero}>
        <div style={styles.eyebrow}>AI-powered demo generation</div>
        <h1 style={styles.h1}>
          From URL to<br />
          <em style={{ fontStyle: 'italic', color: '#c8a96e' }}>demo video</em><br />
          in minutes.
        </h1>
        <p style={styles.sub}>
          Paste any product URL. The agent crawls the site, detects user flows,
          records each one with narration, and hands you a review-ready video.
        </p>

        <div style={styles.inputWrap}>
          <input
            type="text"
            placeholder="https://your-product.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            style={styles.input}
            autoFocus
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !url.trim()}
            style={{ ...styles.btn, opacity: loading || !url.trim() ? 0.5 : 1, cursor: loading || !url.trim() ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Starting…' : 'Analyze →'}
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.examples}>
          <span style={styles.examplesLabel}>Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setUrl(`https://${ex}`)} style={styles.exampleChip}>{ex}</button>
          ))}
        </div>
      </section>

      <section style={styles.steps}>
        {[
          { n: '01', title: 'Crawl', desc: 'Agent maps your site — nav, CTAs, interactive elements.' },
          { n: '02', title: 'Detect', desc: 'Claude identifies 4–6 user flows worth demonstrating.' },
          { n: '03', title: 'Record', desc: 'Each flow is executed and captured with click overlays.' },
          { n: '04', title: 'Narrate', desc: 'Scripts generated, voiced, and synced to the recording.' },
          { n: '05', title: 'Review', desc: 'Edit titles, swap voices, choose music, then export.' },
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
  main: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 48px', borderBottom: '0.5px solid rgba(200,169,110,0.12)' },
  logo: { fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' },
  navLink: { fontSize: 13, color: '#6b6880', textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" },
  hero: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 24px 60px', maxWidth: 720, margin: '0 auto', width: '100%' },
  eyebrow: { fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c8a96e', marginBottom: 24 },
  h1: { fontSize: 'clamp(44px, 7vw, 76px)', fontWeight: 400, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 24px', color: '#f5f2ec' },
  sub: { fontSize: 16, color: '#6b6880', lineHeight: 1.65, maxWidth: 460, marginBottom: 48 },
  inputWrap: { display: 'flex', gap: 8, width: '100%', maxWidth: 560, marginBottom: 16 },
  input: { flex: 1, padding: '13px 16px', fontSize: 15, fontFamily: "'DM Mono', monospace", background: '#0f0e18', border: '0.5px solid rgba(200,169,110,0.25)', color: '#f5f2ec', outline: 'none' },
  btn: { padding: '13px 24px', background: '#c8a96e', color: '#0a0a0f', border: 'none', fontSize: 13, fontFamily: "'DM Mono', monospace", fontWeight: 500, letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  error: { color: '#E24B4A', fontSize: 13, fontFamily: "'DM Mono', monospace", marginTop: 8 },
  examples: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 },
  examplesLabel: { fontSize: 12, color: '#6b6880', fontFamily: "'DM Mono', monospace" },
  exampleChip: { padding: '4px 12px', background: 'transparent', border: '0.5px solid rgba(200,169,110,0.2)', color: '#8a6f42', fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: 'pointer' },
  steps: { display: 'flex', borderTop: '0.5px solid rgba(200,169,110,0.1)', overflowX: 'auto' },
  step: { flex: 1, padding: '32px 28px', borderRight: '0.5px solid rgba(200,169,110,0.1)', minWidth: 160 },
  stepNum: { fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#c8a96e', letterSpacing: '0.1em', marginBottom: 10 },
  stepTitle: { fontSize: 15, fontWeight: 700, color: '#f5f2ec', marginBottom: 6 },
  stepDesc: { fontSize: 13, color: '#6b6880', lineHeight: 1.5 },
}
