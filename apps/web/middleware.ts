import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require anything — open to all
const PUBLIC_ROUTES = ['/', '/pricing', '/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes and static assets through
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Future: add auth check here when user accounts are added
  // For now, all routes are accessible
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
