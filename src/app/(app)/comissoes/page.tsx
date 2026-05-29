'use client'

import { useState, useRef } from 'react'
import { useComissoes } from '@/hooks/useComissoes'
import { parseComissoes } from '@/lib/parse-comissoes'
import type { Comissoes, ComissaoProfissional } from '@/types'
import { Timestamp } from 'firebase/firestore'

const AVEC_URL = 'https://admin.avec.beauty/admin/relatorio/0123'

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_FULL  = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function formatarPeriodo(inicio: string, fim: string): string {
  const [ai, mi, di] = inicio.split('-')
  const [af, mf, df] = fim.split('-')
  return `${di}/${mi}/${ai} → ${df}/${mf}/${af}`
}

// "Março 2026" se cobre o mesmo mês, senão "DD/MM → DD/MM/YY"
function labelPeriodo(inicio: string, fim: string): string {
  const [ai, mi] = inicio.split('-')
  const [af, mf] = fim.split('-')
  if (ai === af && mi === mf)
    return `${MESES_FULL[parseInt(mi) - 1]} ${ai}`
  return formatarPeriodo(inicio, fim)
}

// Versão curta para pills: "Mar/26"
function labelCurta(inicio: string, fim: string): string {
  const [ai, mi] = inicio.split('-')
  const [af, mf] = fim.split('-')
  if (ai === af && mi === mf)
    return `${MESES_ABREV[parseInt(mi) - 1]}/${ai.slice(2)}`
  const [,, di] = inicio.split('-')
  const [,,df]  = fim.split('-')
  return `${di}/${mi} → ${df}/${mf}`
}

const MEDALHAS = ['🥇', '🥈', '🥉']

