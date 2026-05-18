'use client'

import Link from 'next/link'
import { useDashboard } from '@/hooks/useDashboard'
import { useComissoes } from '@/hooks/useComissoes'
import { useCaixa } from '@/hooks/useCaixa'
import { useTarefas } from '@/hooks/useTarefas'
import { useCrm } from '@/hooks/useCrm'
import { formatBRL } from '@/lib/utils'

const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const PRIORIDADE_COR: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700',
  alta:    'bg-amber-100 text-amber-700',
  normal:  'bg-blue-100 text-blue-700',
  baixa:   'bg-gray-100 text-gray-500',
}
const FORMA_BARRA: Record<string, string> = {
  'Cartão Crédito': 'bg-purple-400',
  'Cartão Débito':  'bg-blue-400',
  'Pix':            'bg-emerald-400',
  'Dinheiro':       'bg-yellow-400',
}

function formatarPeriodo(inicio: string, fim: string) {
  const f = (s: string) => s.split('-').reverse().join('/')
  return `${f(inicio)} – ${f(fim)}`
}

function formatarDataUpload(ts: { toDate(): Date } | undefined): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Retorna segunda e domingo da semana atual
function semanaAtual(): { seg: Date; dom: Date } {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dow = hoje.getDay()
  const diffSeg = dow === 0 ? -6 : 1 - dow
  const seg = new Date(hoje); seg.setDate(hoje.getDate() + diffSeg)
  const dom = new Date(seg); dom.setDate(seg.getDate() + 6)
  return { seg, dom }
}

