'use client'

import { useState, useRef } from 'react'
import { useAgenda } from '@/hooks/useAgenda'
import { parseAgendaAvec } from '@/lib/parse-agenda'
import type { AgendaAvec } from '@/types'

const DIAS_PT: Record<number, string> = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 0: 'Dom' }
const AVEC_URL = 'https://admin.avec.beauty/admin/relatorio/0051'

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function semanaLabel(key: string): string {
  const [ano, mes, dia] = key.split('-').map(Number)
  return `Semana de ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
}

function corProgresso(ativos: number, meta: number): string {
  if (meta === 0) return 'bg-gray-300'
  const pct = ativos / meta
  if (pct >= 1) return 'bg-emerald-500'
  if (pct >= 0.7) return 'bg-yellow-400'
  return 'bg-red-500'
}

function fraseContextual(unicas: number, meta: number): { texto: string; cor: string } {
  const falta = meta - unicas
  if (unicas >= meta) return { texto: 'Semana no caminho certo 💚', cor: 'text-emerald-600' }
  if (unicas / meta >= 0.7) return { texto: `Atenção: ${falta} cliente${falta > 1 ? 's' : ''} abaixo da meta — considere acionar lista de espera`, cor: 'text-yellow-600' }
  return { texto: `Semana crítica: ${falta} cliente${falta > 1 ? 's' : ''} abaixo da meta — ação imediata necessária`, cor: 'text-red-600' }
}

function toLocalKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function diasDaSemana(semanaKey: string): string[] {
  const [ano, mes, dia] = semanaKey.split('-').map(Number)
  const segunda = new Date(ano, mes - 1, dia)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(segunda)
    d.setDate(d.getDate() + i)
    return toLocalKey(d)
  })
}

interface TooltipProps { texto: string }
function Tooltip({ texto }: TooltipProps) {
  const [vis, setVis] = useState(false)
  return (
    <span className="relative inline-block ml-1">
      <button
        onMouseEnter={() => setVis(true)}
        onMouseLeave={() => setVis(false)}
        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center hover:bg-gray-300"
      >?</button>
      {vis && (
        <span className="absolute z-10 left-5 top-0 w-64 bg-gray-800 text-white text-xs rounded-lg p-2 leading-relaxed shadow-lg">
          {texto}
        </span>
      )}
    </span>
  )
}

interface PainelAgendaProps { agenda: AgendaAvec; meta: number }

function PainelAgenda({ agenda, meta }: PainelAgendaProps) {
  const [expandirServicos, setExpandirServicos] = useState(false)
  const dias = diasDaSemana(agenda.semanaKey)
  const mediaDia = meta / 6
  const clientesUnicas = agenda.clientesUnicas ?? agenda.totalAtivos
  const pct = meta > 0 ? Math.min((clientesUnicas / meta) * 100, 100) : 0
  const cor = corProgresso(clientesUnicas, meta)
  const frase = fraseContextual(clientesUnicas, meta)
  const taxaCancelamento = agenda.totalAtivos + agenda.totalCancelados > 0
    ? ((agenda.totalCancelados / (agenda.totalAtivos + agenda.totalCancelados)) * 100).toFixed(1)
    : '0'

  const profissionais = Object.keys(agenda.porProfissional)

  return (
    <div className="space-y-6">
      {/* Barra de progresso */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-medium text-gray-700">
              {clientesUnicas} de {meta} clientes únicas
            </span>
            <span className="text-xs text-gray-400 ml-2">({agenda.totalAtivos} agendamentos)</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{pct.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
          <div className={`h-3 rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
        </div>
        <p className={`text-sm font-medium ${frase.cor}`}>{frase.texto}</p>
      </div>

      {/* Cards por dia */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Por dia</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {dias.map(dataKey => {
            const d = agenda.porDia[dataKey]
            const dow = new Date(dataKey + 'T12:00:00').getDay()
            const baixo = d && d.ativos < mediaDia
            return (
              <div
                key={dataKey}
                className={`bg-white rounded-xl border p-3 ${baixo && d.ativos > 0 ? 'border-red-200' : 'border-gray-100'}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-600">{DIAS_PT[dow]}</span>
                  {baixo && d && d.ativos > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                  )}
                </div>
                {d ? (
                  <>
                    <p className="text-xl font-bold text-gray-900">{d.ativos}</p>
                    <div className="mt-1 space-y-0.5">
                      {d.confirmados > 0 && <p className="text-xs text-gray-400">✓ {d.confirmados} conf.</p>}
                      {d.aguardando > 0 && <p className="text-xs text-gray-400">⏳ {d.aguardando} ag.</p>}
                      {d.agendados > 0 && <p className="text-xs text-gray-400">📅 {d.agendados} ag.</p>}
                    </div>
                  </>
                ) : (
                  <p className="text-xl font-bold text-gray-300">—</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabela por profissional */}
      {profissionais.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Por profissional</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Profissional</th>
                  {dias.map(d => {
                    const dow = new Date(d + 'T12:00:00').getDay()
                    return <th key={d} className="text-center px-2 py-2.5 text-xs font-medium text-gray-500">{DIAS_PT[dow]}</th>
                  })}
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {profissionais.map(prof => {
                  const total = dias.reduce((s, d) => s + (agenda.porProfissional[prof][d] ?? 0), 0)
                  return (
                    <tr key={prof} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{prof}</td>
                      {dias.map(d => {
                        const v = agenda.porProfissional[prof][d] ?? 0
                        return (
                          <td key={d} className={`text-center px-2 py-2.5 text-sm ${v === 0 ? 'text-gray-200' : 'text-gray-700 font-medium'}`}>
                            {v === 0 ? '—' : v}
                          </td>
                        )
                      })}
                      <td className="text-center px-3 py-2.5 font-semibold text-gray-900">{total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancelamentos e faltas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{agenda.totalCancelados}</p>
          <p className="text-xs text-gray-500 mt-1">Cancelamentos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{agenda.totalFaltas}</p>
          <p className="text-xs text-gray-500 mt-1">Faltas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{taxaCancelamento}%</p>
          <p className="text-xs text-gray-500 mt-1">Taxa cancelamento</p>
        </div>
      </div>

      {/* Clientes novas */}
      <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 flex items-center gap-3">
        <span className="text-2xl">✨</span>
        <div>
          <p className="text-sm font-semibold text-emerald-800">{agenda.clientesNovas} clientes novas esta semana</p>
          <p className="text-xs text-emerald-600 mt-0.5">Cadastradas nos últimos 30 dias ou primeiro agendamento</p>
        </div>
      </div>

      {/* Detalhes por serviço */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setExpandirServicos(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Ver detalhes por serviço</span>
          <span className="text-gray-400 text-xs">{expandirServicos ? '▲' : '▼'}</span>
        </button>
        {expandirServicos && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-t border-gray-100">
            {[
              { label: 'Cílios', valor: agenda.porServico.cilios, emoji: '👁️' },
              { label: 'Unhas', valor: agenda.porServico.unhas, emoji: '💅' },
              { label: 'Agregados', valor: agenda.porServico.agregados, emoji: '✨' },
              { label: 'Outros', valor: agenda.porServico.outros, emoji: '📋' },
            ].map(({ label, valor, emoji }) => (
              <div key={label} className="p-4 text-center border-r border-gray-100 last:border-0">
                <p className="text-xl mb-1">{emoji}</p>
                <p className="text-2xl font-bold text-gray-900">{valor}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AgendaPage() {
  const { agendaAtual, historico, metaSemanal, loading, salvarAgenda, salvarMeta } = useAgenda()
  const [semanaVis, setSemanaVis] = useState<string | null>(null)
  const [metaEditando, setMetaEditando] = useState(false)
  const [metaInput, setMetaInput] = useState(String(metaSemanal))
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const agendaExibida = semanaVis
    ? historico.find(h => h.semanaKey === semanaVis) ?? agendaAtual
    : agendaAtual

  async function handleFile(file: File) {
    if (!file) return
    setUploading(true)
    try {
      const agendas = await parseAgendaAvec(file)
      await salvarAgenda(agendas)
      setSemanaVis(null) // volta para semana atual
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo. Verifique se é o relatório 0051 do AVEC.')
    } finally {
      setUploading(false)
    }
  }

  async function salvarMetaEditada() {
    const v = parseInt(metaInput)
    if (!isNaN(v) && v > 0) {
      await salvarMeta(v, agendaExibida?.semanaKey ?? '')
    }
    setMetaEditando(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Carregando agenda...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-xl font-bold text-gray-900">Agenda AVEC</h1>
          <div className="flex gap-2">
            <a
              href={AVEC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-white transition-colors"
            >
              Abrir relatório no AVEC ↗
            </a>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Processando...' : 'Upload XLSX'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
            />
          </div>
        </div>

        {/* Seletor de semana */}
        {historico.length > 1 && (
          <div className="mb-5">
            <select
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              value={semanaVis ?? (agendaAtual?.semanaKey ?? '')}
              onChange={e => setSemanaVis(e.target.value)}
            >
              {historico.map(h => (
                <option key={h.semanaKey} value={h.semanaKey}>{semanaLabel(h.semanaKey)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Meta semanal */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex items-center gap-3">
          <span className="text-sm text-gray-600">Meta da semana:</span>
          {metaEditando ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={metaInput}
                onChange={e => setMetaInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') salvarMetaEditada() }}
                autoFocus
              />
              <button onClick={salvarMetaEditada} className="text-xs text-emerald-600 font-medium hover:text-emerald-700">Salvar</button>
              <button onClick={() => setMetaEditando(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
            </div>
          ) : (
            <button
              onClick={() => { setMetaInput(String(metaSemanal)); setMetaEditando(true) }}
              className="text-sm font-semibold text-gray-900 hover:text-emerald-600 underline underline-offset-2 decoration-dashed transition-colors"
            >
              {metaSemanal} clientes únicas
            </button>
          )}
          <Tooltip texto="Define quantas clientes únicas você espera na semana. Uma cliente com múltiplos serviços conta como 1. Considera status: Agendado, Confirmado, Aguardando, Em Atendimento, Pago e Finalizado." />
        </div>

        {/* Painel principal ou estado vazio */}
        {agendaExibida ? (
          <PainelAgenda agenda={agendaExibida} meta={metaSemanal} />
        ) : (
          <div
            className="border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center cursor-pointer hover:border-emerald-300 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <p className="text-gray-400 text-sm">Nenhum dado desta semana ainda.</p>
            <p className="text-gray-300 text-xs mt-1">Clique para fazer upload do relatório 0013 do AVEC.</p>
          </div>
        )}
      </div>
    </div>
  )
}
