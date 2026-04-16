import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DemoAgent',
  description: 'AI-powered product demo video generator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f5f3' }}>
        {children}
      </body>
    </html>
  )
}
