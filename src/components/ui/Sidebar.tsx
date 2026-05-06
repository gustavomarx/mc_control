'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/extrato', label: 'Extrato Bancário' },
  { href: '/contas', label: 'Contas a Pagar' },
  { href: '/dre', label: 'DRE Mensal' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { usuario, logout } = useAuth()

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900 leading-tight">Studio Meus Cílios</p>
        <p className="text-xs text-gray-400 mt-0.5">Sistema Financeiro</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 truncate mb-2">{usuario?.nome ?? ''}</p>
        <button
          onClick={logout}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  )
}
