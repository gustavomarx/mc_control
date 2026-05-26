'use client'

import { useState, useRef } from 'react'
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

  async function handleComissoes(file: File) {
    setLoadingComissoes(true)
    try {
      const resultado = await parseComissoes(file)
      if (!resultado.periodoKey) {
        setPendenteComissoes(resultado)
        setModalPeriodo('comissoes')
      } else {
        await salvarComissoes({
          periodoKey: resultado.periodoKey,
          periodoInicio: resultado.periodoInicio!,
          periodoFim: resultado.periodoFim!,
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

  async function handleCaixa(file: File) {
    setLoadingCaixa(true)
    try {
      const resultado = await parseCaixa(file)
      setPendenteCaixa(resultado)
      setModalPeriodo('caixa')
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
