'use client'

import { useState } from 'react'
import type { RecuperacaoStatus, StatusRecuperacao } from '@/types'
import { msgRecuperacao, aplicarTemplate, linkWhatsApp } from '@/lib/crm-messages'

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
  onAtualizarObservacao: (celular: string, observacao: string) => Promise<void>
  templateConteudo?: string
}

export default function CardRecuperacao({ cliente, onAtualizarStatus, onAtualizarObservacao, templateConteudo }: Props) {
  const [copiado, setCopiado] = useState(false)
  const [tooltipVis, setTooltipVis] = useState(false)
  const [obsAberta, setObsAberta] = useState(false)
  const [obsTexto, setObsTexto] = useState(cliente.observacao ?? '')
  const [salvando, setSalvando] = useState(false)

  function copiarMensagem() {
    const msg = templateConteudo
      ? aplicarTemplate(templateConteudo, cliente.nome)
      : msgRecuperacao(cliente.nome)
    navigator.clipboard.writeText(msg)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function salvarObservacao() {
    setSalvando(true)
    try {
      await onAtualizarObservacao(cliente.celular, obsTexto.trim())
      setObsAberta(false)
    } finally {
      setSalvando(false)
    }
  }

  const cfg = STATUS_CONFIG[cliente.status]
  const badge = badgeDias(cliente.diasSemRetorno)
  const temObs = !!cliente.observacao?.trim()

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
            <button
              onClick={() => {
                setObsTexto(cliente.observacao ?? '')
                setObsAberta(v => !v)
              }}
              title={temObs ? cliente.observacao : 'Adicionar observação'}
              className={`text-base leading-none transition-opacity ${temObs ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
            >
              💬
            </button>
            {temObs && !obsAberta && (
              <span className="text-xs text-gray-400 truncate max-w-[80px]">{cliente.observacao}</span>
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

      {obsAberta && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2">
          <textarea
            value={obsTexto}
            onChange={e => setObsTexto(e.target.value)}
            placeholder="Escreva uma observação sobre esta cliente..."
            rows={2}
            className="w-full text-xs bg-transparent resize-none focus:outline-none text-gray-700 placeholder-gray-400"
          />
          <div className="flex gap-2 mt-1.5 justify-end">
            <button
              onClick={() => setObsAberta(false)}
              className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={salvarObservacao}
              disabled={salvando}
              className="text-xs px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

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
