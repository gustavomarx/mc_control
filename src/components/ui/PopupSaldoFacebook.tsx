'use client'

const SESSION_KEY = 'fb-saldo-popup-dismissed'

interface ContaBaixa {
  id: string
  name: string
  balance: number
  currency: string
}

interface Props {
  contas: ContaBaixa[]
  onClose: () => void
}

export default function PopupSaldoFacebook({ contas, onClose }: Props) {
  function fechar() {
    sessionStorage.setItem(SESSION_KEY, '1')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.5)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-full w-9 h-9"
            style={{ background: '#FFF3CD' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Saldo baixo no Facebook Ads</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {contas.length === 1
                ? '1 conta com saldo abaixo de R$ 5,00'
                : `${contas.length} contas com saldo abaixo de R$ 5,00`}
            </p>
          </div>
          <button
            onClick={fechar}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Lista de contas */}
        <div className="divide-y divide-gray-50">
          {contas.map(conta => (
            <div key={conta.id} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-gray-700 truncate pr-3">{conta.name}</span>
              <span
                className="flex-shrink-0 text-sm font-semibold"
                style={{ color: conta.balance <= 0 ? '#DC2626' : '#D97706' }}
              >
                {conta.balance.toLocaleString('pt-BR', { style: 'currency', currency: conta.currency })}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={fechar}
            className="w-full py-2 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: '#4A1228' }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

export { SESSION_KEY }