export default function HomePage() {
  const { saldoPJ, gap, totaisJanela, totaisMes, loadingContas, loadingSaldo, mes, ano } = useDashboard()
  const { atual: comissoesAtual, loading: loadingComissoes } = useComissoes()
  const { atual: caixaAtual, loading: loadingCaixa } = useCaixa()
  const { tarefas, loading: loadingTarefas } = useTarefas()
  const { aniversariantes, loadingAniv } = useCrm()

  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const diaAtual = hoje.getDate()
  const hora = hoje.getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  // Tarefas pendentes de hoje
  const tarefasPendentes = tarefas.filter(t => {
    if (t.concluida) return false
    const entrega = t.dataEntrega.toDate()
    return entrega.getFullYear() === hoje.getFullYear() &&
      entrega.getMonth() === hoje.getMonth() &&
      entrega.getDate() === hoje.getDate()
  })

  // Top 3 profissionais por valor a pagar
  const top3Comissoes = comissoesAtual
    ? [...comissoesAtual.profissionais]
        .sort((a, b) => b.aPagar - a.aPagar)
        .slice(0, 3)
    : []

  // Aniversariantes da semana atual
  const { seg, dom } = semanaAtual()
  const anivDaSemana = aniversariantes.filter(a => {
    const parts = a.dataNascimento.split('/')
    if (parts.length < 2) return false
    const dia = parseInt(parts[0], 10)
    const mes = parseInt(parts[1], 10)
    // Monta a data de aniversário no ano atual para comparar com a semana
    const anivEsteAno = new Date(hoje.getFullYear(), mes - 1, dia)
    return anivEsteAno >= seg && anivEsteAno <= dom
  }).sort((a, b) => {
    const diaA = parseInt(a.dataNascimento.split('/')[0], 10)
    const diaB = parseInt(b.dataNascimento.split('/')[0], 10)
    return diaA - diaB
  })

  const semanaLabel = `${seg.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${dom.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`

  const gapPositivo = gap >= 0

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-5 lg:px-6 lg:py-8">

        {/* Cabeçalho */}
        <div className="mb-5 lg:mb-7">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{saudacao} 👋</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Grade principal: 1 col mobile / 3 col desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

          {/* ── Financeiro (2 colunas) ── */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 lg:p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900">Financeiro</p>
              <Link href="/dashboard" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Ver →</Link>
            </div>

            {loadingContas || loadingSaldo ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Saldo PJ</p>
                  <p className="text-lg font-bold text-gray-900">{formatBRL(saldoPJ)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Gap saldo − priorizados</p>
                  <p className={`text-lg font-bold ${gapPositivo ? 'text-emerald-600' : 'text-red-600'}`}>
                    {gapPositivo ? '+' : ''}{formatBRL(gap)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">A pagar (priorizados)</p>
                  <p className="text-lg font-semibold text-amber-600">{formatBRL(totaisJanela.priorizado)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{totaisJanela.qPriorizado} de {totaisJanela.qPendente} pendentes</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Custo fixo / mês</p>
                  <p className="text-lg font-semibold text-gray-900">{formatBRL(totaisMes.custoFixo)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{MESES_NOMES[mes - 1]} {ano}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Tarefas ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 lg:p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900">Tarefas pendentes</p>
              <Link href="/tarefas" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Ver →</Link>
            </div>

            {loadingTarefas ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : tarefasPendentes.length === 0 ? (
              <p className="text-xs text-gray-400 flex-1 flex items-center">Sem tarefas para hoje — ou todas foram concluídas 🎉</p>
            ) : (
              <ul className="space-y-2 flex-1">
                {tarefasPendentes.map(t => {
                  const entrega = t.dataEntrega.toDate()
                  const atrasada = entrega < hoje
                  return (
                    <li key={t.id} className="flex items-start gap-2">
                      <span className={`mt-0.5 shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORIDADE_COR[t.prioridade] ?? PRIORIDADE_COR.normal}`}>
                        {t.prioridade}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{t.titulo}</p>
                        <p className={`text-[10px] ${atrasada ? 'text-red-400' : 'text-gray-400'}`}>
                          {entrega.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          {atrasada ? ' · atrasada' : ''}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

          </div>

          {/* ── Comissões ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">Comissões</p>
              <Link href="/comissoes" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Ver →</Link>
            </div>

            {loadingComissoes ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : !comissoesAtual ? (
              <p className="text-xs text-gray-400">Nenhum dado disponível.</p>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs text-gray-400">{formatarPeriodo(comissoesAtual.periodoInicio, comissoesAtual.periodoFim)}</p>
                  <p className="text-sm font-bold text-amber-600">{formatBRL(comissoesAtual.totalAPagar)}</p>
                </div>
                <div className="space-y-1.5">
                  {top3Comissoes.map((p, i) => (
                    <div key={p.nome} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-4 shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-700 truncate">{p.nome}</p>
                          <p className="text-xs font-medium text-gray-900 ml-2 shrink-0">{formatBRL(p.aPagar)}</p>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1 mt-0.5">
                          <div className="h-1 rounded-full bg-amber-400" style={{ width: `${comissoesAtual.totalAPagar > 0 ? (p.aPagar / comissoesAtual.totalAPagar) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400">Atualizado {formatarDataUpload(comissoesAtual.uploadEm)}</p>
              </div>
            )}
          </div>

          {/* ── Caixa ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">Caixa</p>
              <Link href="/caixa" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Ver →</Link>
            </div>

            {loadingCaixa ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : !caixaAtual ? (
              <p className="text-xs text-gray-400">Nenhum dado disponível.</p>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs text-gray-400">{formatarPeriodo(caixaAtual.periodoInicio, caixaAtual.periodoFim)}</p>
                  <p className="text-sm font-bold text-emerald-700">{caixaAtual.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="space-y-1.5">
                  {caixaAtual.formas.map(f => (
                    <div key={f.nome}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-gray-600">{f.nome}</span>
                        <span className="text-xs font-medium text-gray-700">{f.percentual.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${FORMA_BARRA[f.nome] ?? 'bg-gray-400'}`} style={{ width: `${f.percentual}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400">Atualizado {formatarDataUpload(caixaAtual.uploadEm)}</p>
              </div>
            )}
          </div>

          {/* ── Aniversariantes da semana ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-900">Aniversariantes</p>
              <Link href="/crm" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Ver →</Link>
            </div>
            <p className="text-xs text-gray-400 mb-2">{semanaLabel}</p>

            {loadingAniv ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : anivDaSemana.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhum aniversariante esta semana.</p>
            ) : (
              <ul className="space-y-1 overflow-y-auto max-h-40">
                {anivDaSemana.map(a => {
                  const dia = parseInt(a.dataNascimento.split('/')[0], 10)
                  const isHoje = dia === diaAtual && parseInt(a.dataNascimento.split('/')[1], 10) === mesAtual
                  return (
                    <li key={a.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isHoje ? 'bg-amber-50 border border-amber-200' : 'hover:bg-gray-50'}`}>
                      <span className="text-xs">{isHoje ? '🎂' : '🎁'}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium truncate ${isHoje ? 'text-amber-800' : 'text-gray-800'}`}>{a.nome}</p>
                        <p className="text-[10px] text-gray-400">{a.dataNascimento.slice(0, 5)}{isHoje ? ' · Hoje!' : ''}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
