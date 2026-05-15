'use client'

import { useState } from 'react'
import type { RecuperacaoStatus, StatusRecuperacao } from '@/types'
import { msgRecuperacao, linkWhatsApp } from '@/lib/crm-messages'

const STATUS_CONFIG: Record<StatusRecuperacao, { label: string; cls: string }> = {
  nao_contatada: { label: 'Não contatada', cls: 'bg-gray-100 text-gray-600' },
  contatada: { label: 'Contatada', cls: 'bg-blue-100 text-blue-700' },
  agendou: { label: 'Agendou ✓', cls: 'bg-emerald-100 text-emerald-700' },
  nao_quer_mais: { label: 'Não quer mais', cls: 'bg-red-100 text-red-600' },
}

function badgeDias(dias: number): { label: string; cls: string } {
  if (dias > 30) return { label: `${dias}d`, cls: 'bg-red-100 text-red-700 font-semibold' }
  if (dias >= 22) return { label: `${dias}d`, cls: 'bg-orange-100 text-orange-700 font-semibold' }
  return { label: `${dias}d`, cls: 'bg-yellow-100 text-yellow-700 font-semibold' }
}

interface Props {
  cliente: RecuperacaoStatus
  onAtualizarStatus: (celular: string, status: StatusRecuperacao) => Promise<void>
}

export default function CardRecuperacao({ cliente, onAtualizarStatus }: Props) {
  const [copiado, setCopiado] = useState(false)
  const [tooltipVis, setTooltipVis] = useState(false)

  function copiarMensagem() {
    navigator.clipboard.writeText(msgRecuperacao(cliente.nome))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const cfg = STATUS_CONFIG[cliente.status]
  const badge = badgeDias(cliente.diasSemRetorno)

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-gray-900">{cliente.nome}</p>
            {cliente.alertaCancelamento && (
              <span
                className="relative cursor-default"
                onMouseEnter={() => setTooltipVis(true)}
                onMouseLeave={() => setTooltipVis(false)}
              >
                <span className="text-amber-500 text-sm">⚠️</span>
                {tooltipVis && (
                  <span className="absolute z-20 left-6 top-0 w-52 bg-gray-800 text-white text-xs rounded-lg p-2 leading-relaxed shadow-lg whitespace-normal">
                    {cliente.alertaCancelamento}
                  </span>
                )}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Última visita: {cliente.ultimaVisita}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>
            {badge.label} sem retorno
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>
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
          href={linkWhatsApp(cliente.celular)}
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
          onChange={e => onAtualizarStatus(cliente.celular, e.target.value as StatusRecuperacao)}
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-700"
        >
          <option value="nao_contatada">Não contatada</option>
          <option value="contatada">Contatada</option>
          <option value="agendou">Agendou</option>
          <option value="nao_quer_mais">Não quer mais</option>
        </select>
      </div>
    </div>
  )
}
