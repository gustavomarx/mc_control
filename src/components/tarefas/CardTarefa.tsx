'use client'

import type { Tarefa } from '@/types'

const PRIORIDADE_CONFIG = {
  urgente: { label: 'Urgente', cls: 'bg-red-100 text-red-700' },
  alta:    { label: 'Alta',    cls: 'bg-orange-100 text-orange-700' },
  normal:  { label: 'Normal',  cls: 'bg-blue-100 text-blue-700' },
  baixa:   { label: 'Baixa',   cls: 'bg-gray-100 text-gray-500' },
}

const CATEGORIA_CONFIG: Record<string, string> = {
  financeiro:   'bg-emerald-50 text-emerald-700',
  marketing:    'bg-purple-50 text-purple-700',
  operacional:  'bg-yellow-50 text-yellow-700',
  atendimento:  'bg-sky-50 text-sky-700',
  estoque:      'bg-orange-50 text-orange-700',
  outro:        'bg-gray-50 text-gray-600',
}

const RESPONSAVEL_AVATAR: Record<string, string> = {
  gabriela: 'G',
  gustavo:  'Gu',
  equipe:   'Eq',
}

function formatarData(ts: import('firebase/firestore').Timestamp): string {
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function isAtrasada(tarefa: Tarefa): boolean {
  if (tarefa.concluida) return false
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const entrega = tarefa.dataEntrega.toDate()
  entrega.setHours(0, 0, 0, 0)
  return entrega < hoje
}

interface Props {
  tarefa: Tarefa
  onConcluir: (tarefa: Tarefa) => void
  onEditar: (tarefa: Tarefa) => void
  onReabrir?: (id: string) => void
}

export default function CardTarefa({ tarefa, onConcluir, onEditar, onReabrir }: Props) {
  const atrasada = isAtrasada(tarefa)
  const subtarefasTotal = tarefa.subtarefas.length
  const subtarefasConcluidas = tarefa.subtarefas.filter(s => s.concluida).length
  const prioridade = PRIORIDADE_CONFIG[tarefa.prioridade]

  return (
    <div
      className={`flex gap-3 p-3 rounded-xl border transition-colors ${
        tarefa.concluida
          ? 'bg-gray-50 border-gray-100 opacity-60'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => tarefa.concluida ? onReabrir?.(tarefa.id) : onConcluir(tarefa)}
        className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          tarefa.concluida
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-gray-300 hover:border-emerald-400'
        }`}
      >
        {tarefa.concluida && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEditar(tarefa)}>
        <div className="flex items-start gap-2 flex-wrap">
          <span className={`text-sm font-medium text-gray-900 ${tarefa.concluida ? 'line-through text-gray-400' : ''}`}>
            {tarefa.titulo}
          </span>
          {atrasada && (
            <span className="text-xs font-medium bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
              Atrasada
            </span>
          )}
          {tarefa.recorrencia !== 'unica' && (
            <span className="text-xs text-gray-400">↺</span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Prioridade */}
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${prioridade.cls}`}>
            {prioridade.label}
          </span>

          {/* Categoria */}
          <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${CATEGORIA_CONFIG[tarefa.categoria]}`}>
            {tarefa.categoria}
          </span>

          {/* Data */}
          <span className={`text-xs ${atrasada ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {formatarData(tarefa.dataEntrega)}
          </span>

          {/* Estimativa */}
          {tarefa.estimativaTempo && (
            <span className="text-xs text-gray-400">{tarefa.estimativaTempo}</span>
          )}

          {/* Subtarefas */}
          {subtarefasTotal > 0 && (
            <span className="text-xs text-gray-400">
              {subtarefasConcluidas}/{subtarefasTotal} subtarefas
            </span>
          )}
        </div>
      </div>

      {/* Link externo */}
      {tarefa.link && (
        <a
          href={tarefa.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
          title={tarefa.link}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}

      {/* Avatar responsável */}
      <div className="shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
        <span className="text-xs font-medium text-gray-600">
          {RESPONSAVEL_AVATAR[tarefa.responsavel]}
        </span>
      </div>
    </div>
  )
}