function quedaPercentual(atual: number, anterior: number): number | null {
  if (!anterior || anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

interface ModalPeriodoProps {
  onConfirmar: (inicio: string, fim: string) => void
  onCancelar: () => void
}

function ModalPeriodo({ onConfirmar, onCancelar }: ModalPeriodoProps) {
  const hoje = new Date()
  // Padrão: mês atual
  const [ano, setAno]  = useState(hoje.getFullYear())
  const [mes, setMes]  = useState(hoje.getMonth()) // 0-indexed

  function diasNoMes(a: number, m: number) {
    return new Date(a, m + 1, 0).getDate()
  }

  function confirmar() {
    const mm    = String(mes + 1).padStart(2, '0')
    const inicio = `${ano}-${mm}-01`
    const fim    = `${ano}-${mm}-${String(diasNoMes(ano, mes)).padStart(2, '0')}`
    onConfirmar(inicio, fim)
  }

  const mesesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const anos = [hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">A qual mês pertence este arquivo?</h2>
        <p className="text-xs text-gray-500 mb-4">
          Cada importação corresponde a um mês fechado.<br />
          O relatório 0123 agrega o período inteiro — importe um arquivo por mês.
        </p>
        <div className="flex gap-2">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {mesesNomes.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancelar} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          <button
            onClick={confirmar}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

interface TabelaProps {
  dados: Comissoes
  anterior: Comissoes | null
}

function TabelaComissoes({ dados, anterior }: TabelaProps) {
  const semAtendimento = dados.profissionais.filter(p => p.faturado === 0)
  const comAtendimento = dados.profissionais.filter(p => p.faturado > 0)

  const mapaAnterior = anterior
    ? Object.fromEntries(anterior.profissionais.map(p => [p.nome, p.faturado]))
    : {}

  function badgeQueda(prof: ComissaoProfissional) {
    const ant = mapaAnterior[prof.nome]
    if (ant === undefined) return null
    const pct = quedaPercentual(prof.faturado, ant)
    if (pct === null || pct >= -30) return null
    return (
      <span className="ml-1.5 text-xs font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
        ⚠️ Queda {Math.abs(pct).toFixed(0)}%
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 520 }}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 w-8">#</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-gray-500">Nome</th>
                <th className="text-right px-3 py-3 text-xs font-medium text-gray-500">Faturado</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-28">% total</th>
                <th className="text-right px-3 py-3 text-xs font-medium text-gray-500">A Pagar</th>
                <th className="text-right px-3 py-3 text-xs font-medium text-gray-500">Valor Casa</th>
              </tr>
            </thead>
            <tbody>
              {comAtendimento.map((prof, i) => (
                <tr key={`${prof.nome}-${i}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-center text-sm">
                    {i < 3 ? MEDALHAS[i] : <span className="text-xs text-gray-400">{i + 1}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-medium text-gray-900 whitespace-nowrap">
                      {prof.nome.split(' ')[0]}
                    </span>
                    {badgeQueda(prof)}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900 whitespace-nowrap">{moeda(prof.faturado)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5" style={{ minWidth: 40 }}>
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{ width: `${prof.percentualTotal}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-7 text-right shrink-0">{prof.percentualTotal.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700 whitespace-nowrap">{moeda(prof.aPagar)}</td>
                  <td className="px-3 py-3 text-right text-gray-700 whitespace-nowrap">{moeda(prof.valorCasa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {semAtendimento.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sem atendimentos no período</p>
          <div className="flex flex-wrap gap-2">
            {semAtendimento.map(p => (
              <span key={p.nome} className="text-xs px-2.5 py-1 bg-white border border-gray-200 text-gray-500 rounded-full">
                {p.nome}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ComissoesPage() {
  const { comissoes, atual, anterior, loading, salvar, remover, limparDuplicatas } = useComissoes()
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [modalPeriodo, setModalPeriodo] = useState(false)
  const [pendente, setPendente] = useState<Awaited<ReturnType<typeof parseComissoes>> | null>(null)
  const [uploading, setUploading] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Detecta duplicatas: IDs que não estão no formato "YYYY-MM"
  const temDuplicatas = comissoes.some(c => !/^\d{4}-\d{2}$/.test(c.id ?? c.periodoKey))

  async function handleRemover(c: typeof comissoes[0], e: React.MouseEvent) {
    e.stopPropagation()
    const label = labelCurta(c.periodoInicio, c.periodoFim)
    if (!confirm(`Remover o período "${label}"? Essa ação não pode ser desfeita.`)) return
    setRemovendo(c.id ?? c.periodoKey)
    try {
      await remover(c.id ?? c.periodoKey)
      if (selecionado === c.periodoKey) setSelecionado(null)
    } finally {
      setRemovendo(null)
    }
  }

  async function handleLimpar() {
    if (!confirm('Isso vai remover todos os registros duplicados e manter apenas o mais recente por mês. Continuar?')) return
    setLimpando(true)
    try { await limparDuplicatas() } finally { setLimpando(false) }
  }

  const dadosExibidos = selecionado
    ? comissoes.find(c => c.periodoKey === selecionado) ?? atual
    : atual

  const anteriorExibido = dadosExibidos && comissoes.length > 1
    ? comissoes[comissoes.findIndex(c => c.periodoKey === dadosExibidos.periodoKey) + 1] ?? null
    : null

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const resultado = await parseComissoes(file)
      if (!resultado.periodoKey) {
        setPendente(resultado)
        setModalPeriodo(true)
      } else {
        await salvar({
          periodoKey: resultado.periodoKey,
          periodoInicio: resultado.periodoInicio!,
          periodoFim: resultado.periodoFim!,
          uploadEm: Timestamp.now(),
          totalFaturado: resultado.totalFaturado,
          totalAPagar: resultado.totalAPagar,
          valorCasa: resultado.valorCasa,
          profissionais: resultado.profissionais,
        })
        setSelecionado(resultado.periodoKey)
      }
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo. Verifique se é o relatório 0123 do AVEC.')
    } finally {
      setUploading(false)
    }
  }

  async function confirmarPeriodo(inicio: string, fim: string) {
    if (!pendente) return
    const periodoKey = `${inicio}_${fim}`
    await salvar({
      periodoKey,
      periodoInicio: inicio,
      periodoFim: fim,
      uploadEm: Timestamp.now(),
      totalFaturado: pendente.totalFaturado,
      totalAPagar: pendente.totalAPagar,
      valorCasa: pendente.valorCasa,
      profissionais: pendente.profissionais,
    })
    setSelecionado(periodoKey)
    setModalPeriodo(false)
    setPendente(null)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Carregando comissões...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-5 lg:px-6 lg:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-xl font-bold text-gray-900">Comissões</h1>
          <div className="flex gap-2">
            <a href={AVEC_URL} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-colors">
              Abrir relatório no AVEC ↗
            </a>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Processando...' : 'Upload XLSX'}
            </button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
          </div>
        </div>

        {/* Aviso de duplicatas */}
        {temDuplicatas && (
          <div className="mb-4 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-800">
              Existem registros duplicados no banco (IDs antigos). Clique em Limpar para manter só o mais recente por mês.
            </p>
            <button
              onClick={handleLimpar}
              disabled={limpando}
              className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {limpando ? 'Limpando…' : 'Limpar'}
            </button>
          </div>
        )}

        {/* Pills de mês */}
        {comissoes.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-5">
            {comissoes.map(c => {
              const ativo = (selecionado ?? atual?.periodoKey) === c.periodoKey
              const isRemovendo = removendo === (c.id ?? c.periodoKey)
              return (
                <div key={c.periodoKey} className="group shrink-0 relative flex items-center">
                  <button
                    onClick={() => setSelecionado(c.periodoKey)}
                    className={`pl-3 pr-7 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                      ativo
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-emerald-50 hover:border-emerald-200'
                    }`}
                  >
                    {labelCurta(c.periodoInicio, c.periodoFim)}
                  </button>
                  <button
                    onClick={e => handleRemover(c, e)}
                    disabled={isRemovendo}
                    title="Remover período"
                    className={`absolute right-1.5 flex items-center justify-center w-4 h-4 rounded-full transition-opacity disabled:opacity-30 ${
                      ativo
                        ? 'text-white/70 hover:text-white opacity-0 group-hover:opacity-100'
                        : 'text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={10} height={10}>
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {dadosExibidos ? (
          <>
            {/* Período exibido */}
            <p className="text-sm font-semibold text-gray-700 mb-4">
              {labelPeriodo(dadosExibidos.periodoInicio, dadosExibidos.periodoFim)}
            </p>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Total Faturado', valor: dadosExibidos.totalFaturado, cor: 'text-emerald-600' },
                { label: 'Total A Pagar', valor: dadosExibidos.totalAPagar, cor: 'text-blue-600' },
                { label: 'Valor Casa', valor: dadosExibidos.valorCasa, cor: 'text-gray-900' },
              ].map(({ label, valor, cor }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 flex sm:flex-col items-center sm:items-center justify-between sm:justify-center gap-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-xl font-bold ${cor}`}>{moeda(valor)}</p>
                </div>
              ))}
            </div>

            {/* Tabela */}
            <TabelaComissoes dados={dadosExibidos} anterior={anteriorExibido} />
          </>
        ) : (
          <div
            className="border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center cursor-pointer hover:border-emerald-300 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <p className="text-gray-400 text-sm">Nenhum dado ainda.</p>
            <p className="text-gray-300 text-xs mt-1">Clique para fazer upload do relatório 0123 do AVEC.</p>
          </div>
        )}
      </div>

      {modalPeriodo && (
        <ModalPeriodo
          onConfirmar={confirmarPeriodo}
          onCancelar={() => { setModalPeriodo(false); setPendente(null) }}
        />
      )}
    </div>
  )
}
