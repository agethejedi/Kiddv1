import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'DemoAgent', template: '%s | DemoAgent' },
  description: 'AI-powered product demo video generator. Paste a URL, get narrated demo clips in minutes.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'DemoAgent',
    description: 'AI-powered product demo video generator',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        margin: 0,
        fontFamily: "'Syne', sans-serif",
        background: '#0a0a0f',
        color: '#f5f2ec',
        minHeight: '100vh',
      }}>
        {children}
      </body>
    </html>
  )
}
