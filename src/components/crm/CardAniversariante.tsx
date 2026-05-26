'use client'

import { useState } from 'react'
import type { AniversarianteStatus, StatusAniversariante } from '@/types'
import { msgAniversario, aplicarTemplate, linkWhatsAppComMensagem } from '@/lib/crm-messages'

const STATUS_CONFIG: Record<StatusAniversariante, { label: string; cls: string }> = {
  nao_contatada: { label: 'Não contatada', cls: 'bg-gray-100 text-gray-600' },
  mensagem_enviada: { label: 'Mensagem enviada', cls: 'bg-blue-100 text-blue-700' },
  agendou: { label: 'Agendou ✓', cls: 'bg-emerald-100 text-emerald-700' },
}

interface Props {
  cliente: AniversarianteStatus
  onAtualizarStatus: (celular: string, status: StatusAniversariante) => Promise<void>
  templateConteudo?: string
}

export default function CardAniversariante({ cliente, onAtualizarStatus, templateConteudo }: Props) {
  const [copiado, setCopiado] = useState(false)

  function copiarMensagem() {
    const msg = templateConteudo
      ? aplicarTemplate(templateConteudo, cliente.nome)
      : msgAniversario(cliente.nome)
    navigator.clipboard.writeText(msg)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const cfg = STATUS_CONFIG[cliente.status]

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{cliente.nome}</p>
          {cliente.dataNascimento && (
            <p className="text-xs text-gray-400 mt-0.5">🎂 {cliente.dataNascimento}</p>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${cfg.cls}`}>
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <p className="text-xs text-gray-500">{cliente.celular}</p>
        {cliente.email && <p className="text-xs text-gray-400 truncate">· {cliente.email}</p>}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={copiarMensagem}
          className="flex-1 text-xs py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          {copiado ? '✓ Copiado!' : '📋 Copiar mensagem'}
        </button>
        <a
          href={linkWhatsAppComMensagem(
            cliente.celular,
            templateConteudo ? aplicarTemplate(templateConteudo, cliente.nome) : msgAniversario(cliente.nome)
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-xs py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors text-center"
        >
          💬 WhatsApp
        </a>
      </div>

      <div className="mt-3">
        <select
          value={cliente.status}
          onChange={e => onAtualizarStatus(cliente.celular, e.target.value as StatusAniversariante)}
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-700"
        >
          <option value="nao_contatada">Não contatada</option>
          <option value="mensagem_enviada">Mensagem enviada</option>
          <option value="agendou">Agendou</option>
        </select>
      </div>
    </div>
  )
}
