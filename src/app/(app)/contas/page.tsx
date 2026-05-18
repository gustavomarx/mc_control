'use client'

import { useState, useMemo } from 'react'
import { useContasPagar } from '@/hooks/useContasPagar'
import { useAuth } from '@/contexts/AuthContext'
import ModalConta from '@/components/contas/ModalConta'
import ModalPagamento from '@/components/contas/ModalPagamento'
import {
  formatBRL, formatDate, statusPagamento, ultimoPagamento,
  projecao30Dias, mesAtual, contaAparece, gerarAtrasados, totalPagoPorMes,
} from '@/lib/utils'
import type { ContaPagar, TipoContaPagar } from '@/types'

type Filtro = 'todos' | 'pendente' | 'pago' | 'atrasado'
type Aba = 'lista' | 'atrasados' | 'projecao'

const MESES_NOMES = [
  'Jan','Fev','Mar','Abr','Mai','Jun',
  'Jul','Ago','Set','Out','Nov','Dez',
]

export default function ContasPage() {
  const { contas, loading, adicionar, atualizar, excluir, marcarPago } = useContasPagar()
  const { user } = useAuth()

  const { mes: mesHoje, ano: anoHoje } = mesAtual()
  const [mesVis, setMesVis] = useState(mesHoje)
  const [anoVis, setAnoVis] = useState(anoHoje)

  const [aba, setAba] = useState<Aba>('lista')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [filtroTipo, setFiltroTipo] = useState<TipoContaPagar | 'todos'>('todos')
  const [busca, setBusca] = useState('')
  const [modalNova, setModalNova] = useState(false)
  const [editando, setEditando] = useState<ContaPagar | null>(null)
  const [pagando, setPagando] = useState<{ conta: ContaPagar; mes: number; ano: number; valorRestante?: number } | null>(null)

  function navMes(delta: number) {
    let m = mesVis + delta
    let a = anoVis
    if (m > 12) { m = 1; a++ }
    if (m < 1)  { m = 12; a-- }
    setMesVis(m)
    setAnoVis(a)
  }

  const contasDoMes = useMemo(
    () => contas.filter(c => contaAparece(c, mesVis, anoVis)),
    [contas, mesVis, anoVis],
  )

  const contasFiltradas = useMemo(() => {
    return contasDoMes.filter(c => {
      const status = statusPagamento(c, mesVis, anoVis)
      if (filtro !== 'todos') {
        if (filtro === 'pendente' && status !== 'pendente' && status !== 'parcial') return false
        if (filtro !== 'pendente' && status !== filtro) return false
      }
      if (filtroTipo !== 'todos' && (c.tipo ?? 'fixo') !== filtroTipo) return false
      if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase()) &&
          !c.fornecedor.toLowerCase().includes(busca.toLowerCase())) return false
      return true
    })
  }, [contasDoMes, filtro, filtroTipo, busca, mesVis, anoVis])

  const projecao = useMemo(() => projecao30Dias(contas), [contas])
  const atrasados = useMemo(() => gerarAtrasados(contas), [contas])

  const totais = useMemo(() => {
    const pendentes = contasDoMes.filter(c => statusPagamento(c, mesVis, anoVis) !== 'pago')
    return {
      total: contasDoMes.reduce((s, c) => s + (c.valor ?? 0), 0),
      pendente: pendentes.reduce((s, c) => s + (c.valor ?? 0), 0),
      qPendente: pendentes.length,
      qAtrasado: contasDoMes.filter(c => statusPagamento(c, mesVis, anoVis) === 'atrasado').length,
    }
  }, [contasDoMes, mesVis, anoVis])

  async function handleSalvar(data: Omit<ContaPagar, 'id' | 'criadoEm' | 'historicoPagamentos'>) {
    if (editando) {
      await atualizar(editando.id, data)
      setEditando(null)
    } else {
      await adicionar(data)
    }
  }

  async function handlePagar(conta: ContaPagar, valorPago: number, mesRef: number, anoRef: number) {
    await marcarPago(conta, valorPago, user?.uid ?? '', mesRef, anoRef)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-gray-400">Carregando...</div>
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contas a Pagar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Panorama mensal</p>
        </div>
        <button onClick={() => setModalNova(true)} className="btn-primary">+ Nova conta</button>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button onClick={() => navMes(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg leading-none">‹</button>
        <div className="flex gap-1 flex-wrap">
          {MESES_NOMES.map((nome, i) => {
            const m = i + 1
            const isAtivo = m === mesVis && anoVis === anoHoje
            return (
              <button
                key={m}
                onClick={() => { setMesVis(m); setAnoVis(anoHoje) }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isAtivo ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {nome}
              </button>
            )
          })}
        </div>
        <button onClick={() => navMes(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg leading-none">›</button>
        <span className="text-sm font-semibold text-gray-700 ml-1">
          {MESES_NOMES[mesVis - 1]} {anoVis}
        </span>
        {(mesVis !== mesHoje || anoVis !== anoHoje) && (
          <button
            onClick={() => { setMesVis(mesHoje); setAnoVis(anoHoje) }}
            className="text-xs text-emerald-700 hover:underline"
          >
            Voltar ao mês atual
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Total do mês</p>
          <p className="text-lg font-semibold text-gray-900">{formatBRL(totais.total)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Pendente</p>
          <p className="text-lg font-semibold text-amber-600">
            {formatBRL(totais.pendente)}
            <span className="text-sm font-normal text-gray-400 ml-1">({totais.qPendente} contas)</span>
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Atrasadas</p>
          <p className={`text-lg font-semibold ${totais.qAtrasado > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {formatBRL(contasDoMes.filter(c => statusPagamento(c, mesVis, anoVis) === 'atrasado').reduce((s, c) => s + (c.valor ?? 0), 0))}
            <span className="text-sm font-normal text-gray-400 ml-1">({totais.qAtrasado} {totais.qAtrasado !== 1 ? 'contas' : 'conta'})</span>
          </p>
          {atrasados.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Acumulado: <span className="text-red-400 font-medium">{formatBRL(atrasados.reduce((s, { conta }) => s + (conta.valor ?? 0), 0))}</span>
              <span className="ml-1">({atrasados.length} entr{atrasados.length !== 1 ? 'adas' : 'ada'})</span>
            </p>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {(['lista', 'atrasados', 'projecao'] as Aba[]).map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              aba === a
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {a === 'lista' ? 'Todas as contas'
              : a === 'atrasados'
                ? `Atrasados${atrasados.length > 0 ? ` (${atrasados.length})` : ''}`
                : 'Projeção 30 dias'}
          </button>
        ))}
      </div>

      {aba === 'lista' && (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              className="input max-w-xs"
              placeholder="Buscar por nome ou fornecedor..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            {/* Filtro status */}
            <div className="flex gap-1">
              {(['todos', 'pendente', 'atrasado', 'pago'] as Filtro[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtro === f
                      ? f === 'atrasado' ? 'bg-red-100 text-red-700'
                        : f === 'pago' ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f === 'todos' ? 'Todos' : f === 'pendente' ? 'Pendentes' : f === 'atrasado' ? 'Atrasados' : 'Pagos'}
                </button>
              ))}
            </div>
            {/* Filtro natureza */}
            <div className="flex gap-1">
              {(['todos', 'fixo', 'variavel'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFiltroTipo(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtroTipo === t
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t === 'todos' ? 'Fixo + Variável' : t === 'fixo' ? 'Fixo' : 'Variável'}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Natureza</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vencimento</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                      Nenhuma conta encontrada.
                    </td>
                  </tr>
                )}
                {contasFiltradas.map(conta => {
                  const status = statusPagamento(conta, mesVis, anoVis)
                  const ultimo = ultimoPagamento(conta)
                  const diaStr = conta.recorrencia === 'anual'
                    ? `Anual · ${MESES_NOMES[(conta.mesAnual ?? 1) - 1]}`
                    : conta.diaVencimento > 0 ? `Dia ${conta.diaVencimento}` : 'Variável'
                  const valorStr = conta.valor
                    ? formatBRL(conta.valor)
                    : conta.percentual
                      ? `${conta.percentual}% fat.`
                      : '—'

                  const totalPago = totalPagoPorMes(conta, mesVis, anoVis)
                  const restante = conta.valor ? Math.max(0, conta.valor - totalPago) : undefined

                  return (
                    <tr key={conta.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{conta.nome}</p>
                        {conta.fornecedor && <p className="text-xs text-gray-400">{conta.fornecedor}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{conta.categoria}</td>
                      <td className="px-4 py-3">
                        <TipoBadge tipo={conta.tipo ?? 'fixo'} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">{diaStr}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{valorStr}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={status} />
                        {status === 'pago' && ultimo && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatBRL(ultimo.valorPago)} em {formatDate(ultimo.pagoEm)}
                          </p>
                        )}
                        {status === 'parcial' && restante !== undefined && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            pago {formatBRL(totalPago)} · falta {formatBRL(restante)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {status !== 'pago' && (
                            <button
                              onClick={() => setPagando({ conta, mes: mesVis, ano: anoVis, valorRestante: status === 'parcial' ? restante : undefined })}
                              className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                            >
                              Pagar
                            </button>
                          )}
                          <button
                            onClick={() => setEditando(conta)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => { if (confirm(`Excluir "${conta.nome}"?`)) excluir(conta.id) }}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === 'atrasados' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {atrasados.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma conta atrasada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Mês ref.</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {atrasados.map(({ conta, mes, ano }, i) => {
                  const valorStr = conta.valor ? formatBRL(conta.valor) : conta.percentual ? `${conta.percentual}% fat.` : '—'
                  return (
                    <tr key={`${conta.id}-${ano}-${mes}-${i}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {MESES_NOMES[mes - 1]} {ano}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{conta.nome}</p>
                        {conta.fornecedor && <p className="text-xs text-gray-400">{conta.fornecedor}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{conta.categoria}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{valorStr}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setPagando({ conta, mes, ano })}
                          className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                        >
                          Pagar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {aba === 'projecao' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vencimento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Natureza</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor estimado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {projecao.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    Sem vencimentos nos próximos 30 dias.
                  </td>
                </tr>
              )}
              {projecao.map(({ conta, vencimento }, i) => {
                const hoje = new Date(); hoje.setHours(0,0,0,0)
                const diff = Math.ceil((vencimento.getTime() - hoje.getTime()) / 86400000)
                const valorStr = conta.valor ? formatBRL(conta.valor) : conta.percentual ? `${conta.percentual}% fat.` : '—'
                return (
                  <tr key={`${conta.id}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {vencimento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </p>
                      <p className={`text-xs ${diff <= 3 ? 'text-red-500' : diff <= 7 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : `em ${diff} dias`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{conta.nome}</p>
                      {conta.fornecedor && <p className="text-xs text-gray-400">{conta.fornecedor}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{conta.categoria}</td>
                    <td className="px-4 py-3"><TipoBadge tipo={conta.tipo ?? 'fixo'} /></td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{valorStr}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modais */}
      {(modalNova || editando) && (
        <ModalConta
          conta={editando}
          onSalvar={handleSalvar}
          onFechar={() => { setModalNova(false); setEditando(null) }}
        />
      )}
      {pagando && (
        <ModalPagamento
          conta={pagando.conta}
          defaultMes={pagando.mes}
          defaultAno={pagando.ano}
          valorRestante={pagando.valorRestante}
          onConfirmar={(v, m, a) => handlePagar(pagando.conta, v, m, a)}
          onFechar={() => setPagando(null)}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: 'pago' | 'parcial' | 'atrasado' | 'pendente' }) {
  const map = {
    pago: 'bg-emerald-100 text-emerald-700',
    parcial: 'bg-orange-100 text-orange-700',
    atrasado: 'bg-red-100 text-red-700',
    pendente: 'bg-amber-100 text-amber-700',
  }
  const label = { pago: 'Pago', parcial: 'Parcial', atrasado: 'Atrasado', pendente: 'Pendente' }
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>{label[status]}</span>
}

function TipoBadge({ tipo }: { tipo: 'fixo' | 'variavel' }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
      tipo === 'fixo' ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-700'
    }`}>
      {tipo === 'fixo' ? 'Fixo' : 'Variável'}
    </span>
  )
}
