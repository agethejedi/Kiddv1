export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c8a96e', marginBottom: 16 }}>
        404
      </div>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 48, fontWeight: 400, color: '#f5f2ec', marginBottom: 12 }}>
        Nothing here.
      </h1>
      <p style={{ fontSize: 14, color: '#6b6880', marginBottom: 36 }}>
        This page doesn't exist — or was moved.
      </p>
      <a href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0a0a0f', background: '#c8a96e', padding: '11px 24px', textDecoration: 'none' }}>
        Back to home →
      </a>
    </main>
  )
}
