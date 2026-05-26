'use client'

import { useState, useMemo } from 'react'
import { useTarefas } from '@/hooks/useTarefas'
import { useAuth } from '@/contexts/AuthContext'
import CardTarefa from '@/components/tarefas/CardTarefa'
import ModalTarefa from '@/components/tarefas/ModalTarefa'
import type { Tarefa } from '@/types'

function getSegundaFeira(d: Date): Date {
  const dia = new Date(d)
  const dow = dia.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  dia.setDate(dia.getDate() + diff)
  dia.setHours(0, 0, 0, 0)
  return dia
}

function semanaISO(d: Date): string {
  return getSegundaFeira(d).toISOString().slice(0, 10)
}

function calcularStreak(tarefas: Tarefa[]): number {
  const semanas = new Set<string>()
  tarefas.forEach(t => {
    t.historico_conclusoes.forEach(c => {
      semanas.add(semanaISO(c.concluidaEm.toDate()))
    })
    if (t.concluida && t.concluidaEm) {
      semanas.add(semanaISO(t.concluidaEm.toDate()))
    }
  })
  let streak = 0
  const hoje = new Date()
  let semana = getSegundaFeira(hoje)
  while (semanas.has(semana.toISOString().slice(0, 10))) {
    streak++
    semana.setDate(semana.getDate() - 7)
  }
  return streak
}

function inicioSemana(offset = 0): Date {
  const d = getSegundaFeira(new Date())
  d.setDate(d.getDate() + offset * 7)
  return d
}

function fimSemana(offset = 0): Date {
  const d = inicioSemana(offset)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

const PRIORIDADE_DOT: Record<string, string> = {
  urgente: 'bg-red-400',
  alta:    'bg-orange-400',
  normal:  'bg-blue-300',
  baixa:   'bg-gray-300',
}

function formatarData(ts: import('firebase/firestore').Timestamp): string {
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function MiniCard({ tarefa, onEditar }: { tarefa: Tarefa; onEditar: (t: Tarefa) => void }) {
  const atrasada = (() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const d = tarefa.dataEntrega.toDate(); d.setHours(0, 0, 0, 0)
    return !tarefa.concluida && d < hoje
  })()

  return (
    <div
      onClick={() => onEditar(tarefa)}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 cursor-pointer group transition-colors"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORIDADE_DOT[tarefa.prioridade]}`} />
      <span className={`text-xs flex-1 min-w-0 truncate transition-colors ${
        atrasada ? 'text-red-500' : 'text-gray-500 group-hover:text-gray-800'
      }`}>
        {tarefa.titulo}
      </span>
      <span className={`text-xs shrink-0 ${atrasada ? 'text-red-400' : 'text-gray-300'}`}>
        {formatarData(tarefa.dataEntrega)}
      </span>
    </div>
  )
}

function GrupoLateral({ titulo, tarefas, onEditar }: {
  titulo: string
  tarefas: Tarefa[]
  onEditar: (t: Tarefa) => void
}) {
  if (tarefas.length === 0) return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-300 px-2 mb-1">{titulo}</p>
      <div>
        {tarefas.map(t => (
          <MiniCard key={t.id} tarefa={t} onEditar={onEditar} />
        ))}
      </div>
    </div>
  )
}

