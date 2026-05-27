'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import { useAuth } from '@/contexts/AuthContext'

const ROTAS_ACESSIVEIS = ['/mensagens', '/tarefas', '/agenda', '/crm', '/comissoes', '/caixa', '/facebook-ads', '/home']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { loading, usuario, perfil, podeAcessar } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const podeAcessarRef = useRef(podeAcessar)
  podeAcessarRef.current = podeAcessar

  useEffect(() => {
    if (loading || !usuario || perfil === 'admin') return
    if (podeAcessarRef.current(pathname)) return
    const primeira = ROTAS_ACESSIVEIS.find(r => podeAcessarRef.current(r))
    if (primeira) router.replace(primeira)
  }, [loading, usuario, perfil, pathname, router])

  return (
    <div className="flex overflow-hidden" style={{ height: '100dvh' }}>

      {/* Backdrop mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,.5)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar wrapper
          Mobile  → fixed, drawer (-translate-x-full / translate-x-0)
          Desktop → relative, sempre visível (translate-x-0) */}
      <div
        className={[
          // Mobile: drawer deslizante
          'fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out',
          // Desktop: fluxo normal, sempre visível
          'lg:relative lg:z-auto lg:transition-none lg:translate-x-0',
          // Estado mobile
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Sidebar onClose={() => setMobileOpen(false)} />
      </div>

      {/* Área de conteúdo */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Barra topo — só mobile */}
        <header
          className="lg:hidden flex items-center gap-3 shrink-0 px-4"
          style={{
            height: 52,
            background: 'linear-gradient(90deg, #4A1228 0%, #3a0d1e 100%)',
            borderBottom: '1px solid rgba(139,47,80,.4)',
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            style={{
              background: 'none', border: 'none',
              padding: 6, cursor: 'pointer',
              color: '#E8C4A8', display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>
            </svg>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 15, fontWeight: 600, color: '#fff',
            }}>
              Studio Meus Cílios
            </span>
            <span style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: 9, fontWeight: 400, color: '#E8C4A8',
              letterSpacing: '.1em', textTransform: 'uppercase',
            }}>
              ✦ Gestão
            </span>
          </div>
        </header>

        {/* Conteúdo da página */}
        <main className="flex-1 overflow-auto" style={{ background: 'var(--cream)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
