import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login']
const ROTAS_ATENDENTE = ['/mensagens', '/tarefas', '/agenda', '/crm']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('firebase-token')?.value
  const perfil = request.cookies.get('user-perfil')?.value

  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r))

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token && pathname === '/login') {
    const destino = perfil === 'atendente' ? '/mensagens' : '/home'
    return NextResponse.redirect(new URL(destino, request.url))
  }

  // Bloqueia atendente em rotas não permitidas
  if (token && perfil === 'atendente') {
    const isAllowed = ROTAS_ATENDENTE.some(r => pathname === r || pathname.startsWith(r + '/'))
    if (!isAllowed) {
      return NextResponse.redirect(new URL('/mensagens', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