export default function TarefasPage() {
  const { tarefas, loading, adicionar, atualizar, excluir, concluir, reabrirTarefa } = useTarefas()
  const { nivelTarefas } = useAuth()
  const soEquipe = nivelTarefas === 'equipe'
  const [modalAberto, setModalAberto] = useState(false)
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null)

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const base = useMemo(
    () => soEquipe ? tarefas.filter(t => t.responsavel === 'equipe') : tarefas,
    [tarefas, soEquipe]
  )

  const semanaAtualInicio = inicioSemana(0)
  const semanaAtualFim    = fimSemana(0)
  const proximaSemanaInicio = inicioSemana(1)
  const proximaSemanaFim    = fimSemana(1)

  const grupos = useMemo(() => {
    const porPrioridade = (arr: Tarefa[]) => {
      const ordem = { urgente: 0, alta: 1, normal: 2, baixa: 3 }
      return [...arr].sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade])
    }

    const atrasadas = base.filter(t => {
      if (t.concluida) return false
      const d = t.dataEntrega.toDate(); d.setHours(0, 0, 0, 0)
      return d < hoje
    })

    const diaHoje = base.filter(t => {
      if (t.concluida) return false
      const d = t.dataEntrega.toDate(); d.setHours(0, 0, 0, 0)
      return d.getTime() === hoje.getTime()
    })

    const estaSemana = base.filter(t => {
      if (t.concluida) return false
      const d = t.dataEntrega.toDate(); d.setHours(0, 0, 0, 0)
      return d > hoje && d >= semanaAtualInicio && d <= semanaAtualFim
    })

    const proximaSemana = base.filter(t => {
      if (t.concluida) return false
      const d = t.dataEntrega.toDate()
      return d >= proximaSemanaInicio && d <= proximaSemanaFim
    })

    const futuras = base.filter(t => {
      if (t.concluida) return false
      return t.dataEntrega.toDate() > proximaSemanaFim
    })

    const concluidas = base.filter(t => t.concluida)

    return {
      atrasadas:      porPrioridade(atrasadas),
      diaHoje:        porPrioridade(diaHoje),
      estaSemana:     porPrioridade(estaSemana),
      proximaSemana:  porPrioridade(proximaSemana),
      futuras:        porPrioridade(futuras),
      concluidas,
    }
  }, [base, hoje, semanaAtualInicio, semanaAtualFim, proximaSemanaInicio, proximaSemanaFim])

  const pendentesHoje   = grupos.atrasadas.length + grupos.diaHoje.length
  const concluidasHoje  = tarefas.filter(t => {
    if (!t.concluida || !t.concluidaEm) return false
    const d = t.concluidaEm.toDate(); d.setHours(0, 0, 0, 0)
    return d.getTime() === hoje.getTime()
  }).length
  const streak = useMemo(() => calcularStreak(tarefas), [tarefas])

  function abrirEditar(tarefa: Tarefa) {
    setTarefaEditando(tarefa)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setTarefaEditando(null)
  }

  const diaSemana = hoje.toLocaleDateString('pt-BR', { weekday: 'long' })
  const dataHoje  = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Carregando tarefas...</p>
      </div>
    )
  }

  const temTarefasHoje = grupos.atrasadas.length > 0 || grupos.diaHoje.length > 0
  const temOutrasTarefas = grupos.estaSemana.length > 0 || grupos.proximaSemana.length > 0 || grupos.futuras.length > 0

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6">

        {/* Resumo do dia */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
          <p className="text-sm text-gray-500 capitalize mb-2">
            Hoje é <span className="font-medium text-gray-800">{diaSemana}, {dataHoje}</span>
          </p>
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{pendentesHoje}</span> pendentes hoje
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{concluidasHoje}</span> concluídas hoje
              </span>
            </div>
          </div>
          {streak > 0 && (
            <p className="text-sm text-orange-500 font-medium mt-2">
              🔥 {streak} {streak === 1 ? 'semana consecutiva' : 'semanas consecutivas'} com tarefas concluídas
            </p>
          )}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">Tarefas</h1>
          <button
            onClick={() => { setTarefaEditando(null); setModalAberto(true) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            + Nova tarefa
          </button>
        </div>

        {/* Layout principal: hoje | lateral */}
        <div className="flex gap-5 items-start">

          {/* Coluna principal — Tarefas de hoje */}
          <div className="flex-1 min-w-0">
            {/* Atrasadas */}
            {grupos.atrasadas.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-500 mb-2">Atrasadas</p>
                <div className="space-y-2">
                  {grupos.atrasadas.map(t => (
                    <CardTarefa key={t.id} tarefa={t} onConcluir={concluir} onEditar={abrirEditar} onReabrir={reabrirTarefa} />
                  ))}
                </div>
              </div>
            )}

            {/* Hoje */}
            {grupos.diaHoje.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-2">Hoje</p>
                <div className="space-y-2">
                  {grupos.diaHoje.map(t => (
                    <CardTarefa key={t.id} tarefa={t} onConcluir={concluir} onEditar={abrirEditar} onReabrir={reabrirTarefa} />
                  ))}
                </div>
              </div>
            ) : !temTarefasHoje ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">Nada pra hoje</p>
                <p className="text-xs text-gray-300 mt-1">Aproveite ou crie uma nova tarefa.</p>
              </div>
            ) : null}

            {/* Concluídas (collapsível) */}
            {grupos.concluidas.length > 0 && (
              <ConcluidasCollapse tarefas={grupos.concluidas} onConcluir={concluir} onEditar={abrirEditar} onReabrir={reabrirTarefa} />
            )}
          </div>

          {/* Divisor vertical — só desktop */}
          {temOutrasTarefas && (
            <div className="hidden lg:block w-px bg-gray-100 self-stretch mt-6" />
          )}

          {/* Coluna lateral — outras semanas */}
          {temOutrasTarefas && (
            <div className="hidden lg:block w-52 shrink-0 space-y-4 pt-6">
              <GrupoLateral titulo="Esta semana" tarefas={grupos.estaSemana} onEditar={abrirEditar} />
              <GrupoLateral titulo="Próxima semana" tarefas={grupos.proximaSemana} onEditar={abrirEditar} />
              <GrupoLateral titulo="Mais adiante" tarefas={grupos.futuras} onEditar={abrirEditar} />
            </div>
          )}
        </div>

        {/* Outras semanas — só mobile (abaixo) */}
        {temOutrasTarefas && (
          <div className="lg:hidden mt-6 pt-5 border-t border-gray-100 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-300">Próximas</p>
            <GrupoLateral titulo="Esta semana" tarefas={grupos.estaSemana} onEditar={abrirEditar} />
            <GrupoLateral titulo="Próxima semana" tarefas={grupos.proximaSemana} onEditar={abrirEditar} />
            <GrupoLateral titulo="Mais adiante" tarefas={grupos.futuras} onEditar={abrirEditar} />
          </div>
        )}

      </div>

      {modalAberto && (
        <ModalTarefa
          tarefa={tarefaEditando}
          onClose={fecharModal}
          onSalvar={adicionar}
          onAtualizar={atualizar}
        />
      )}
    </div>
  )
}

function ConcluidasCollapse({ tarefas, onConcluir, onEditar, onReabrir }: {
  tarefas: Tarefa[]
  onConcluir: (t: Tarefa) => void
  onEditar: (t: Tarefa) => void
  onReabrir: (id: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <div className="mt-6">
      <button
        onClick={() => setAberto(v => !v)}
        className="flex items-center gap-2 cursor-pointer"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">
          Concluídas ({tarefas.length})
        </span>
        <span className="text-gray-300 text-xs">{aberto ? '▲' : '▼'}</span>
      </button>
      {aberto && (
        <div className="space-y-2 mt-2">
          {tarefas.map(t => (
            <CardTarefa key={t.id} tarefa={t} onConcluir={onConcluir} onEditar={onEditar} onReabrir={onReabrir} />
          ))}
        </div>
      )}
    </div>
  )
}
