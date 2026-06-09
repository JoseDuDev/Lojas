import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware de resolução de tenant via subdomínio
 *
 * Exemplos:
 *   minhaloja.valorem.com.br  → storeId identificado pelo subdomínio
 *   localhost:3000             → usa NEXT_PUBLIC_DEV_STORE para dev local
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  // Em desenvolvimento, usa variável de ambiente para simular tenant
  const isDev = process.env.NODE_ENV === 'development'
  const devStore = process.env.NEXT_PUBLIC_DEV_STORE || 'demo'

  let subdomain: string

  if (isDev && !hostname.includes('.valorem')) {
    subdomain = devStore
  } else {
    const parts = hostname.split('.')
    subdomain = parts.length >= 3 ? parts[0] : 'www'
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant', subdomain)
  requestHeaders.set('x-hostname', hostname)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
