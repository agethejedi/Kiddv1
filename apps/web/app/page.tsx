'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleAnalyze() {
    if (!url) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) throw new Error('Failed to create project')
      const project = await res.json()
      router.push(`/projects/${project.id}`)
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: 540, width: '100%' }}>
        <h1 style={{ fontSize: 32, fontWeight: 500, marginBottom: 8 }}>
          Demo<span style={{ color: '#7F77DD' }}>Agent</span>
        </h1>
        <p style={{ color: '#888', marginBottom: 32, fontSize: 16 }}>
          Enter a URL. The agent will crawl the site, detect user flows, and generate narrated demo clips — ready to review, edit, and export.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            placeholder="https://your-product.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            style={{
              flex: 1, padding: '10px 14px', fontSize: 15,
              border: '0.5px solid #ddd', borderRadius: 8,
              background: '#fff', outline: 'none',
            }}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !url}
            style={{
              padding: '10px 20px', background: loading ? '#aaa' : '#7F77DD',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Starting...' : 'Analyze →'}
          </button>
        </div>

        {error && <p style={{ color: '#E24B4A', marginTop: 12, fontSize: 14 }}>{error}</p>}

        <p style={{ marginTop: 20, fontSize: 13, color: '#aaa' }}>
          Try: claude.ai · linear.app · notion.so · figma.com
        </p>
      </div>
    </main>
  )
}
