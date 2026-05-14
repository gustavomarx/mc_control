'use client'

import { useState, useMemo } from 'react'
import { useTarefas } from '@/hooks/useTarefas'
import CardTarefa from '@/components/tarefas/CardTarefa'
import ModalTarefa from '@/components/tarefas/ModalTarefa'
import type { Tarefa } from '@/types'

type Filtro = 'todos' | 'gabriela' | 'gustavo' | 'equipe' | 'atrasadas' | 'recorrentes'

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

export default function TarefasPage() {
  const { tarefas, loading, adicionar, atualizar, excluir, concluir, reabrirTarefa } = useTarefas()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null)

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const tarefasFiltradas = useMemo(() => {
    if (filtro === 'todos') return tarefas
    if (filtro === 'gabriela') return tarefas.filter(t => t.responsavel === 'gabriela')
    if (filtro === 'gustavo') return tarefas.filter(t => t.responsavel === 'gustavo')
    if (filtro === 'equipe') return tarefas.filter(t => t.responsavel === 'equipe')
    if (filtro === 'atrasadas') return tarefas.filter(t => !t.concluida && t.dataEntrega.toDate() < hoje)
    if (filtro === 'recorrentes') return tarefas.filter(t => t.recorrencia !== 'unica')
    return tarefas
  }, [tarefas, filtro, hoje])

  const pendentesHoje = tarefas.filter(t => {
    if (t.concluida) return false
    const d = t.dataEntrega.toDate()
    d.setHours(0, 0, 0, 0)
    return d.getTime() === hoje.getTime()
  }).length

  const concluidasHoje = tarefas.filter(t => {
    if (!t.concluida || !t.concluidaEm) return false
    const d = t.concluidaEm.toDate()
    d.setHours(0, 0, 0, 0)
    return d.getTime() === hoje.getTime()
  }).length

  const totalAtrasadas = tarefas.filter(t => !t.concluida && t.dataEntrega.toDate() < hoje).length
  const streak = useMemo(() => calcularStreak(tarefas), [tarefas])

  const semanaAtualInicio = inicioSemana(0)
  const semanaAtualFim = fimSemana(0)
  const proximaSemanaInicio = inicioSemana(1)
  const proximaSemanaFim = fimSemana(1)

  const grupos = useMemo(() => {
    const atrasadas = tarefasFiltradas.filter(t =>
      !t.concluida && t.dataEntrega.toDate() < semanaAtualInicio
    )
    const estaSemana = tarefasFiltradas.filter(t => {
      if (t.concluida) return false
      const d = t.dataEntrega.toDate()
      return d >= semanaAtualInicio && d <= semanaAtualFim
    })
    const proximaSemana = tarefasFiltradas.filter(t => {
      if (t.concluida) return false
      const d = t.dataEntrega.toDate()
      return d >= proximaSemanaInicio && d <= proximaSemanaFim
    })
    const futuras = tarefasFiltradas.filter(t => {
      if (t.concluida) return false
      return t.dataEntrega.toDate() > proximaSemanaFim
    })
    const concluidas = tarefasFiltradas.filter(t => t.concluida)

    const porPrioridade = (arr: Tarefa[]) => {
      const ordem = { urgente: 0, alta: 1, normal: 2, baixa: 3 }
      return [...arr].sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade])
    }

    return {
      atrasadas: porPrioridade(atrasadas),
      estaSemana: porPrioridade(estaSemana),
      proximaSemana: porPrioridade(proximaSemana),
      futuras: porPrioridade(futuras),
      concluidas,
    }
  }, [tarefasFiltradas, semanaAtualInicio, semanaAtualFim, proximaSemanaInicio, proximaSemanaFim])

  function abrirEditar(tarefa: Tarefa) {
    setTarefaEditando(tarefa)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setTarefaEditando(null)
  }

  const diaSemana = hoje.toLocaleDateString('pt-BR', { weekday: 'long' })
  const dataHoje = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Carregando tarefas...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Resumo do dia */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          <p className="text-sm text-gray-500 capitalize mb-3">
            Hoje é <span className="font-medium text-gray-800">{diaSemana}, {dataHoje}</span>
          </p>
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-sm text-gray-600"><span className="font-semibold text-gray-900">{pendentesHoje}</span> pendentes hoje</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-sm text-gray-600"><span className="font-semibold text-gray-900">{concluidasHoje}</span> concluídas hoje</span>
            </div>
            {totalAtrasadas > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-sm text-gray-600"><span className="font-semibold text-red-600">{totalAtrasadas}</span> atrasadas</span>
              </div>
            )}
          </div>
          {streak > 0 && (
            <p className="text-sm text-orange-500 font-medium mt-3">
              🔥 {streak} {streak === 1 ? 'semana consecutiva' : 'semanas consecutivas'} com tarefas concluídas
            </p>
          )}
        </div>

        {/* Header + botão */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Tarefas</h1>
          <button
            onClick={() => { setTarefaEditando(null); setModalAberto(true) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            + Nova tarefa
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap mb-6">
          {([
            { v: 'todos',       label: 'Todos' },
            { v: 'gabriela',    label: 'Gabriela' },
            { v: 'gustavo',     label: 'Gustavo' },
            { v: 'equipe',      label: 'Equipe' },
            { v: 'atrasadas',   label: 'Atrasadas' },
            { v: 'recorrentes', label: 'Recorrentes' },
          ] as const).map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setFiltro(v)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                filtro === v
                  ? 'bg-emerald-500 text-white font-medium'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Grupos */}
        <div className="space-y-6">
          <Grupo titulo="Atrasadas" cor="text-red-600" tarefas={grupos.atrasadas} onConcluir={concluir} onEditar={abrirEditar} onReabrir={reabrirTarefa} />
          <Grupo titulo="Esta semana" cor="text-gray-800" tarefas={grupos.estaSemana} onConcluir={concluir} onEditar={abrirEditar} onReabrir={reabrirTarefa} />
          <Grupo titulo="Próxima semana" cor="text-gray-600" tarefas={grupos.proximaSemana} onConcluir={concluir} onEditar={abrirEditar} onReabrir={reabrirTarefa} />
          <Grupo titulo="Mais adiante" cor="text-gray-400" tarefas={grupos.futuras} onConcluir={concluir} onEditar={abrirEditar} onReabrir={reabrirTarefa} />
          {grupos.concluidas.length > 0 && (
            <Grupo titulo={`Concluídas (${grupos.concluidas.length})`} cor="text-gray-400" tarefas={grupos.concluidas} onConcluir={concluir} onEditar={abrirEditar} onReabrir={reabrirTarefa} collapsivel />
          )}
        </div>

        {tarefas.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">Nenhuma tarefa ainda.</p>
            <p className="text-gray-300 text-xs mt-1">Clique em &quot;Nova tarefa&quot; para começar.</p>
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

interface GrupoProps {
  titulo: string
  cor: string
  tarefas: Tarefa[]
  onConcluir: (t: Tarefa) => void
  onEditar: (t: Tarefa) => void
  onReabrir: (id: string) => void
  collapsivel?: boolean
}

function Grupo({ titulo, cor, tarefas, onConcluir, onEditar, onReabrir, collapsivel }: GrupoProps) {
  const [aberto, setAberto] = useState(!collapsivel)
  if (tarefas.length === 0) return null

  return (
    <div>
      <button
        className={`flex items-center gap-2 mb-2 w-full text-left ${collapsivel ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => collapsivel && setAberto(v => !v)}
      >
        <span className={`text-xs font-semibold uppercase tracking-wide ${cor}`}>{titulo}</span>
        {collapsivel && <span className="text-gray-300 text-xs">{aberto ? '▲' : '▼'}</span>}
      </button>
      {aberto && (
        <div className="space-y-2">
          {tarefas.map(t => (
            <CardTarefa
              key={t.id}
              tarefa={t}
              onConcluir={onConcluir}
              onEditar={onEditar}
              onReabrir={onReabrir}
            />
          ))}
        </div>
      )}
    </div>
  )
}
