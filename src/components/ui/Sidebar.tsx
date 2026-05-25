'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const NAV_TOPO = [
  { href: '/mensagens', label: 'Mensagens' },
]

const NAV_OPERACIONAL = [
  { href: '/tarefas', label: 'Tarefas' },
  { href: '/agenda', label: 'Agenda' },
  { href: '/crm', label: 'CRM' },
  { href: '/comissoes', label: 'Comissões' },
  { href: '/caixa', label: 'Caixa' },
]

const NAV_FINANCEIRO = [
  { href: '/home', label: 'Visão Geral' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/extrato', label: 'Extrato Bancário' },
  { href: '/contas', label: 'Contas a Pagar' },
  { href: '/dre', label: 'DRE Mensal' },
]

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const { usuario, perfil, logout } = useAuth()

  function NavLink({ href, label }: { href: string; label: string }) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        href={href}
        onClick={onClose}
        style={{
          display: 'block',
          padding: '10px 16px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          fontFamily: "'Jost', sans-serif",
          letterSpacing: '.02em',
          transition: 'all .15s',
          textDecoration: 'none',
          background: active ? 'rgba(201,149,107,.18)' : 'transparent',
          color: active ? '#C9956B' : 'rgba(232,196,168,.75)',
          borderLeft: active ? '2px solid #C9956B' : '2px solid transparent',
        }}
        onMouseEnter={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.07)'
            ;(e.currentTarget as HTMLElement).style.color = '#E8C4A8'
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(232,196,168,.75)'
          }
        }}
      >
        {label}
      </Link>
    )
  }

  function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
      <p style={{
        padding: '0 16px',
        marginBottom: 6,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: 'rgba(201,149,107,.5)',
        fontFamily: "'Jost', sans-serif",
      }}>
        {children}
      </p>
    )
  }

  const sidebarStyle: React.CSSProperties = {
    width: 220,
    height: '100%',
    background: 'linear-gradient(180deg, #4A1228 0%, #3a0d1e 100%)',
    borderRight: '1px solid rgba(139,47,80,.4)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '2px 0 12px rgba(74,18,40,.35)',
  }

  if (perfil === 'atendente') {
    const p = usuario?.permissoes
    const topo = p?.mensagens ? [{ href: '/mensagens', label: 'Mensagens' }] : []
    const operacional = [
      p?.tarefas    && { href: '/tarefas',    label: 'Tarefas' },
      p?.agenda     && { href: '/agenda',     label: 'Agenda' },
      p?.crm        && { href: '/crm',        label: 'CRM' },
      p?.comissoes  && { href: '/comissoes',  label: 'Comissões' },
      p?.caixa      && { href: '/caixa',      label: 'Caixa' },
    ].filter(Boolean) as { href: string; label: string }[]
    const financeiro = p?.financeiro ? NAV_FINANCEIRO : []

    return (
      <aside style={sidebarStyle}>
        <SidebarLogo onClose={onClose} />
        <nav style={{ flex: 1, padding: '16px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {topo.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {topo.map(item => <NavLink key={item.href} {...item} />)}
            </div>
          )}
          {operacional.length > 0 && (
            <div>
              <SectionLabel>Operacional</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {operacional.map(item => <NavLink key={item.href} {...item} />)}
              </div>
            </div>
          )}
          {financeiro.length > 0 && (
            <div>
              <SectionLabel>Financeiro</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {financeiro.map(item => <NavLink key={item.href} {...item} />)}
              </div>
            </div>
          )}
        </nav>
        <SidebarFooter nome={usuario?.nome ?? ''} onLogout={logout} isAdmin={false} pathname={pathname} />
      </aside>
    )
  }

  return (
    <aside style={sidebarStyle}>
      <SidebarLogo onClose={onClose} />
      <nav style={{ flex: 1, padding: '16px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          {NAV_TOPO.map(item => <NavLink key={item.href} {...item} />)}
        </div>
        <div>
          <SectionLabel>Operacional</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_OPERACIONAL.map(item => <NavLink key={item.href} {...item} />)}
          </div>
        </div>
        <div>
          <SectionLabel>Financeiro</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_FINANCEIRO.map(item => <NavLink key={item.href} {...item} />)}
          </div>
        </div>
      </nav>
      <SidebarFooter nome={usuario?.nome ?? ''} onLogout={logout} isAdmin pathname={pathname} />
    </aside>
  )
}

function SidebarLogo({ onClose }: { onClose?: () => void }) {
  return (
    <div style={{
      padding: '24px 16px 20px',
      borderBottom: '1px solid rgba(139,47,80,.4)',
      textAlign: 'center',
      position: 'relative',
    }}>
      {/* Botão fechar — só no mobile */}
      {onClose && (
        <button
          onClick={onClose}
          className="lg:hidden"
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'none', border: 'none',
            padding: 6, cursor: 'pointer',
            color: 'rgba(232,196,168,.45)',
            display: 'flex', alignItems: 'center',
          }}
          aria-label="Fechar menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      )}

      {/* Logo */}
      <img
        src="/logo.png"
        alt="Studio Meus Cílios"
        style={{ display: 'block', margin: '0 auto 12px', width: 52, height: 52, objectFit: 'contain' }}
      />

      {/* Nome */}
      <p style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 16,
        fontWeight: 300,
        fontStyle: 'italic',
        color: '#f0dece',
        letterSpacing: '.04em',
        lineHeight: 1.2,
        margin: '0 0 6px',
      }}>
        Studio Meus Cílios
      </p>

      {/* Subtítulo */}
      <p style={{
        fontFamily: "'Jost', sans-serif",
        fontSize: 9,
        fontWeight: 500,
        color: 'rgba(201,149,107,.6)',
        letterSpacing: '.2em',
        textTransform: 'uppercase',
        margin: 0,
      }}>
        ✦&ensp;Controle
      </p>
    </div>
  )
}

function SidebarFooter({ nome, onLogout, isAdmin, pathname }: {
  nome: string
  onLogout: () => void
  isAdmin: boolean
  pathname: string
}) {
  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(139,47,80,.4)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Link
            href="/importacoes"
            style={{
              fontSize: 12, fontWeight: 500,
              fontFamily: "'Jost', sans-serif",
              color: pathname.startsWith('/importacoes') ? '#C9956B' : 'rgba(232,196,168,.5)',
              textDecoration: 'none', letterSpacing: '.04em', transition: 'color .15s',
            }}
          >
            Importações
          </Link>
          <Link
            href="/admin/usuarios"
            style={{
              fontSize: 12, fontWeight: 500,
              fontFamily: "'Jost', sans-serif",
              color: pathname.startsWith('/admin/usuarios') ? '#C9956B' : 'rgba(232,196,168,.5)',
              textDecoration: 'none', letterSpacing: '.04em', transition: 'color .15s',
            }}
          >
            Usuários
          </Link>
        </div>
      )}
      <div>
        {nome && (
          <p style={{ fontSize: 12, color: 'rgba(232,196,168,.6)', fontFamily: "'Jost', sans-serif", marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nome}
          </p>
        )}
        <button
          onClick={onLogout}
          style={{
            background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', fontSize: 12,
            color: 'rgba(232,196,168,.5)', fontFamily: "'Jost', sans-serif",
            letterSpacing: '.03em', transition: 'color .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E8C4A8' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(232,196,168,.5)' }}
        >
          Sair
        </button>
      </div>
    </div>
  )
}
