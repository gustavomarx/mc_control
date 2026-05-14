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

function formatarPeriodo(inicio: string, fim: string): string {
  const [ai, mi, di] = inicio.split('-')
  const [af, mf, df] = fim.split('-')
  return `${di}/${mi}/${ai} → ${df}/${mf}/${af}`
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
  const hoje = new Date().toISOString().slice(0, 10)
  const primeiroDia = hoje.slice(0, 8) + '01'
  const [inicio, setInicio] = useState(primeiroDia)
  const [fim, setFim] = useState(hoje)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Período do relatório</h2>
        <p className="text-xs text-gray-500 mb-4">
          Preencha o mesmo período usado no AVEC.
          <br />Sugestão: dia 1 do mês até hoje.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data início</label>
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data fim</label>
            <input type="date" value={fim} onChange={e => setFim(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancelar} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          <button
            onClick={() => onConfirmar(inicio, fim)}
            disabled={!inicio || !fim}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-8">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Profissional</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Faturado</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 w-32">% do total</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">A Pagar</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor Casa</th>
            </tr>
          </thead>
          <tbody>
            {comAtendimento.map((prof, i) => (
              <tr key={prof.nome} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-center text-sm">
                  {i < 3 ? MEDALHAS[i] : <span className="text-xs text-gray-400">{i + 1}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{prof.nome}</span>
                  {badgeQueda(prof)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{moeda(prof.faturado)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${prof.percentualTotal}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{prof.percentualTotal.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{moeda(prof.aPagar)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{moeda(prof.valorCasa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
  const { comissoes, atual, anterior, loading, salvar } = useComissoes()
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [modalPeriodo, setModalPeriodo] = useState(false)
  const [pendente, setPendente] = useState<Awaited<ReturnType<typeof parseComissoes>> | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
      <div className="max-w-4xl mx-auto px-6 py-8">

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

        {/* Seletor de período */}
        {comissoes.length > 1 && (
          <div className="mb-5">
            <select
              value={selecionado ?? (atual?.periodoKey ?? '')}
              onChange={e => setSelecionado(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {comissoes.map(c => (
                <option key={c.periodoKey} value={c.periodoKey}>
                  {formatarPeriodo(c.periodoInicio, c.periodoFim)}
                </option>
              ))}
            </select>
          </div>
        )}

        {dadosExibidos ? (
          <>
            {/* Período exibido */}
            <p className="text-xs text-gray-400 mb-4">
              {formatarPeriodo(dadosExibidos.periodoInicio, dadosExibidos.periodoFim)}
            </p>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Faturado', valor: dadosExibidos.totalFaturado, cor: 'text-emerald-600' },
                { label: 'Total A Pagar', valor: dadosExibidos.totalAPagar, cor: 'text-blue-600' },
                { label: 'Valor Casa', valor: dadosExibidos.valorCasa, cor: 'text-gray-900' },
              ].map(({ label, valor, cor }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
                  <p className={`text-2xl font-bold ${cor}`}>{moeda(valor)}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
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
