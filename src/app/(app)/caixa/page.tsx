'use client'

import { useState, useRef } from 'react'
import { useCaixa } from '@/hooks/useCaixa'
import { parseCaixa } from '@/lib/parse-caixa'
import type { CaixaFormas, FormaPagamento } from '@/types'
import { Timestamp } from 'firebase/firestore'

const AVEC_URL = 'https://admin.avec.beauty/admin/relatorio/0281'

const FORMA_CONFIG: Record<string, { emoji: string; cor: string; barra: string }> = {
  'Cartão Crédito': { emoji: '💳', cor: 'text-purple-700', barra: 'bg-purple-400' },
  'Cartão Débito':  { emoji: '💳', cor: 'text-blue-700',   barra: 'bg-blue-400' },
  'Pix':            { emoji: '📱', cor: 'text-emerald-700', barra: 'bg-emerald-400' },
  'Dinheiro':       { emoji: '💵', cor: 'text-yellow-700',  barra: 'bg-yellow-400' },
}

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarPeriodo(inicio: string, fim: string): string {
  const f = (s: string) => s.split('-').reverse().join('/')
  return `${f(inicio)} → ${f(fim)}`
}

function variacaoPercentual(atual: number, anterior: number): number | null {
  if (!anterior || anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

interface TooltipProps { texto: string }
function Tooltip({ texto }: TooltipProps) {
  const [vis, setVis] = useState(false)
  return (
    <span className="relative inline-block ml-1 align-middle">
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
        <p className="text-xs text-gray-500 mb-1">
          Preencha o mesmo período que você usou no AVEC.
        </p>
        <p className="text-xs text-gray-400 mb-4 flex items-center">
          Sugestão: do dia 1 do mês atual até hoje.
          <Tooltip texto="Preencha o mesmo período que você usou no AVEC. Sugestão: do dia 1 do mês atual até hoje." />
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

interface PainelCaixaProps {
  dados: CaixaFormas
  anterior: CaixaFormas | null
  onMarcarDepositado: (key: string) => Promise<void>
}

function PainelCaixa({ dados, anterior, onMarcarDepositado }: PainelCaixaProps) {
  const [marcando, setMarcando] = useState(false)

  const mapaAnterior = anterior
    ? Object.fromEntries(anterior.formas.map(f => [f.nome, f.valor]))
    : {}

  const dinheiro = dados.formas.find(f => f.nome === 'Dinheiro')

  async function handleMarcar() {
    setMarcando(true)
    try { await onMarcarDepositado(dados.periodoKey) }
    finally { setMarcando(false) }
  }

  function badgeVariacao(forma: FormaPagamento) {
    const ant = mapaAnterior[forma.nome]
    if (ant === undefined) return null
    const pct = variacaoPercentual(forma.valor, ant)
    if (pct === null) return null
    const positivo = pct >= 0
    return (
      <span className={`text-xs font-medium ${positivo ? 'text-emerald-600' : 'text-red-500'}`}>
        {positivo ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Total geral */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total do período</p>
        <p className="text-4xl font-bold text-gray-900">{moeda(dados.total)}</p>
        <p className="text-xs text-gray-400 mt-1">{formatarPeriodo(dados.periodoInicio, dados.periodoFim)}</p>
      </div>

      {/* Cards por forma + gráfico */}
      <div className="space-y-3">
        {dados.formas.map(forma => {
          const cfg = FORMA_CONFIG[forma.nome] ?? { emoji: '💰', cor: 'text-gray-700', barra: 'bg-gray-400' }
          return (
            <div key={forma.nome} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cfg.emoji}</span>
                  <span className={`text-sm font-semibold ${cfg.cor}`}>{forma.nome}</span>
                </div>
                <div className="flex items-center gap-2">
                  {badgeVariacao(forma)}
                  <span className="text-sm font-bold text-gray-900">{moeda(forma.valor)}</span>
                  <span className="text-xs text-gray-400 w-10 text-right">{forma.percentual.toFixed(0)}%</span>
                </div>
              </div>
              {/* Barra horizontal pura Tailwind */}
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${cfg.barra}`}
                  style={{ width: `${forma.percentual}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Banner dinheiro */}
      {dinheiro && dinheiro.valor > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-yellow-800">
                💵 {moeda(dinheiro.valor)} em dinheiro no período
              </p>
              <p className="text-xs text-yellow-600 mt-0.5">
                Lembre de depositar no Sicoob em até 48h
              </p>
              {dados.dinheiroDepositado && dados.dinheiroDepositadoEm && (
                <p className="text-xs text-emerald-600 mt-1 font-medium">
                  ✓ Depositado em {dados.dinheiroDepositadoEm.toDate().toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
            {!dados.dinheiroDepositado && (
              <button
                onClick={handleMarcar}
                disabled={marcando}
                className="shrink-0 text-xs px-3 py-1.5 bg-yellow-200 hover:bg-yellow-300 text-yellow-800 font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {marcando ? '...' : 'Marcar como depositado'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CaixaPage() {
  const { registros, atual, anterior, loading, salvar, marcarDepositado } = useCaixa()
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [modalPeriodo, setModalPeriodo] = useState(false)
  const [pendente, setPendente] = useState<Awaited<ReturnType<typeof parseCaixa>> | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const dadosExibidos = selecionado
    ? registros.find(r => r.periodoKey === selecionado) ?? atual
    : atual

  const anteriorExibido = dadosExibidos && registros.length > 1
    ? registros[registros.findIndex(r => r.periodoKey === dadosExibidos.periodoKey) + 1] ?? null
    : null

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const resultado = await parseCaixa(file)
      setPendente(resultado)
      setModalPeriodo(true)
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo. Verifique se é o relatório 0281 do AVEC.')
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
      total: pendente.total,
      formas: pendente.formas,
      dinheiroDepositado: false,
    })
    setSelecionado(periodoKey)
    setModalPeriodo(false)
    setPendente(null)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Carregando caixa...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-xl font-bold text-gray-900">Caixa por Forma de Pagamento</h1>
          <div className="flex gap-2">
            <a href={AVEC_URL} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-colors">
              Abrir no AVEC ↗
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
        {registros.length > 1 && (
          <div className="mb-5">
            <select
              value={selecionado ?? (atual?.periodoKey ?? '')}
              onChange={e => setSelecionado(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {registros.map(r => (
                <option key={r.periodoKey} value={r.periodoKey}>
                  {formatarPeriodo(r.periodoInicio, r.periodoFim)}
                </option>
              ))}
            </select>
          </div>
        )}

        {dadosExibidos ? (
          <PainelCaixa
            dados={dadosExibidos}
            anterior={anteriorExibido}
            onMarcarDepositado={marcarDepositado}
          />
        ) : (
          <div
            className="border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center cursor-pointer hover:border-emerald-300 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <p className="text-gray-400 text-sm">Nenhum dado ainda.</p>
            <p className="text-gray-300 text-xs mt-1">Clique para fazer upload do relatório 0281 do AVEC.</p>
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
