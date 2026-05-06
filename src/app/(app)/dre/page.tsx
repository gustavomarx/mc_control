'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getExtratos,
  getTransacoesByExtrato,
  getDresConfigs,
  setDreConfig,
} from '@/lib/firestore'
import { formatBRL } from '@/lib/utils'
import type { Extrato, Transacao, DreConfig } from '@/types'

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const MESES_CURTO_EXPORT = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']

function toExcelDate(ts: { toDate(): Date }): number {
  // Excel serial: days since Jan 0 1900 (with the off-by-1 leap year bug)
  return Math.floor(ts.toDate().getTime() / 86400000 + 25569)
}

function extractOrigem(desc: string): string {
  const u = (desc || '').toUpperCase()
  if (u.includes('PIX')) return 'Pix'
  if (u.includes('BOLETO')) return 'Boleto'
  if (u.includes('TED')) return 'TED'
  if (u.includes('DOC')) return 'DOC'
  if (u.includes('CHEQUE')) return 'Cheque'
  if (u.includes('TARIFA')) return 'Tarifa'
  return 'Outros'
}

function mapTipo1Contab(tipo1: string): string {
  return tipo1 === 'Receita' ? 'Receita Bruta' : tipo1
}

const GRUPOS_DRE = [
  { tipo1: 'Receita',               label: 'Receita Bruta' },
  { tipo1: 'Descontos da Receita',  label: 'Descontos da Receita' },
  { tipo1: 'Despesas Fixas',        label: 'Despesas Fixas' },
  { tipo1: 'Despesas variáveis',    label: 'Despesas Variáveis' },
  { tipo1: 'Investimento/Resgate',  label: 'Investimento / Resgate' },
]

interface GrupoDRE {
  tipo1: string
  label: string
  total: number
  linhas: { categoria: string; total: number }[]
}

function agrupar(transacoes: Transacao[]): GrupoDRE[] {
  return GRUPOS_DRE.map(g => {
    const map = new Map<string, number>()
    let total = 0
    for (const t of transacoes) {
      if (t.tipo1 === g.tipo1) {
        total += t.valor
        const key = t.categoria || 'Sem categoria'
        map.set(key, (map.get(key) ?? 0) + t.valor)
      }
    }
    return {
      tipo1: g.tipo1,
      label: g.label,
      total,
      linhas: Array.from(map.entries())
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    }
  })
}

function parseNum(s: string): number {
  return parseFloat(s) || 0
}

function valor(v: number, forcarAbs = false): string {
  return formatBRL(forcarAbs ? Math.abs(v) : v)
}

function etapaLabel(n: number) {
  return ['Informações', 'Extrato', 'DRE'][n - 1]
}

