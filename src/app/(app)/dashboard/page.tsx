'use client'

import { useState, useRef } from 'react'
import { useDashboard } from '@/hooks/useDashboard'
import { useAuth } from '@/contexts/AuthContext'
import { useContasPagar } from '@/hooks/useContasPagar'
import ModalPagamento from '@/components/contas/ModalPagamento'
import { formatBRL, formatDate, statusPagamento, ultimoPagamento } from '@/lib/utils'
import type { ContaPagar } from '@/types'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function DashboardPage() {
  const { janela, saldoPJ, salvarSaldoPJ, prioridades, togglePrioridade, loadingContas, loadingSaldo, loadingPrioridades, config, totaisJanela, totaisMes, gap, mes, ano } = useDashboard()
  const { marcarPago } = useContasPagar()
  const { user } = useAuth()
  const [pagando, setPagando] = useState<{ conta: ContaPagar; mes: number; ano: number } | null>(null)

  // Saldo PJ inline edit
  const [editandoSaldo, setEditandoSaldo] = useState(false)
  const [saldoInput, setSaldoInput] = useState('')
  const saldoRef = useRef<HTMLInputElement>(null)

  function iniciarEdicaoSaldo() {
    setSaldoInput(saldoPJ.toFixed(2))
    setEditandoSaldo(true)
    setTimeout(() => saldoRef.current?.select(), 0)
  }

  async function confirmarSaldo() {
    const v = parseFloat(saldoInput.replace(',', '.'))
    if (!isNaN(v)) await salvarSaldoPJ(v)
    setEditandoSaldo(false)
  }

  function onSaldoKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') confirmarSaldo()
    if (e.key === 'Escape') setEditandoSaldo(false)
  }

  // Janela: seg semana passada → dom semana atual
  const hoje = new Date()
  const dow = hoje.getDay()
  const diffSeg = dow === 0 ? -6 : 1 - dow
  const segundaAtual = new Date(hoje); segundaAtual.setDate(hoje.getDate() + diffSeg)
  const segundaPassada = new Date(segundaAtual); segundaPassada.setDate(segundaAtual.getDate() - 7)
  const domingoAtual = new Date(segundaAtual); domingoAtual.setDate(segundaAtual.getDate() + 6)
  const janelaLabel = `${segundaPassada.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${domingoAtual.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`

  // Semana atual: seg → dom
  const semanaLabel = `${segundaAtual.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${domingoAtual.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`

  function isSemanaPast(vencimento: Date): boolean {
    return vencimento < segundaAtual
  }

  if (loadingContas || loadingSaldo || loadingPrioridades) {
    return <div className="flex items-center justify-center h-64 text-sm text-gray-400">Carregando...</div>
  }

  const gapPositivo = gap >= 0

  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{MESES_NOMES[mes - 1]} {ano}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        {/* Saldo PJ */}
        <div className="card">
          <p className="text-xs text-gray-500 mb-2">Saldo PJ</p>
          {editandoSaldo ? (
            <input
              ref={saldoRef}
              className="w-full text-xl font-bold text-gray-900 border-b-2 border-emerald-500 outline-none bg-transparent pb-0.5"
              value={saldoInput}
              onChange={e => setSaldoInput(e.target.value)}
              onBlur={confirmarSaldo}
              onKeyDown={onSaldoKeyDown}
              type="number"
              step="0.01"
            />
          ) : (
            <button
              onClick={iniciarEdicaoSaldo}
              className="text-xl font-bold text-gray-900 hover:text-emerald-700 transition-colors text-left w-full"
              title="Clique para editar"
            >
              {formatBRL(saldoPJ)}
            </button>
          )}
          <p className="text-xs text-gray-400 mt-1">Clique para atualizar</p>
        </div>

        {/* Priorizado */}
        <div className="card">
          <p className="text-xs text-gray-500 mb-2">A pagar (priorizados)</p>
          <p className="text-xl font-semibold text-amber-600">{formatBRL(totaisJanela.priorizado)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {totaisJanela.qPriorizado} priorizad{totaisJanela.qPriorizado !== 1 ? 'os' : 'o'} de {totaisJanela.qPendente} pendentes
          </p>
        </div>

        {/* Gap */}
        <div className="card">
          <p className="text-xs text-gray-500 mb-2">Gap saldo − priorizados</p>
          <p className={`text-xl font-bold ${gapPositivo ? 'text-emerald-600' : 'text-red-600'}`}>
            {gapPositivo ? '+' : ''}{formatBRL(gap)}
          </p>
          <p className={`text-xs mt-1 ${gapPositivo ? 'text-emerald-500' : 'text-red-400'}`}>
            {gapPositivo ? 'Saldo suficiente' : 'Saldo insuficiente'}
          </p>
        </div>

        {/* Custo fixo */}
        <div className="card">
          <p className="text-xs text-gray-500 mb-2">Custo fixo / mês</p>
          <p className="text-xl font-semibold text-gray-900">{formatBRL(totaisMes.custoFixo)}</p>
          {config && (
            <p className="text-xs text-gray-400 mt-1">
              PE {formatBRL(config.pontoEquilibrio)} · Meta {formatBRL(config.metaOperacional)}
            </p>
          )}
        </div>
      </div>

      {/* Tabela de contas — janela 2 semanas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Contas — últimas 2 semanas</p>
            <p className="text-xs text-gray-400 mt-0.5">{janelaLabel} · Semana atual: {semanaLabel}</p>
          </div>
          {totaisJanela.qPriorizado > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-1 rounded-full">
              {totaisJanela.qPriorizado} priorizad{totaisJanela.qPriorizado !== 1 ? 'os' : 'o'}
            </span>
          )}
        </div>

        {janela.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma conta neste período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 w-8" title="Prioridade" />
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vencimento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {janela.map(({ conta, vencimento }) => {
                const m = vencimento.getMonth() + 1
                const a = vencimento.getFullYear()
                const status = statusPagamento(conta, m, a)
                const ultimo = ultimoPagamento(conta)
                const isHoje = vencimento.toDateString() === hoje.toDateString()
                const isPast = isSemanaPast(vencimento)
                const isPrioridade = prioridades.has(conta.id)
                const diaLabel = `${DIAS_SEMANA[vencimento.getDay()]}, ${vencimento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`

                return (
                  <tr
                    key={`${conta.id}-${vencimento.toISOString().slice(0,10)}`}
                    className={`hover:bg-gray-50 transition-colors ${isPast && status !== 'pago' ? 'bg-red-50/40' : ''} ${isPrioridade && status !== 'pago' ? 'bg-amber-50/60' : ''}`}
                  >
                    {/* Botão prioridade */}
                    <td className="px-4 py-3 text-center">
                      {status !== 'pago' && (
                        <button
                          onClick={() => togglePrioridade(conta.id)}
                          title={isPrioridade ? 'Remover prioridade' : 'Marcar como prioridade'}
                          className={`text-base transition-colors ${isPrioridade ? 'text-amber-500 hover:text-amber-300' : 'text-gray-200 hover:text-amber-400'}`}
                        >
                          ★
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${isHoje ? 'font-semibold text-amber-600' : isPast ? 'text-red-500' : 'text-gray-700'}`}>
                        {diaLabel}{isHoje ? ' · Hoje' : ''}
                      </span>
                      {isPast && status !== 'pago' && (
                        <span className="ml-1 text-xs text-red-400">semana passada</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{conta.nome}</p>
                      {conta.fornecedor && <p className="text-xs text-gray-400">{conta.fornecedor}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{conta.categoria}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {conta.valor ? formatBRL(conta.valor) : conta.percentual ? `${conta.percentual}% fat.` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={status} />
                      {status === 'pago' && ultimo && (
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(ultimo.pagoEm)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status !== 'pago' && (
                        <button
                          onClick={() => setPagando({ conta, mes: m, ano: a })}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          Pagar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {pagando && (
        <ModalPagamento
          conta={pagando.conta}
          defaultMes={pagando.mes}
          defaultAno={pagando.ano}
          onConfirmar={async (v, m, a) => {
            await marcarPago(pagando.conta, v, user?.uid ?? '', m, a)
          }}
          onFechar={() => setPagando(null)}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: 'pago' | 'atrasado' | 'pendente' }) {
  const map = { pago: 'bg-emerald-100 text-emerald-700', atrasado: 'bg-red-100 text-red-700', pendente: 'bg-amber-100 text-amber-700' }
  const label = { pago: 'Pago', atrasado: 'Atrasado', pendente: 'Pendente' }
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>{label[status]}</span>
}
