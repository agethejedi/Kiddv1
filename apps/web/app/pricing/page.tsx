import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, project-based pricing. Pay for demos, not subscriptions you forget about.',
}

export default function PricingPage() {
  return (
    <main style={{ minHeight: '100vh' }}>
      {/* 
        The full pricing page HTML lives in /pricing.html (GitHub Pages).
        This Next.js route renders a lightweight version for the app domain
        and links to the marketing site for the full experience.
      */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 48px', borderBottom: '0.5px solid rgba(200,169,110,0.12)' }}>
        <a href="/" style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: '#f5f2ec', textDecoration: 'none' }}>
          Demo<span style={{ color: '#c8a96e' }}>Agent</span>
        </a>
        <a href="/projects/new" style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, background: '#c8a96e', color: '#0a0a0f', padding: '9px 20px', textDecoration: 'none', letterSpacing: '0.04em' }}>
          Start free →
        </a>
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c8a96e', marginBottom: 24 }}>
          Pricing
        </div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 400, lineHeight: 1.05, color: '#f5f2ec', marginBottom: 16, letterSpacing: '-0.02em' }}>
          Project-based.<br />No surprises.
        </h1>
        <p style={{ fontSize: 16, color: '#6b6880', maxWidth: 440, lineHeight: 1.65, marginBottom: 56 }}>
          Pay per project or subscribe for teams shipping features every week.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 1, maxWidth: 860, width: '100%', border: '0.5px solid rgba(200,169,110,0.18)' }}>
          {[
            { name: 'Starter', price: '$29', period: '/mo', projects: '2 projects/mo', cta: 'Get started', featured: false },
            { name: 'Growth', price: '$49', period: '/mo', projects: '5 projects/mo', cta: 'Get started', featured: true },
            { name: 'Studio', price: '$149', period: '/mo', projects: 'Unlimited', cta: 'Get started', featured: false },
          ].map((plan) => (
            <div key={plan.name} style={{
              background: plan.featured ? '#2a2835' : '#0a0a0f',
              padding: '40px 32px',
              border: '0.5px solid rgba(200,169,110,0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              {plan.featured && (
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0a0a0f', background: '#c8a96e', padding: '3px 10px', display: 'inline-block', alignSelf: 'flex-start', marginBottom: 8 }}>
                  Most popular
                </div>
              )}
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: '#f5f2ec' }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 44, color: '#f5f2ec', lineHeight: 1 }}>{plan.price}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#6b6880' }}>{plan.period}</span>
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#8a6f42', marginBottom: 24 }}>{plan.projects}</div>
              <button style={{
                padding: '12px',
                fontFamily: "'DM Mono', monospace",
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: plan.featured ? '#c8a96e' : 'transparent',
                color: plan.featured ? '#0a0a0f' : '#f5f2ec',
                border: plan.featured ? 'none' : '0.5px solid rgba(200,169,110,0.25)',
                cursor: 'pointer',
                marginTop: 'auto',
              }}>
                {plan.cta} →
              </button>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 32, fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#6b6880' }}>
          Also available: <strong style={{ color: '#c8a96e' }}>$29 one-time</strong> single project pass — no subscription needed.
        </p>
      </div>
    </main>
  )
}
