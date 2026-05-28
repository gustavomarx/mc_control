'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Timestamp } from 'firebase/firestore'
import { useAgenda } from '@/hooks/useAgenda'
import { useComissoes } from '@/hooks/useComissoes'
import { useCaixa } from '@/hooks/useCaixa'
import { useCrm } from '@/hooks/useCrm'
import { parseAgendaAvec } from '@/lib/parse-agenda'
import { parseComissoes } from '@/lib/parse-comissoes'
import { parseCaixa } from '@/lib/parse-caixa'
import { parseTabelaPrecos } from '@/lib/parse-tabela-precos'
import { parseFaturamentoReal } from '@/lib/parse-faturamento-real'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTs(ts: Timestamp | null | undefined): string {
  if (!ts) return ''
  const d = ts.toDate()
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Modal de período ─────────────────────────────────────────────────────────

function ModalPeriodo({
  onConfirmar,
  onCancelar,
}: {
  onConfirmar: (inicio: string, fim: string) => void
  onCancelar: () => void
}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const primeiroDia = hoje.slice(0, 8) + '01'
  const [inicio, setInicio] = useState(primeiroDia)
  const [fim, setFim] = useState(hoje)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Período do relatório</h2>
        <p className="text-xs text-gray-500 mb-4">
          Preencha o mesmo período usado no AVEC. Sugestão: dia 1 do mês até hoje.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data início</label>
            <input
              type="date"
              value={inicio}
              onChange={e => setInicio(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data fim</label>
            <input
              type="date"
              value={fim}
              onChange={e => setFim(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancelar}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(inicio, fim)}
            disabled={!inicio || !fim}
            className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers de data ──────────────────────────────────────────────────────────

function isHoje(ts: Timestamp | null | undefined): boolean {
  if (!ts) return false
  const d = ts.toDate()
  const hoje = new Date()
  return (
    d.getFullYear() === hoje.getFullYear() &&
    d.getMonth() === hoje.getMonth() &&
    d.getDate() === hoje.getDate()
  )
}

// ── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({
  accept,
  loading,
  onFile,
  acceptLabel,
  bloqueado,
  onDesbloquear,
}: {
  accept: string
  loading: boolean
  onFile: (file: File) => void
  acceptLabel: string
  bloqueado: boolean
  onDesbloquear: () => void
}) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  if (bloqueado) {
    return (
      <div className="border-2 border-dashed border-gray-100 rounded-xl px-4 py-5 flex flex-col items-center gap-2 bg-gray-50 select-none">
        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-xs text-gray-400 text-center">Importado hoje</p>
        <button
          onClick={onDesbloquear}
          className="text-xs text-gray-400 hover:text-rose-600 underline underline-offset-2 transition-colors"
        >
          Desbloquear para reimportar
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      className={[
        'border-2 border-dashed rounded-xl px-4 py-5 flex flex-col items-center gap-1.5',
        'cursor-pointer transition-colors select-none',
        drag ? 'border-rose-400 bg-rose-50' : 'border-gray-200 hover:border-rose-300 hover:bg-rose-50/30',
        loading ? 'opacity-60 pointer-events-none' : '',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-1">
          <svg className="animate-spin h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Processando…
        </div>
      ) : (
        <>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v8" />
          </svg>
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            Arraste ou <span className="text-rose-700 font-medium">clique para selecionar</span>
          </p>
          <p className="text-[10px] text-gray-400">{acceptLabel}</p>
        </>
      )}
    </div>
  )
}

// ── Card de importação ───────────────────────────────────────────────────────

function ImportCard({
  numero,
  titulo,
  descricao,
  avecUrl,
  ultimaAtualizacao,
  children,
}: {
  numero?: string
  titulo: string
  descricao: string
  avecUrl?: string
  ultimaAtualizacao: Timestamp | null | undefined
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {numero && (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 tracking-wide">
                {numero}
              </span>
            )}
            <h2 className="text-sm font-semibold text-gray-900 truncate">{titulo}</h2>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{descricao}</p>
        </div>
        {avecUrl && (
          <a
            href={avecUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="shrink-0 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Abrir no AVEC ↗
          </a>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        {ultimaAtualizacao ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs text-emerald-700">Atualizado em {fmtTs(ultimaAtualizacao)}</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
            <span className="text-xs text-gray-400">Nunca importado</span>
          </>
        )}
      </div>

      {/* Upload area */}
      {children}
    </div>
  )
}

// ── Success toast ────────────────────────────────────────────────────────────

function useToast() {
  const [msg, setMsg] = useState<string | null>(null)

  function mostrar(texto: string) {
    setMsg(texto)
    setTimeout(() => setMsg(null), 3500)
  }

  const Toast = msg ? (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-gray-900 text-white text-sm rounded-xl shadow-xl flex items-center gap-2">
      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {msg}
    </div>
  ) : null

  return { mostrar, Toast }
}

// ── AVEC auto-import — constantes ────────────────────────────────────────────

const AVEC_LABELS: Record<string, string> = {
  agenda:           '0051 — Agenda Semanal',
  aniversariantes:  '0001 — Aniversariantes',
  comissoes:        '0123 — Comissões',
  caixa:            '0281 — Caixa',
  tabela:           '0033 — Tabela de Preços',
  faturamento_real: '0088 — Faturamento Real',
}

const AVEC_CODIGOS: Record<string, string> = {
  agenda: '0051', aniversariantes: '0001', comissoes: '0123',
  caixa: '0281', tabela: '0033', faturamento_real: '0088',
}

// ── Modal Importar AVEC ───────────────────────────────────────────────────────

function ModalImportarAvec({
  extensaoOk, running, status, inicio, fim, keys,
  onInicio, onFim, onToggleKey, onExecutar, onFechar,
}: {
  extensaoOk: boolean
  running: boolean
  status: { id: string; icon: string; text: string; state: string }[]
  inicio: string
  fim: string
  keys: Set<string>
  onInicio: (v: string) => void
  onFim: (v: string) => void
  onToggleKey: (k: string) => void
  onExecutar: () => void
  onFechar: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">AVEC Importer</p>
            <h2 className="text-base font-semibold text-gray-900">Importar automaticamente</h2>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 p-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {!extensaoOk ? (
          /* Extensão não detectada */
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth={2} width={20} height={20}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              A extensão <strong>mc_extension</strong> não foi detectada.<br />
              Instale-a pelo botão <strong>Extensão</strong> no canto superior direito.
            </p>
          </div>
        ) : (
          <>
            {/* Período */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Período</label>
              <div className="flex items-center gap-2">
                <input type="date" value={inicio} onChange={e => onInicio(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                <span className="text-xs text-gray-400">até</span>
                <input type="date" value={fim} onChange={e => onFim(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
              </div>
            </div>

            {/* Relatórios */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Relatórios</label>
              <div className="flex flex-col gap-1">
                {Object.entries(AVEC_LABELS).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={keys.has(k)} onChange={() => onToggleKey(k)}
                      className="accent-rose-700 w-3.5 h-3.5" />
                    <span className="text-xs text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status */}
            {status.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-gray-100 pt-3 max-h-36 overflow-y-auto">
                {status.map(s => (
                  <div key={s.id} className={[
                    'flex items-center gap-2 text-xs',
                    s.state === 'done'    ? 'text-emerald-700' :
                    s.state === 'error'   ? 'text-red-700' :
                    s.state === 'msg'     ? 'text-gray-400' : 'text-gray-500'
                  ].join(' ')}>
                    {s.icon && <span>{s.icon}</span>}
                    <span>{s.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Botão */}
            <button
              onClick={onExecutar}
              disabled={running || keys.size === 0}
              className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {running ? 'Executando…' : 'Executar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ImportacoesPage() {
  const { agendaAtual, tabela, uploadFaturamentoReal, salvarAgenda, salvarTabelaPrecos, salvarFaturamentoReal } = useAgenda()
  const { atual: comissoesAtual, salvar: salvarComissoes } = useComissoes()
  const { atual: caixaAtual, salvar: salvarCaixa } = useCaixa()
  const { uploadInfoAniv, uploadInfo0051, uploadAniversariantes, uploadAgenda0051 } = useCrm()

  // Loading states por seção
  const [loadingAgenda, setLoadingAgenda] = useState(false)
  const [loadingAniv, setLoadingAniv] = useState(false)
  const [loadingComissoes, setLoadingComissoes] = useState(false)
  const [loadingCaixa, setLoadingCaixa] = useState(false)
  const [loadingTabela, setLoadingTabela] = useState(false)
  const [loadingFatReal, setLoadingFatReal] = useState(false)

  // Desbloqueios manuais (keys desbloqueadas pelo usuário nesta sessão)
  const [desbloqueados, setDesbloqueados] = useState<Set<string>>(new Set())

  function desbloquear(key: string) {
    setDesbloqueados(prev => new Set(prev).add(key))
  }

  function bloqueado(key: string, ts: Timestamp | null | undefined): boolean {
    return isHoje(ts) && !desbloqueados.has(key)
  }

  // Modal de período
  const [modalPeriodo, setModalPeriodo] = useState<'comissoes' | 'caixa' | null>(null)
  const [modalExtensao, setModalExtensao] = useState(false)

  // ── AVEC auto-import ─────────────────────────────────────────────────────────
  const [modalAvec, setModalAvec] = useState(false)
  const [extensaoOk, setExtensaoOk] = useState(false)
  const [avecRunning, setAvecRunning] = useState(false)
  const [avecStatus, setAvecStatus] = useState<{ id: string; icon: string; text: string; state: string }[]>([])

  const hoje = new Date()
  const [avecInicio, setAvecInicio] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`)
  const [avecFim, setAvecFim] = useState(hoje.toISOString().slice(0, 10))
  const [avecKeys, setAvecKeys] = useState<Set<string>>(new Set(['agenda', 'aniversariantes', 'comissoes', 'caixa']))

  // Detecta extensão e recebe status via postMessage (funciona no isolated world)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== window) return

      if (e.data?.type === 'MC_EXTENSION_READY') {
        setExtensaoOk(true)
        return
      }

      if (e.data?.type === 'MC_AVEC_STATUS') {
        const msg = e.data.detail as Record<string, string>
        setAvecStatus(prev => {
          const next = [...prev]

          if (msg.phase === 'extract' && msg.state === 'loading')
            return next.some(s => s.id === `ext-${msg.key}`) ? next : [...next, { id: `ext-${msg.key}`, icon: '⏳', text: AVEC_LABELS[msg.key] ?? msg.key, state: 'loading' }]
          if (msg.phase === 'extract' && msg.state === 'done')
            return next.map(s => s.id === `ext-${msg.key}` ? { ...s, icon: '✅', state: 'done' } : s)
          if (msg.phase === 'extract' && msg.state === 'error')
            return next.map(s => s.id === `ext-${msg.key}` ? { ...s, icon: '❌', state: 'error', text: `${AVEC_LABELS[msg.key]} — ${msg.error ?? ''}` } : s)

          if (msg.phase === 'upload' && msg.state === 'opening')
            return [...next, { id: '__upl_header', icon: '', text: '⬆ Importando…', state: 'msg' }]
          if (msg.phase === 'upload' && msg.key && msg.state === 'loading')
            return [...next, { id: `upl-${msg.key}`, icon: '⏳', text: AVEC_LABELS[msg.key] ?? msg.key, state: 'loading' }]
          if (msg.phase === 'upload' && msg.key && msg.state === 'done')
            return next.map(s => s.id === `upl-${msg.key}` ? { ...s, icon: '✅', state: 'done' } : s)
          if (msg.phase === 'upload' && msg.key && msg.state === 'error')
            return next.map(s => s.id === `upl-${msg.key}` ? { ...s, icon: '❌', state: 'error', text: `${AVEC_LABELS[msg.key]} — ${msg.error ?? ''}` } : s)

          if (msg.phase === 'complete') {
            setAvecRunning(false)
            return [...next, { id: '__complete', icon: '✓', text: 'Importação concluída!', state: 'done' }]
          }
          if (msg.phase === 'error') {
            setAvecRunning(false)
            return [...next, { id: '__error', icon: '❌', text: msg.error ?? 'Erro desconhecido', state: 'error' }]
          }

          return next
        })
      }
    }

    window.addEventListener('message', onMessage)
    // Probe: se o content script já carregou, ele responde com MC_EXTENSION_READY
    window.postMessage({ type: 'MC_EXTENSION_PROBE' }, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function dispararImportAvec() {
    if (!extensaoOk) return
    const relatorios = Array.from(avecKeys).map(key => ({
      key,
      codigo: AVEC_CODIGOS[key],
    }))
    setAvecStatus([{ id: '__dl_header', icon: '', text: '⬇ Baixando do AVEC…', state: 'msg' }])
    relatorios.forEach(r =>
      setAvecStatus(prev => [...prev, { id: `ext-${r.key}`, icon: '⏳', text: AVEC_LABELS[r.key], state: 'loading' }])
    )
    setAvecRunning(true)
    window.postMessage({
      type: 'MC_AVEC_IMPORT',
      detail: { relatorios, inicio: avecInicio, fim: avecFim, mcUrl: window.location.origin },
    }, '*')
  }
  const [pendenteComissoes, setPendenteComissoes] = useState<Awaited<ReturnType<typeof parseComissoes>> | null>(null)
  const [pendenteCaixa, setPendenteCaixa] = useState<Awaited<ReturnType<typeof parseCaixa>> | null>(null)

  const { mostrar, Toast } = useToast()

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleAgenda(file: File) {
    setLoadingAgenda(true)
    try {
      const semanas = await parseAgendaAvec(file)
      await salvarAgenda(semanas)
      await uploadAgenda0051(file)
      const qtd = Array.isArray(semanas) ? semanas.length : 1
      mostrar(`Agenda importada — ${qtd} semana${qtd !== 1 ? 's' : ''} salva${qtd !== 1 ? 's' : ''}`)
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo. Verifique se é o relatório 0051 do AVEC.')
    } finally {
      setLoadingAgenda(false)
    }
  }

  async function handleAniversariantes(file: File) {
    setLoadingAniv(true)
    try {
      await uploadAniversariantes(file)
      mostrar('Aniversariantes importados com sucesso')
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo. Verifique se é o relatório 0001 do AVEC.')
    } finally {
      setLoadingAniv(false)
    }
  }

  async function handleComissoes(file: File, opts?: { inicio: string; fim: string }) {
    setLoadingComissoes(true)
    try {
      const resultado = await parseComissoes(file)
      const periodoKey = resultado.periodoKey ?? (opts ? `${opts.inicio}_${opts.fim}` : null)
      const periodoInicio = resultado.periodoInicio ?? opts?.inicio
      const periodoFim = resultado.periodoFim ?? opts?.fim

      if (!periodoKey) {
        setPendenteComissoes(resultado)
        setModalPeriodo('comissoes')
      } else {
        await salvarComissoes({
          periodoKey,
          periodoInicio: periodoInicio!,
          periodoFim: periodoFim!,
          uploadEm: Timestamp.now(),
          totalFaturado: resultado.totalFaturado,
          totalAPagar: resultado.totalAPagar,
          valorCasa: resultado.valorCasa,
          profissionais: resultado.profissionais,
        })
        mostrar('Comissões importadas com sucesso')
      }
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo. Verifique se é o relatório 0123 do AVEC.')
    } finally {
      setLoadingComissoes(false)
    }
  }

  async function confirmarComissoes(inicio: string, fim: string) {
    if (!pendenteComissoes) return
    const periodoKey = `${inicio}_${fim}`
    await salvarComissoes({
      periodoKey,
      periodoInicio: inicio,
      periodoFim: fim,
      uploadEm: Timestamp.now(),
      totalFaturado: pendenteComissoes.totalFaturado,
      totalAPagar: pendenteComissoes.totalAPagar,
      valorCasa: pendenteComissoes.valorCasa,
      profissionais: pendenteComissoes.profissionais,
    })
    setPendenteComissoes(null)
    setModalPeriodo(null)
    mostrar('Comissões importadas com sucesso')
  }

  async function handleCaixa(file: File, opts?: { inicio: string; fim: string }) {
    setLoadingCaixa(true)
    try {
      const resultado = await parseCaixa(file)
      if (opts) {
        // Chamado via extensão — pula o modal, usa o período do popup
        const periodoKey = `${opts.inicio}_${opts.fim}`
        await salvarCaixa({
          periodoKey,
          periodoInicio: opts.inicio,
          periodoFim: opts.fim,
          uploadEm: Timestamp.now(),
          total: resultado.total,
          formas: resultado.formas,
          dinheiroDepositado: false,
        })
        mostrar('Caixa importado com sucesso')
      } else {
        setPendenteCaixa(resultado)
        setModalPeriodo('caixa')
      }
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo. Verifique se é o relatório 0281 do AVEC.')
    } finally {
      setLoadingCaixa(false)
    }
  }

  async function confirmarCaixa(inicio: string, fim: string) {
    if (!pendenteCaixa) return
    const periodoKey = `${inicio}_${fim}`
    await salvarCaixa({
      periodoKey,
      periodoInicio: inicio,
      periodoFim: fim,
      uploadEm: Timestamp.now(),
      total: pendenteCaixa.total,
      formas: pendenteCaixa.formas,
      dinheiroDepositado: false,
    })
    setPendenteCaixa(null)
    setModalPeriodo(null)
    mostrar('Caixa importado com sucesso')
  }

  async function handleFaturamentoReal(file: File) {
    setLoadingFatReal(true)
    try {
      const resultado = await parseFaturamentoReal(file)
      await salvarFaturamentoReal(resultado)
      mostrar(`Faturamento real importado — ${resultado.dias.length} dias (${String(resultado.mes).padStart(2, '0')}/${resultado.ano})`)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Erro ao processar o relatório 0088.')
    } finally {
      setLoadingFatReal(false)
    }
  }

  async function handleTabela(file: File) {
    setLoadingTabela(true)
    try {
      const servicos = await parseTabelaPrecos(file)
      if (servicos.length === 0) {
        alert('Nenhum serviço encontrado. Verifique se as colunas são: Serviço, Descrição, Categoria, Valor.')
        return
      }
      const mapa: Record<string, number> = {}
      servicos.forEach(s => { mapa[s.servico] = s.valor })
      await salvarTabelaPrecos(mapa)
      mostrar(`Tabela de preços importada — ${servicos.length} serviço${servicos.length !== 1 ? 's' : ''}`)
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo de preços.')
    } finally {
      setLoadingTabela(false)
    }
  }

  // ── Bridge para extensão Chrome ──────────────────────────────────────────────
  // Usa ref para sempre referenciar os handlers mais recentes sem re-registrar o efeito
  type ImportOpts = { inicio: string; fim: string }
  const importHandlersRef = useRef<Record<string, (file: File, opts?: ImportOpts) => Promise<void>>>({})

  importHandlersRef.current = {
    agenda:           handleAgenda,
    aniversariantes:  handleAniversariantes,
    comissoes:        handleComissoes,
    caixa:            handleCaixa,
    tabela:           handleTabela,
    faturamento_real: handleFaturamentoReal,
  }

  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__mcImport = (
      key: string,
      file: File,
      opts?: ImportOpts
    ) => importHandlersRef.current[key]?.(file, opts)

    return () => {
      delete (window as unknown as Record<string, unknown>).__mcImport
    }
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────────

  const cardsOrdenados = [
    {
      key: 'agenda',
      numero: '0051',
      titulo: 'Agenda Semanal',
      descricao: 'Atualiza Agenda e CRM (recuperação de clientes)',
      avecUrl: 'https://admin.avec.beauty/admin/relatorio/0051',
      ultimaAtualizacao: agendaAtual?.uploadEm ?? null,
      accept: '.xlsx,.xls',
      acceptLabel: 'XLSX / XLS',
      loading: loadingAgenda,
      onFile: handleAgenda,
    },
    {
      key: 'aniversariantes',
      numero: '0001',
      titulo: 'Aniversariantes',
      descricao: 'Atualiza lista de aniversariantes no CRM',
      avecUrl: 'https://admin.avec.beauty/admin/relatorio/0001',
      ultimaAtualizacao: uploadInfoAniv?.uploadEm ?? null,
      accept: '.xlsx,.xls',
      acceptLabel: 'XLSX / XLS',
      loading: loadingAniv,
      onFile: handleAniversariantes,
    },
    {
      key: 'comissoes',
      numero: '0123',
      titulo: 'Comissões',
      descricao: 'Faturamento e comissões por profissional',
      avecUrl: 'https://admin.avec.beauty/admin/relatorio/0123',
      ultimaAtualizacao: comissoesAtual?.uploadEm ?? null,
      accept: '.xlsx,.xls',
      acceptLabel: 'XLSX / XLS',
      loading: loadingComissoes,
      onFile: handleComissoes,
    },
    {
      key: 'caixa',
      numero: '0281',
      titulo: 'Caixa por Forma de Pagamento',
      descricao: 'Totais por Pix, cartão, dinheiro e débito',
      avecUrl: 'https://admin.avec.beauty/admin/relatorio/0281',
      ultimaAtualizacao: caixaAtual?.uploadEm ?? null,
      accept: '.xlsx,.xls',
      acceptLabel: 'XLSX / XLS',
      loading: loadingCaixa,
      onFile: handleCaixa,
    },
    {
      key: 'tabela',
      numero: '0033',
      titulo: 'Tabela de Preços',
      descricao: 'Preços por serviço — usado nas estimativas de faturamento da Agenda',
      avecUrl: 'https://admin.avec.beauty/admin/relatorio/0033',
      ultimaAtualizacao: tabela.atualizadoEm ?? null,
      accept: '.csv,.xlsx,.xls',
      acceptLabel: 'CSV / XLSX / XLS',
      loading: loadingTabela,
      onFile: handleTabela,
    },
    {
      key: 'faturamento_real',
      numero: '0088',
      titulo: 'Faturamento Real por Dia',
      descricao: 'Compara o faturamento realizado com a estimativa na Agenda',
      avecUrl: 'https://admin.avec.beauty/admin/relatorio/0088',
      ultimaAtualizacao: uploadFaturamentoReal ?? null,
      accept: '.xlsx,.xls',
      acceptLabel: 'XLSX / XLS',
      loading: loadingFatReal,
      onFile: handleFaturamentoReal,
    },
  ].sort((a, b) => {
    const ta = a.ultimaAtualizacao?.toMillis() ?? 0
    const tb = b.ultimaAtualizacao?.toMillis() ?? 0
    return ta - tb // mais antigo (ou nunca) primeiro
  }).map(c => ({ ...c, bloqueado: bloqueado(c.key, c.ultimaAtualizacao) }))

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 lg:px-6 lg:py-8">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Importações</h1>
          <p className="text-sm text-gray-500 mt-1">
            Atualize todos os relatórios do sistema em um único lugar.
          </p>
        </div>

        {/* ── Banner AVEC auto-import ── */}
        <button
          onClick={() => { setAvecStatus([]); setModalAvec(true) }}
          className="w-full mb-4 flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-rose-200 hover:bg-rose-50/30 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-700 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Importar automaticamente do AVEC</p>
              <p className="text-xs text-gray-500">Baixa e importa todos os relatórios de uma vez</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {extensaoOk
              ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
            <svg className="w-4 h-4 text-gray-400 group-hover:text-rose-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {cardsOrdenados.map(card => (
            <ImportCard
              key={card.key}
              numero={card.numero}
              titulo={card.titulo}
              descricao={card.descricao}
              avecUrl={card.avecUrl}
              ultimaAtualizacao={card.ultimaAtualizacao}
            >
              <DropZone
                accept={card.accept}
                loading={card.loading}
                onFile={card.onFile}
                acceptLabel={card.acceptLabel}
                bloqueado={card.bloqueado}
                onDesbloquear={() => desbloquear(card.key)}
              />
            </ImportCard>
          ))}

          {/* Extrato Bancário — link para página própria */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Extrato Bancário</h2>
                <p className="text-xs text-gray-500 leading-relaxed">
                  PDF do Sicoob — requer revisão e categorização antes de salvar
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
              <span className="text-xs text-gray-400">Gerenciado na página Extrato</span>
            </div>
            <Link
              href="/extrato"
              className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-5 flex flex-col items-center gap-1.5 hover:border-rose-300 hover:bg-rose-50/30 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-xs text-gray-500 text-center">
                <span className="text-rose-700 font-medium">Ir para Extrato →</span>
              </p>
              <p className="text-[10px] text-gray-400">PDF</p>
            </Link>
          </div>

        </div>
      </div>

      {/* ── Botão fixo extensão ── */}
      <button
        onClick={() => setModalExtensao(true)}
        title="mc_extension — Studio Meus Cílios"
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 90, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: '#fff', border: '1.5px solid var(--beige)', borderRadius: 20, boxShadow: '0 2px 10px rgba(74,18,40,.1)', fontFamily: "'Jost', sans-serif", fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', cursor: 'pointer', transition: 'all .18s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--rose-gold)'; (e.currentTarget as HTMLElement).style.color = 'var(--bordeaux-dark)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--beige)'; (e.currentTarget as HTMLElement).style.color = 'var(--warm-gray)' }}
      >
        <PuzzleIcon /> Extensão
      </button>

      {/* ── Modal ajuda extensão ── */}
      {modalExtensao && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(74,18,40,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '32px 28px', width: 'min(480px, 94vw)', boxShadow: '0 20px 60px rgba(74,18,40,.3)', display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--bordeaux-mid), var(--bordeaux-dark))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rose-gold-light)', flexShrink: 0 }}>
                  <PuzzleIcon size={20} />
                </div>
                <div>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 700, fontStyle: 'italic', color: 'var(--bordeaux-dark)', margin: 0 }}>mc_extension</h3>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: 'var(--warm-gray)', margin: 0 }}>WA Auto Sender + AVEC Importer</p>
                </div>
              </div>
              <button onClick={() => setModalExtensao(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Download */}
            <a
              href="/mc_extension.zip"
              download="mc_extension.zip"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '13px 20px', background: 'linear-gradient(135deg, var(--bordeaux-mid) 0%, var(--bordeaux-dark) 100%)', color: 'var(--rose-gold-light)', borderRadius: 10, fontFamily: "'Jost', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '.04em', textDecoration: 'none', boxShadow: '0 4px 14px rgba(74,18,40,.3)', marginBottom: 24 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={17} height={17}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Baixar extensão (.zip)
            </a>

            {/* Steps */}
            <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 12 }}>Como instalar</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {[
                { n: '1', texto: 'Baixe o ZIP acima e extraia em uma pasta permanente (ex: Documentos)' },
                { n: '2', texto: <span>No Chrome, acesse <strong style={{ fontFamily: 'monospace', fontSize: 12 }}>chrome://extensions</strong></span> },
                { n: '3', texto: 'Ative o "Modo do desenvolvedor" no canto superior direito' },
                { n: '4', texto: 'Clique em "Carregar sem compactação" e selecione a pasta extraída' },
                { n: '5', texto: 'A extensão "mc_extension — Studio Meus Cílios" aparecerá na lista' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ minWidth: 24, height: 24, background: 'linear-gradient(135deg, var(--rose-gold) 0%, #b87f56 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: "'Jost', sans-serif", marginTop: 1 }}>{s.n}</span>
                  <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{s.texto}</span>
                </div>
              ))}
            </div>

            {/* Aviso */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth={2} width={16} height={16} style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: '#92400e', lineHeight: 1.5, margin: 0 }}>
                A extensão precisa estar aberta durante a importação. Após clicar em &quot;Executar&quot; no popup, aguarde sem fechar o Chrome.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Modal AVEC auto-import */}
      {modalAvec && (
        <ModalImportarAvec
          extensaoOk={extensaoOk}
          running={avecRunning}
          status={avecStatus}
          inicio={avecInicio}
          fim={avecFim}
          keys={avecKeys}
          onInicio={setAvecInicio}
          onFim={setAvecFim}
          onToggleKey={k => setAvecKeys(prev => {
            const next = new Set(prev)
            next.has(k) ? next.delete(k) : next.add(k)
            return next
          })}
          onExecutar={dispararImportAvec}
          onFechar={() => { if (!avecRunning) setModalAvec(false) }}
        />
      )}

      {/* Modais de período */}
      {modalPeriodo === 'comissoes' && (
        <ModalPeriodo
          onConfirmar={confirmarComissoes}
          onCancelar={() => { setModalPeriodo(null); setPendenteComissoes(null) }}
        />
      )}
      {modalPeriodo === 'caixa' && (
        <ModalPeriodo
          onConfirmar={confirmarCaixa}
          onCancelar={() => { setModalPeriodo(null); setPendenteCaixa(null) }}
        />
      )}

      {Toast}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PuzzleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={size} height={size}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  )
}
