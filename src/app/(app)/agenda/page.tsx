'use client'

import { useState, useRef } from 'react'
import { useAgenda } from '@/hooks/useAgenda'
import { parseAgendaAvec } from '@/lib/parse-agenda'
import { parseTabelaPrecos } from '@/lib/parse-tabela-precos'
import type { AgendaAvec, AgendamentoAvec } from '@/types'

const DIAS_PT: Record<number, string> = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 0: 'Dom' }
const AVEC_URL = 'https://admin.avec.beauty/admin/relatorio/0051'

const STATUS_ATIVOS = new Set([
  'Agendado', 'Confirmado', 'Aguardando', 'Em Atendimento', 'Pago', 'Finalizado',
])

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtK(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function semanaLabel(key: string): string {
  const [ano, mes, dia] = key.split('-').map(Number)
  const seg = new Date(ano, mes - 1, dia)
  const sab = new Date(ano, mes - 1, dia + 5)
  const f = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  return `Semana de ${f(seg)} a ${f(sab)}`
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
  if (unicas / meta >= 0.7) return { texto: `Atenção: ${falta} cliente${falta > 1 ? 's' : ''} abaixo da meta`, cor: 'text-yellow-600' }
  return { texto: `Semana crítica: ${falta} cliente${falta > 1 ? 's' : ''} abaixo da meta`, cor: 'text-red-600' }
}

function toLocalKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDateKey(dataStr: string): string | null {
  if (!dataStr) return null
  // Aceita DD/MM/YYYY ou YYYY-MM-DD
  const partes = dataStr.includes('/') ? dataStr.split('/') : dataStr.split('-').reverse()
  if (partes.length < 3) return null
  const [dia, mes, ano] = partes.map(Number)
  if (!dia || !mes || !ano) return null
  const y = ano < 100 ? 2000 + ano : ano
  return `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
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

// ── Cálculo de estimativas ──────────────────────────────────────────────────

interface Estimativas {
  porDia: Record<string, number>   // YYYY-MM-DD → R$
  total: number
  comPreco: number                 // nº agendamentos com preço encontrado
  semPreco: number                 // nº agendamentos sem preço
  semPrecoDet: string[]            // nomes únicos dos serviços sem preço
}

function calcularEstimativas(
  agendamentos: AgendamentoAvec[],
  dias: string[],
  tabela: Record<string, number>,
): Estimativas {
  const diasSet = new Set(dias)
  const porDia: Record<string, number> = {}
  let total = 0, comPreco = 0, semPreco = 0
  const semPrecoDet = new Set<string>()

  for (const ag of agendamentos) {
    if (!STATUS_ATIVOS.has(ag.status)) continue
    const dataKey = parseDateKey(ag.dataReserva)
    if (!dataKey || !diasSet.has(dataKey)) continue

    // Busca exata → case-insensitive
    const preco = tabela[ag.servico] ?? tabela[ag.servico.trim()] ??
      (() => {
        const lower = ag.servico.toLowerCase()
        const match = Object.entries(tabela).find(([k]) => k.toLowerCase() === lower)
        return match ? match[1] : undefined
      })()

    if (preco !== undefined) {
      porDia[dataKey] = (porDia[dataKey] ?? 0) + preco
      total += preco
      comPreco++
    } else {
      semPreco++
      if (ag.servico) semPrecoDet.add(ag.servico)
    }
  }

  return { porDia, total, comPreco, semPreco, semPrecoDet: [...semPrecoDet] }
}

// ── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ texto }: { texto: string }) {
  const [vis, setVis] = useState(false)
  return (
    <span className="relative inline-block ml-1">
      <button
        onMouseEnter={() => setVis(true)} onMouseLeave={() => setVis(false)}
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

// ── PainelAgenda ─────────────────────────────────────────────────────────────

interface PainelAgendaProps {
  agenda: AgendaAvec
  meta: number
  tabela: Record<string, number>
  temTabela: boolean
}

function PainelAgenda({ agenda, meta, tabela, temTabela }: PainelAgendaProps) {
  const [expandirServicos, setExpandirServicos] = useState(false)
  const [expandirSemPreco, setExpandirSemPreco] = useState(false)

  const dias = diasDaSemana(agenda.semanaKey)
  const mediaDia = meta / 6
  const clientesUnicas = agenda.clientesUnicas ?? agenda.totalAtivos
  const pct = meta > 0 ? Math.min((clientesUnicas / meta) * 100, 100) : 0
  const cor = corProgresso(clientesUnicas, meta)
  const frase = fraseContextual(clientesUnicas, meta)
  const taxaCancelamento = agenda.totalAtivos + agenda.totalCancelados > 0
    ? ((agenda.totalCancelados / (agenda.totalAtivos + agenda.totalCancelados)) * 100).toFixed(1)
    : '0'

  const estimativas = temTabela
    ? calcularEstimativas(agenda.agendamentos ?? [], dias, tabela)
    : null

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

      {/* Estimativa de faturamento */}
      {temTabela && estimativas && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Estimativa de faturamento</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {estimativas.comPreco} agendamento{estimativas.comPreco !== 1 ? 's' : ''} com preço mapeado
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-emerald-600">{fmt(estimativas.total)}</p>
              <p className="text-xs text-gray-400">estimativa da semana</p>
            </div>
          </div>

          {/* Grid de estimativa por dia */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {dias.map(dataKey => {
              const dow = new Date(dataKey + 'T12:00:00').getDay()
              const valor = estimativas.porDia[dataKey]
              return (
                <div key={dataKey} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">{DIAS_PT[dow]}</p>
                  {valor !== undefined ? (
                    <p className="text-sm font-bold text-emerald-800">{fmtK(valor)}</p>
                  ) : (
                    <p className="text-sm font-bold text-gray-300">—</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Alertas de serviços sem preço */}
          {estimativas.semPreco > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setExpandirSemPreco(v => !v)}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                {estimativas.semPreco} agendamento{estimativas.semPreco !== 1 ? 's' : ''} sem preço mapeado
                <span className="text-amber-400">{expandirSemPreco ? '▲' : '▼'}</span>
              </button>
              {expandirSemPreco && (
                <ul className="mt-2 space-y-1 pl-3.5">
                  {estimativas.semPrecoDet.map(s => (
                    <li key={s} className="text-xs text-gray-500 truncate">• {s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

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
                  {baixo && d && d.ativos > 0 && <span className="w-2 h-2 rounded-full bg-red-400" />}
                </div>
                {d ? (
                  <>
                    <p className="text-xl font-bold text-gray-900">{d.ativos}</p>
                    <div className="mt-1 space-y-0.5">
                      {d.confirmados > 0 && <p className="text-xs text-gray-400">✓ {d.confirmados} conf.</p>}
                      {d.aguardando  > 0 && <p className="text-xs text-gray-400">⏳ {d.aguardando} ag.</p>}
                      {d.agendados   > 0 && <p className="text-xs text-gray-400">📅 {d.agendados} ag.</p>}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 420 }}>
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

        {expandirServicos && (() => {
          // Contagem de serviços ativos
          const contagem = new Map<string, number>()
          for (const ag of agenda.agendamentos ?? []) {
            if (!STATUS_ATIVOS.has(ag.status)) continue
            const s = ag.servico?.trim()
            if (s) contagem.set(s, (contagem.get(s) ?? 0) + 1)
          }

          const lista = [...contagem.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([servico, qtd]) => {
              const preco = tabela[servico]
                ?? tabela[servico.trim()]
                ?? (() => {
                  const lower = servico.toLowerCase()
                  const m = Object.entries(tabela).find(([k]) => k.toLowerCase() === lower)
                  return m ? m[1] : undefined
                })()
              return { servico, qtd, preco: preco ?? null }
            })

          const totalEstimado = lista.reduce((s, r) => s + (r.preco ? r.preco * r.qtd : 0), 0)

          return (
            <div className="border-t border-gray-100">
              {/* Categorias resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-gray-100">
                {[
                  { label: 'Cílios',    valor: agenda.porServico.cilios,    emoji: '👁️' },
                  { label: 'Unhas',     valor: agenda.porServico.unhas,     emoji: '💅' },
                  { label: 'Agregados', valor: agenda.porServico.agregados, emoji: '✨' },
                  { label: 'Outros',    valor: agenda.porServico.outros,    emoji: '📋' },
                ].map(({ label, valor, emoji }) => (
                  <div key={label} className="p-4 text-center border-r border-gray-100 last:border-0">
                    <p className="text-xl mb-1">{emoji}</p>
                    <p className="text-2xl font-bold text-gray-900">{valor}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Tabela por serviço */}
              {lista.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 380 }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Serviço</th>
                        <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500">Qtd</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Preço unit.</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lista.map(({ servico, qtd, preco }) => (
                        <tr key={servico} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5 text-gray-800 max-w-[200px]">
                            <span className="block truncate text-xs" title={servico}>{servico}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-gray-900">{qtd}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">
                            {preco !== null ? fmt(preco) : <span className="text-gray-300 text-xs">sem preço</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                            {preco !== null ? fmt(preco * qtd) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {totalEstimado > 0 && (
                      <tfoot>
                        <tr className="border-t border-gray-200 bg-emerald-50">
                          <td className="px-4 py-2.5 text-xs font-semibold text-emerald-700" colSpan={3}>
                            Total estimado
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                            {fmt(totalEstimado)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function AgendaPage() {
  const {
    agendaAtual, historico, metaSemanal, loading,
    tabela, loadingTabela,
    salvarAgenda, salvarMeta, salvarTabelaPrecos,
  } = useAgenda()

  const [semanaVis, setSemanaVis]         = useState<string | null>(null)
  const [metaEditando, setMetaEditando]   = useState(false)
  const [metaInput, setMetaInput]         = useState(String(metaSemanal))
  const [uploading, setUploading]         = useState(false)
  const [uploadingTabela, setUploadingTabela] = useState(false)

  const inputRef       = useRef<HTMLInputElement>(null)
  const inputTabelaRef = useRef<HTMLInputElement>(null)

  const agendaExibida = semanaVis
    ? historico.find(h => h.semanaKey === semanaVis) ?? agendaAtual
    : agendaAtual

  async function handleFile(file: File) {
    if (!file) return
    setUploading(true)
    try {
      const agendas = await parseAgendaAvec(file)
      await salvarAgenda(agendas)
      setSemanaVis(null)
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo. Verifique se é o relatório 0051 do AVEC.')
    } finally {
      setUploading(false)
    }
  }

  async function handleTabelaFile(file: File) {
    if (!file) return
    setUploadingTabela(true)
    try {
      const servicos = await parseTabelaPrecos(file)
      if (servicos.length === 0) {
        alert('Nenhum serviço encontrado no arquivo. Verifique se as colunas são: Serviço, Descrição, Categoria, Valor.')
        return
      }
      const mapa: Record<string, number> = {}
      for (const { servico, valor } of servicos) {
        mapa[servico] = valor
      }
      await salvarTabelaPrecos(mapa)
      alert(`Tabela atualizada com ${servicos.length} serviços.`)
    } catch (e) {
      console.error(e)
      alert('Erro ao processar a tabela de preços.')
    } finally {
      setUploadingTabela(false)
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

  const temTabela = tabela.totalServicos > 0

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-5 lg:px-6 lg:py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-xl font-bold text-gray-900">Agenda AVEC</h1>
          <div className="flex flex-wrap gap-2">
            <a
              href={AVEC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-white transition-colors"
            >
              Relatório ↗
            </a>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Processando...' : 'Upload agenda'}
            </button>
            <input
              ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
            />
            <button
              onClick={() => inputTabelaRef.current?.click()}
              disabled={uploadingTabela}
              title={temTabela ? `Tabela com ${tabela.totalServicos} serviços` : 'Sem tabela de preços'}
              className="px-3 py-2 text-sm border rounded-xl transition-colors disabled:opacity-50 border-gray-200 text-gray-600 hover:bg-white"
            >
              {uploadingTabela ? 'Processando...' : temTabela ? `Preços (${tabela.totalServicos})` : 'Importar preços'}
            </button>
            <input
              ref={inputTabelaRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleTabelaFile(f); e.target.value = '' }}
            />
          </div>
        </div>

        {/* Aviso sem tabela */}
        {!loadingTabela && !temTabela && agendaExibida && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-amber-500 text-lg">💡</span>
            <p className="text-sm text-amber-800">
              Importe a tabela de preços do AVEC (CSV com colunas Serviço, Descrição, Categoria, Valor) para ver estimativas de faturamento.
            </p>
          </div>
        )}

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
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600">Meta da semana:</span>
          {metaEditando ? (
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} autoFocus
                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={metaInput}
                onChange={e => setMetaInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') salvarMetaEditada() }}
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

        {/* Painel ou estado vazio */}
        {agendaExibida ? (
          <PainelAgenda
            agenda={agendaExibida}
            meta={metaSemanal}
            tabela={tabela.servicos}
            temTabela={temTabela}
          />
        ) : (
          <div
            className="border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center cursor-pointer hover:border-emerald-300 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <p className="text-gray-400 text-sm">Nenhum dado desta semana ainda.</p>
            <p className="text-gray-300 text-xs mt-1">Clique para fazer upload do relatório 0051 do AVEC.</p>
          </div>
        )}
      </div>
    </div>
  )
}
