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

const NAV_ATENDENTE = [
  { href: '/mensagens', label: 'Mensagens' },
  { href: '/tarefas', label: 'Tarefas' },
  { href: '/agenda', label: 'Agenda' },
  { href: '/crm', label: 'CRM' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { usuario, perfil, logout } = useAuth()

  function NavLink({ href, label }: { href: string; label: string }) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        href={href}
        style={{
          display: 'block',
          padding: '9px 16px',
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
    flexShrink: 0,
    background: 'linear-gradient(180deg, #4A1228 0%, #3a0d1e 100%)',
    borderRight: '1px solid rgba(139,47,80,.4)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '2px 0 12px rgba(74,18,40,.35)',
  }

  if (perfil === 'atendente') {
    return (
      <aside style={sidebarStyle}>
        <SidebarLogo />
        <nav style={{ flex: 1, padding: '16px 8px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_ATENDENTE.map(item => <NavLink key={item.href} {...item} />)}
          </div>
        </nav>
        <SidebarFooter nome={usuario?.nome ?? ''} onLogout={logout} isAdmin={false} pathname={pathname} />
      </aside>
    )
  }

  return (
    <aside style={sidebarStyle}>
      <SidebarLogo />
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

function SidebarLogo() {
  return (
    <div style={{
      padding: '20px 16px 16px',
      borderBottom: '1px solid rgba(139,47,80,.4)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{
        width: 34, height: 34,
        background: 'linear-gradient(135deg, #C9956B, #b87f56)',
        borderRadius: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flexShrink: 0,
        boxShadow: '0 2px 8px rgba(201,149,107,.35)',
      }}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 15,
          fontWeight: 600,
          color: '#fff',
          letterSpacing: '.01em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          Studio Meus Cílios
        </span>
        <span style={{
          fontFamily: "'Jost', sans-serif",
          fontSize: 10,
          fontWeight: 400,
          color: '#E8C4A8',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
        }}>
          ✦ Gestão
        </span>
      </div>
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
        <Link
          href="/admin/usuarios"
          style={{
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "'Jost', sans-serif",
            color: pathname.startsWith('/admin/usuarios') ? '#C9956B' : 'rgba(232,196,168,.5)',
            textDecoration: 'none',
            letterSpacing: '.04em',
            transition: 'color .15s',
          }}
        >
          Usuários
        </Link>
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
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 12,
            color: 'rgba(232,196,168,.5)',
            fontFamily: "'Jost', sans-serif",
            letterSpacing: '.03em',
            transition: 'color .15s',
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
