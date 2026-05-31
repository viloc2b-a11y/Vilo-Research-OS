import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const publicPaths = ['/login', '/auth/callback']
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 120
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

/** Source API routes enforce auth in handlers and return JSON envelopes (not login redirects). */
function isSourceApiPath(pathname: string): boolean {
  return pathname === '/api/source' || pathname.startsWith('/api/source/')
}

/** Dev-only internal API routes — agent tooling, migration runner, etc. */
function isDevApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/dev/')
}

function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown'
}

function sameOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    const requestHost = request.nextUrl.host.toLowerCase()
    const originHost = new URL(origin).host.toLowerCase()
    return originHost === requestHost
  } catch {
    return false
  }
}

function rateLimitAllowed(request: NextRequest): boolean {
  const key = `${clientIp(request)}:${request.nextUrl.pathname}`
  const now = Date.now()
  const current = rateLimitBuckets.get(key)
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  current.count += 1
  return current.count <= RATE_LIMIT_MAX
}

export async function proxy(request: NextRequest) {
  if (MUTATING_METHODS.has(request.method)) {
    if (!sameOriginAllowed(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }
    if (!rateLimitAllowed(request)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublicPath(pathname) && !isSourceApiPath(pathname) && !isDevApiPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === '/login') {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    homeUrl.search = ''
    return NextResponse.redirect(homeUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