export default function DrePage() {
  const { user } = useAuth()
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)

  // step 1
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [avecPix, setAvecPix] = useState('')
  const [avecDebito, setAvecDebito] = useState('')
  const [avecCredito, setAvecCredito] = useState('')
  const [avecDinheiro, setAvecDinheiro] = useState('')

  // step 2
  const [extratos, setExtratos] = useState<Extrato[]>([])
  const [extratoId, setExtratoId] = useState<string | null>(null)
  const [carregandoExtratos, setCarregandoExtratos] = useState(false)

  // step 3
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [modalPreview, setModalPreview] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [modalContab, setModalContab] = useState(false)
  const [exportandoContab, setExportandoContab] = useState(false)

  // history
  const [historico, setHistorico] = useState<DreConfig[]>([])

  const extratoSelecionado = extratos.find(e => e.id === extratoId) ?? null
  const avecTotal = parseNum(avecPix) + parseNum(avecDebito) + parseNum(avecCredito) + parseNum(avecDinheiro)
  const grupos = agrupar(transacoes)
  const receitaBruta     = grupos.find(g => g.tipo1 === 'Receita')?.total ?? 0
  const descontos        = grupos.find(g => g.tipo1 === 'Descontos da Receita')?.total ?? 0
  const despFixas        = grupos.find(g => g.tipo1 === 'Despesas Fixas')?.total ?? 0
  const despVariaveis    = grupos.find(g => g.tipo1 === 'Despesas variáveis')?.total ?? 0
  const investimento     = grupos.find(g => g.tipo1 === 'Investimento/Resgate')?.total ?? 0
  const receitaLiquida   = receitaBruta + descontos
  const resultadoOp      = receitaLiquida + despFixas + despVariaveis
  const gapAvec          = avecTotal - receitaBruta

  useEffect(() => {
    if (etapa === 2 && extratos.length === 0) {
      setCarregandoExtratos(true)
      getExtratos().then(e => { setExtratos(e); setCarregandoExtratos(false) })
    }
  }, [etapa, extratos.length])

  useEffect(() => {
    if (etapa === 3 && extratoId) {
      setCarregando(true)
      setTransacoes([])
      getTransacoesByExtrato(extratoId).then(t => { setTransacoes(t); setCarregando(false) })
    }
  }, [etapa, extratoId])

  useEffect(() => {
    getDresConfigs().then(setHistorico)
  }, [])

  async function salvar() {
    if (!user || !extratoId) return
    setSalvando(true)
    await setDreConfig({
      id: '',
      mes, ano, extratoId,
      faturamentoAvecTotal: avecTotal,
      faturamentoAvecPix: parseNum(avecPix),
      faturamentoAvecDebito: parseNum(avecDebito),
      faturamentoAvecCredito: parseNum(avecCredito),
      faturamentoAvecDinheiro: parseNum(avecDinheiro),
      usuarioId: user.uid,
    })
    setSalvo(true)
    setSalvando(false)
    getDresConfigs().then(setHistorico)
  }

  async function carregarHistorico(cfg: DreConfig) {
    setMes(cfg.mes)
    setAno(cfg.ano)
    setAvecPix(String(cfg.faturamentoAvecPix))
    setAvecDebito(String(cfg.faturamentoAvecDebito))
    setAvecCredito(String(cfg.faturamentoAvecCredito))
    setAvecDinheiro(String(cfg.faturamentoAvecDinheiro))
    setExtratoId(cfg.extratoId)
    setSalvo(true)
    if (extratos.length === 0) {
      const e = await getExtratos()
      setExtratos(e)
    }
    setEtapa(3)
  }

  async function exportarExcel() {
    setExportando(true)
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    const rows: (string | number | null)[][] = [
      ['DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO'],
      [`${MESES[mes - 1]} / ${ano} — Studio Meus Cílios`],
      [],
      ['GRUPO', 'CATEGORIA', 'VALOR (R$)'],
    ]

    for (const g of grupos) {
      if (g.linhas.length === 0) continue
      rows.push([g.label, null, g.total])
      for (const l of g.linhas) rows.push([null, l.categoria, l.total])
      rows.push([])
    }

    rows.push(['RECEITA LÍQUIDA', null, receitaLiquida])
    rows.push(['RESULTADO OPERACIONAL', null, resultadoOp])
    rows.push([])
    rows.push(['FATURAMENTO AVEC (referência)'])
    rows.push([null, 'Pix',          parseNum(avecPix)])
    rows.push([null, 'Débito',       parseNum(avecDebito)])
    rows.push([null, 'Crédito',      parseNum(avecCredito)])
    rows.push([null, 'Dinheiro',     parseNum(avecDinheiro)])
    rows.push([null, 'Total AVEC',   avecTotal])
    rows.push([null, 'Gap (AVEC − Extrato)', gapAvec])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 35 }, { wch: 35 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws, 'DRE')
    XLSX.writeFile(wb, `DRE_${MESES[mes - 1]}_${ano}.xlsx`)
    setExportando(false)
    setModalPreview(false)
  }

  async function exportarContabilidade() {
    setExportandoContab(true)
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const mesLabel = `${MESES_CURTO_EXPORT[mes - 1]}-${String(ano).slice(-2)}`
    const banco = extratoSelecionado?.banco ?? 'Sicoob'

    const sorted = [...transacoes].sort((a, b) => a.data.toMillis() - b.data.toMillis())
    const totalEntradas = sorted.filter(t => t.valor > 0).reduce((s, t) => s + t.valor, 0)
    const totalSaidas   = sorted.filter(t => t.valor < 0).reduce((s, t) => s + t.valor, 0)

    // ── Sheet mensal ────────────────────────────────────────────────────────────
    const monthRows: (string | number | null)[][] = [
      [mesLabel, null, null, null, null, null, null],
      [null, null, 'Total entradas:', totalEntradas, null, null, null],
      [null, null, 'Total saídas:',   totalSaidas,   null, null, null],
      ['Data', 'Lançamento', 'Origem', 'Valor', 'Observação', 'Tipo1', 'Tipo2'],
    ]
    for (const t of sorted) {
      monthRows.push([
        toExcelDate(t.data),
        t.descricao,
        extractOrigem(t.descricaoOriginal),
        t.valor,
        banco,
        mapTipo1Contab(t.tipo1),
        t.categoria || 'Outros',
      ])
    }
    const wsMonth = XLSX.utils.aoa_to_sheet(monthRows)
    wsMonth['!cols'] = [
      { wch: 12 }, { wch: 52 }, { wch: 10 },
      { wch: 14 }, { wch: 12 }, { wch: 25 }, { wch: 25 },
    ]
    // Format date column as date for rows 4 onwards
    const rangeMes = XLSX.utils.decode_range(wsMonth['!ref'] ?? 'A1')
    for (let r = 4; r <= rangeMes.e.r; r++) {
      const cell = wsMonth[XLSX.utils.encode_cell({ r, c: 0 })]
      if (cell) { cell.t = 'n'; cell.z = 'DD/MM/YYYY' }
    }
    XLSX.utils.book_append_sheet(wb, wsMonth, mesLabel)

    // ── Sheet EntradaSaída ──────────────────────────────────────────────────────
    const esRows: (string | number | null)[][] = [
      ['EntradaSaída — Consolidado', null, null, null, null],
      [null, 'Total entradas:', totalEntradas, null, null],
      [null, 'Total saídas:',   totalSaidas,   null, null],
      ['Data', 'Descrição', 'Entrada', 'Saída', 'Categoria'],
    ]
    for (const t of sorted) {
      esRows.push([
        toExcelDate(t.data),
        t.descricao,
        t.valor > 0 ? t.valor : null,
        t.valor < 0 ? t.valor : null,
        t.categoria || 'Outros',
      ])
    }
    const wsES = XLSX.utils.aoa_to_sheet(esRows)
    wsES['!cols'] = [{ wch: 12 }, { wch: 52 }, { wch: 14 }, { wch: 14 }, { wch: 25 }]
    const rangeES = XLSX.utils.decode_range(wsES['!ref'] ?? 'A1')
    for (let r = 4; r <= rangeES.e.r; r++) {
      const cell = wsES[XLSX.utils.encode_cell({ r, c: 0 })]
      if (cell) { cell.t = 'n'; cell.z = 'DD/MM/YYYY' }
    }
    XLSX.utils.book_append_sheet(wb, wsES, 'EntradaSaída')

    XLSX.writeFile(wb, `Extrato_Contador_StudioMeusCilios_${mesLabel}.xlsx`)
    setExportandoContab(false)
    setModalContab(false)
  }

  const anosDisponiveis = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

  // ─── render helpers ──────────────────────────────────────────────────────────

  function pct(v: number): string {
    if (!receitaBruta) return '—'
    return (Math.abs(v) / receitaBruta * 100).toFixed(1) + '%'
  }

  function GrupoRow({ g }: { g: GrupoDRE }) {
    if (g.linhas.length === 0) return null
    const isNegativo = ['Descontos da Receita', 'Despesas Fixas', 'Despesas variáveis'].includes(g.tipo1)
    const isInvest = g.tipo1 === 'Investimento/Resgate'
    return (
      <div className="mb-1">
        <div className={`flex items-center px-4 py-2 rounded-t gap-3 ${isInvest ? 'bg-gray-100' : isNegativo ? 'bg-red-50' : 'bg-green-50'}`}>
          <span className={`flex-1 text-xs font-bold uppercase tracking-wide ${isNegativo ? 'text-red-700' : isInvest ? 'text-gray-600' : 'text-green-700'}`}>
            {isNegativo ? '(−) ' : ''}{g.label}
          </span>
          <span className={`text-xs tabular-nums w-14 text-right ${isNegativo ? 'text-red-400' : isInvest ? 'text-gray-400' : 'text-green-500'}`}>
            {pct(g.total)}
          </span>
          <span className={`text-sm font-bold tabular-nums w-32 text-right ${isNegativo ? 'text-red-700' : isInvest ? 'text-gray-700' : 'text-green-700'}`}>
            {isNegativo ? `(${valor(g.total, true)})` : valor(g.total)}
          </span>
        </div>
        <div className="border border-t-0 rounded-b divide-y">
          {g.linhas.map(l => (
            <div key={l.categoria} className="flex items-center px-4 py-1.5 bg-white gap-3">
              <span className="flex-1 text-xs text-gray-600">{l.categoria}</span>
              <span className="text-xs tabular-nums w-14 text-right text-gray-400">{pct(l.total)}</span>
              <span className={`text-xs tabular-nums w-32 text-right ${l.total < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                {l.total < 0 ? `(${valor(l.total, true)})` : valor(l.total)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function SubtotalRow({ label, valor: v, destaque }: { label: string; valor: number; destaque?: boolean }) {
    const pos = v >= 0
    return (
      <div className={`flex items-center px-4 py-3 rounded my-2 gap-3 ${destaque ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-100 border border-gray-200'}`}>
        <span className={`flex-1 text-sm font-bold ${destaque ? 'text-indigo-800' : 'text-gray-700'}`}>{label}</span>
        <span className={`text-xs tabular-nums w-14 text-right ${destaque ? 'text-indigo-400' : 'text-gray-400'}`}>{pct(v)}</span>
        <span className={`text-base font-bold tabular-nums w-32 text-right ${destaque ? (pos ? 'text-indigo-700' : 'text-red-600') : (pos ? 'text-gray-800' : 'text-red-600')}`}>
          {pos ? formatBRL(v) : `(${formatBRL(Math.abs(v))})`}
        </span>
      </div>
    )
  }

  // ─── preview DRE (compartilhado entre tela e modal) ──────────────────────────

  function DREView() {
    return (
      <div>
        <GrupoRow g={grupos.find(g => g.tipo1 === 'Receita')!} />
        <GrupoRow g={grupos.find(g => g.tipo1 === 'Descontos da Receita')!} />
        <SubtotalRow label="= Receita Líquida" valor={receitaLiquida} />
        <GrupoRow g={grupos.find(g => g.tipo1 === 'Despesas Fixas')!} />
        <GrupoRow g={grupos.find(g => g.tipo1 === 'Despesas variáveis')!} />
        <SubtotalRow label="= Resultado Operacional" valor={resultadoOp} destaque />
        <GrupoRow g={grupos.find(g => g.tipo1 === 'Investimento/Resgate')!} />
      </div>
    )
  }

  // ─── steps ────────────────────────────────────────────────────────────────────

  function Step1() {
    const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
    const labelCls = 'block text-xs font-medium text-gray-600 mb-1'
    return (
      <div className="max-w-lg mx-auto px-8 py-8">
        <h2 className="text-base font-semibold text-gray-800 mb-6">Informações do mês</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className={labelCls}>Mês</label>
            <select className={inputCls} value={mes} onChange={e => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Ano</label>
            <select className={inputCls} value={ano} onChange={e => setAno(Number(e.target.value))}>
              {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div className="border-t pt-6 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Faturamento AVEC</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Pix', state: avecPix, set: setAvecPix },
              { label: 'Débito', state: avecDebito, set: setAvecDebito },
              { label: 'Crédito', state: avecCredito, set: setAvecCredito },
              { label: 'Dinheiro', state: avecDinheiro, set: setAvecDinheiro },
            ].map(f => (
              <div key={f.label}>
                <label className={labelCls}>{f.label}</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className={inputCls}
                  value={f.state}
                  onChange={e => f.set(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between items-center bg-gray-50 border rounded px-4 py-2">
            <span className="text-xs font-medium text-gray-600">Total AVEC</span>
            <span className="text-sm font-bold text-gray-800 tabular-nums">{formatBRL(avecTotal)}</span>
          </div>
        </div>

        <button
          onClick={() => setEtapa(2)}
          className="w-full bg-indigo-600 text-white text-sm font-medium py-2.5 rounded hover:bg-indigo-700 transition"
        >
          Próximo →
        </button>
      </div>
    )
  }

  function Step2() {
    return (
      <div className="px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEtapa(1)} className="text-xs text-gray-500 hover:text-gray-800">← Voltar</button>
          <h2 className="text-base font-semibold text-gray-800">Selecione o extrato</h2>
        </div>

        {carregandoExtratos ? (
          <p className="text-sm text-gray-400">Carregando extratos...</p>
        ) : extratos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum extrato salvo. Faça o upload na aba Extrato primeiro.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {extratos.map(e => {
              const selecionado = extratoId === e.id
              return (
                <button
                  key={e.id}
                  onClick={() => setExtratoId(e.id)}
                  className={`text-left border rounded-lg p-4 transition ${selecionado ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400' : 'border-gray-200 hover:border-gray-400 bg-white'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-semibold ${selecionado ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {MESES[e.mes - 1]} {e.ano}
                    </span>
                    <span className="text-xs text-gray-400">{e.banco}</span>
                  </div>
                  <div className="text-xs text-gray-500">{e.totalLancamentos} lançamentos</div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                    <div className="text-green-700">↑ {formatBRL(e.totalEntradas)}</div>
                    <div className="text-red-600">↓ {formatBRL(e.totalSaidas)}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <button
          disabled={!extratoId}
          onClick={() => { setSalvo(false); setEtapa(3) }}
          className="bg-indigo-600 text-white text-sm font-medium px-6 py-2.5 rounded hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Gerar DRE →
        </button>
      </div>
    )
  }

  function Step3() {
    return (
      <div className="px-8 py-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setEtapa(2)} className="text-xs text-gray-500 hover:text-gray-800">← Voltar</button>
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                DRE — {MESES[mes - 1]} {ano}
              </h2>
              {extratoSelecionado && (
                <p className="text-xs text-gray-500">
                  Extrato: {extratoSelecionado.banco} · {MESES[extratoSelecionado.mes - 1]} {extratoSelecionado.ano} · {extratoSelecionado.totalLancamentos} lançamentos
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={salvar}
              disabled={salvando || salvo}
              className={`text-sm font-medium px-4 py-2 rounded border transition ${salvo ? 'border-green-400 text-green-600 bg-green-50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {salvando ? 'Salvando...' : salvo ? '✓ Salvo' : 'Salvar DRE'}
            </button>
            <button
              onClick={() => setModalPreview(true)}
              className="text-sm font-medium px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              Exportar DRE
            </button>
            <button
              onClick={() => setModalContab(true)}
              disabled={transacoes.length === 0}
              className="text-sm font-medium px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Exportar Contabilidade
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Receita Bruta', v: receitaBruta, color: 'text-green-700' },
            { label: 'Receita Líquida', v: receitaLiquida, color: 'text-blue-700' },
            { label: 'Resultado Operacional', v: resultadoOp, color: resultadoOp >= 0 ? 'text-indigo-700' : 'text-red-600' },
            { label: 'Gap AVEC vs Extrato', v: gapAvec, color: Math.abs(gapAvec) < 100 ? 'text-gray-600' : 'text-orange-600' },
          ].map(k => (
            <div key={k.label} className="bg-white border rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">{k.label}</p>
              <p className={`text-sm font-bold tabular-nums ${k.color}`}>{formatBRL(k.v)}</p>
            </div>
          ))}
        </div>

        {/* Faturamento AVEC */}
        {avecTotal > 0 && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 mb-2">Faturamento AVEC (referência)</p>
            <div className="grid grid-cols-4 gap-3 text-xs text-gray-700">
              {[
                { l: 'Pix', v: parseNum(avecPix) },
                { l: 'Débito', v: parseNum(avecDebito) },
                { l: 'Crédito', v: parseNum(avecCredito) },
                { l: 'Dinheiro', v: parseNum(avecDinheiro) },
              ].map(f => (
                <div key={f.l}>
                  <span className="text-gray-500">{f.l}: </span>
                  <span className="font-medium tabular-nums">{formatBRL(f.v)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-amber-200 pt-2">
              <span className="text-xs font-semibold text-amber-700">Total AVEC</span>
              <span className="text-xs font-bold tabular-nums text-amber-800">{formatBRL(avecTotal)}</span>
            </div>
          </div>
        )}

        {/* DRE */}
        {carregando ? (
          <p className="text-sm text-gray-400 py-8 text-center">Carregando lançamentos...</p>
        ) : (
          <div className="max-w-2xl">
            {DREView()}
          </div>
        )}
      </div>
    )
  }

  // ─── Stepper ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-8 py-5">
        <h1 className="text-lg font-semibold text-gray-900">DRE Mensal</h1>
        <p className="text-xs text-gray-500">Demonstrativo de Resultado do Exercício</p>
      </div>

      {/* Stepper bar */}
      <div className="border-b bg-gray-50 px-8 py-3">
        <div className="flex items-center gap-2">
          {([1, 2, 3] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${etapa > s ? 'bg-green-500 text-white' : etapa === s ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {etapa > s ? '✓' : s}
              </div>
              <span className={`text-xs ${etapa === s ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>{etapaLabel(s)}</span>
              {i < 2 && <div className="w-8 h-px bg-gray-300 mx-1" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto">
        {etapa === 1 && Step1()}
        {etapa === 2 && Step2()}
        {etapa === 3 && Step3()}
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="border-t bg-gray-50 px-8 py-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">DREs Salvos</p>
          <div className="flex flex-wrap gap-2">
            {historico.map(cfg => (
              <button
                key={cfg.id}
                onClick={() => carregarHistorico(cfg)}
                className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition"
              >
                {MESES[cfg.mes - 1]} {cfg.ano}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal de pré-visualização */}
      {modalPreview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Pré-visualização</h3>
                <p className="text-xs text-gray-500">DRE — {MESES[mes - 1]} {ano} · Studio Meus Cílios</p>
              </div>
              <button onClick={() => setModalPreview(false)} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-4">
              {/* KPIs resumo */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Receita Bruta', v: receitaBruta },
                  { label: 'Receita Líquida', v: receitaLiquida },
                  { label: 'Resultado', v: resultadoOp },
                ].map(k => (
                  <div key={k.label} className="bg-gray-50 border rounded p-3 text-center">
                    <p className="text-xs text-gray-500">{k.label}</p>
                    <p className={`text-sm font-bold tabular-nums mt-1 ${k.v >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{formatBRL(k.v)}</p>
                  </div>
                ))}
              </div>

              {DREView()}

              {avecTotal > 0 && (
                <div className="mt-4 border rounded p-3 bg-amber-50">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Faturamento AVEC</p>
                  <div className="flex justify-between text-xs text-gray-700">
                    <span>Total AVEC</span><span className="font-medium">{formatBRL(avecTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-700 mt-1">
                    <span>Receita no Extrato</span><span className="font-medium">{formatBRL(receitaBruta)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-orange-700 mt-1 border-t border-amber-200 pt-1">
                    <span>Gap</span><span>{formatBRL(gapAvec)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setModalPreview(false)} className="text-sm text-gray-600 px-4 py-2 border rounded hover:bg-gray-50">
                Fechar
              </button>
              <button
                onClick={exportarExcel}
                disabled={exportando}
                className="text-sm font-medium px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
              >
                {exportando ? 'Gerando...' : '↓ Exportar Excel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Exportar Contabilidade */}
      {modalContab && (() => {
        const sorted = [...transacoes].sort((a, b) => a.data.toMillis() - b.data.toMillis())
        const totalEntradas = sorted.filter(t => t.valor > 0).reduce((s, t) => s + t.valor, 0)
        const totalSaidas   = sorted.filter(t => t.valor < 0).reduce((s, t) => s + t.valor, 0)
        const mesLabel = `${MESES_CURTO_EXPORT[mes - 1]}-${String(ano).slice(-2)}`
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Pré-visualização — Contabilidade</h3>
                  <p className="text-xs text-gray-500">
                    {mesLabel} · Studio Meus Cílios · {sorted.length} lançamentos
                  </p>
                </div>
                <button onClick={() => setModalContab(false)} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
              </div>

              {/* Totais */}
              <div className="px-6 py-3 border-b bg-gray-50 flex gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Total entradas: </span>
                  <span className="font-semibold text-green-700 tabular-nums">{formatBRL(totalEntradas)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total saídas: </span>
                  <span className="font-semibold text-red-600 tabular-nums">{formatBRL(totalSaidas)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Saldo: </span>
                  <span className={`font-semibold tabular-nums ${totalEntradas + totalSaidas >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                    {formatBRL(totalEntradas + totalSaidas)}
                  </span>
                </div>
              </div>

              {/* Tabela */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-100 border-b">
                    <tr>
                      {['Data','Lançamento','Origem','Valor','Tipo1','Tipo2'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sorted.map(t => {
                      const d = t.data.toDate()
                      const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
                      return (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 tabular-nums text-gray-500 whitespace-nowrap">{dateStr}</td>
                          <td className="px-3 py-1.5 text-gray-800 max-w-xs truncate" title={t.descricao}>{t.descricao}</td>
                          <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{extractOrigem(t.descricaoOriginal)}</td>
                          <td className={`px-3 py-1.5 tabular-nums font-medium whitespace-nowrap text-right ${t.valor >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {formatBRL(t.valor)}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{mapTipo1Contab(t.tipo1)}</td>
                          <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{t.categoria || 'Outros'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t flex justify-end gap-3">
                <button onClick={() => setModalContab(false)} className="text-sm text-gray-600 px-4 py-2 border rounded hover:bg-gray-50">
                  Fechar
                </button>
                <button
                  onClick={exportarContabilidade}
                  disabled={exportandoContab}
                  className="text-sm font-medium px-5 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {exportandoContab ? 'Gerando...' : '↓ Exportar xlsx'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
