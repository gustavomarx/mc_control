'use client'

import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import type { Tarefa, ResponsavelTarefa, CategoriaTarefa, PrioridadeTarefa, RecorrenciaTarefa, SubtarefaTarefa } from '@/types'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ESTIMATIVAS = ['15min', '30min', '1h', '2h', '+2h']

function gerarId() {
  return Math.random().toString(36).slice(2, 9)
}

function toInputDate(ts?: Timestamp): string {
  if (!ts) return ''
  const d = ts.toDate()
  return d.toISOString().slice(0, 10)
}

interface Props {
  tarefa?: Tarefa | null
  onClose: () => void
  onSalvar: (data: Omit<Tarefa, 'id' | 'criadoEm' | 'atualizadaEm' | 'historico_conclusoes' | 'concluida'>) => Promise<void>
  onAtualizar?: (id: string, data: Partial<Tarefa>) => Promise<void>
}

export default function ModalTarefa({ tarefa, onClose, onSalvar, onAtualizar }: Props) {
  const editando = !!tarefa

  const [titulo, setTitulo] = useState(tarefa?.titulo ?? '')
  const [descricao, setDescricao] = useState(tarefa?.descricao ?? '')
  const [responsavel, setResponsavel] = useState<ResponsavelTarefa>(tarefa?.responsavel ?? 'gabriela')
  const [categoria, setCategoria] = useState<CategoriaTarefa>(tarefa?.categoria ?? 'operacional')
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>(tarefa?.prioridade ?? 'normal')
  const [dataEntrega, setDataEntrega] = useState(toInputDate(tarefa?.dataEntrega))
  const [recorrencia, setRecorrencia] = useState<RecorrenciaTarefa>(tarefa?.recorrencia ?? 'unica')
  const [recorrenciaDia, setRecorrenciaDia] = useState<number>(tarefa?.recorrenciaDia ?? 1)
  const [estimativaTempo, setEstimativaTempo] = useState(tarefa?.estimativaTempo ?? '')
  const [link, setLink] = useState(tarefa?.link ?? '')
  const [subtarefas, setSubtarefas] = useState<SubtarefaTarefa[]>(tarefa?.subtarefas ?? [])
  const [novaSubtarefa, setNovaSubtarefa] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function adicionarSubtarefa() {
    if (!novaSubtarefa.trim()) return
    setSubtarefas(prev => [...prev, { id: gerarId(), titulo: novaSubtarefa.trim(), concluida: false }])
    setNovaSubtarefa('')
  }

  function removerSubtarefa(id: string) {
    setSubtarefas(prev => prev.filter(s => s.id !== id))
  }

  function toggleSubtarefa(id: string) {
    setSubtarefas(prev => prev.map(s => s.id === id ? { ...s, concluida: !s.concluida } : s))
  }

  async function handleSalvar() {
    if (!titulo.trim() || !dataEntrega) return
    setSalvando(true)
    try {
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        responsavel,
        categoria,
        prioridade,
        dataEntrega: Timestamp.fromDate(new Date(dataEntrega + 'T12:00:00')),
        recorrencia,
        ...(recorrencia === 'semanal' || recorrencia === 'mensal' ? { recorrenciaDia } : {}),
        ...(estimativaTempo ? { estimativaTempo } : {}),
        ...(link.trim() ? { link: link.trim() } : {}),
        subtarefas,
      }

      if (editando && onAtualizar) {
        await onAtualizar(tarefa!.id, payload)
      } else {
        await onSalvar(payload)
      }
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {editando ? 'Editar tarefa' : 'Nova tarefa'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="O que precisa ser feito?"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              autoFocus
            />
          </div>

          {/* Responsável */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Responsável</label>
            <div className="flex gap-2">
              {(['gabriela', 'gustavo', 'equipe'] as ResponsavelTarefa[]).map(r => (
                <button
                  key={r}
                  onClick={() => setResponsavel(r)}
                  className={`flex-1 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                    responsavel === r
                      ? 'bg-emerald-500 text-white font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Prioridade */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
            <div className="flex gap-2">
              {([
                { v: 'urgente', label: 'Urgente', cls: 'bg-red-500 text-white', inact: 'bg-red-50 text-red-600 hover:bg-red-100' },
                { v: 'alta',    label: 'Alta',    cls: 'bg-orange-500 text-white', inact: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
                { v: 'normal',  label: 'Normal',  cls: 'bg-blue-500 text-white', inact: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
                { v: 'baixa',   label: 'Baixa',   cls: 'bg-gray-400 text-white', inact: 'bg-gray-100 text-gray-500 hover:bg-gray-200' },
              ] as const).map(({ v, label, cls, inact }) => (
                <button
                  key={v}
                  onClick={() => setPrioridade(v)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${prioridade === v ? cls : inact}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Categoria + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={categoria}
                onChange={e => setCategoria(e.target.value as CategoriaTarefa)}
              >
                <option value="financeiro">Financeiro</option>
                <option value="marketing">Marketing</option>
                <option value="operacional">Operacional</option>
                <option value="atendimento">Atendimento</option>
                <option value="estoque">Estoque</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data de entrega *</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={dataEntrega}
                onChange={e => setDataEntrega(e.target.value)}
              />
            </div>
          </div>

          {/* Recorrência */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Recorrência</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={recorrencia}
              onChange={e => setRecorrencia(e.target.value as RecorrenciaTarefa)}
            >
              <option value="unica">Única</option>
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="mensal">Mensal</option>
            </select>
            {recorrencia === 'semanal' && (
              <div className="flex gap-1 mt-2">
                {DIAS_SEMANA.map((dia, i) => (
                  <button
                    key={i}
                    onClick={() => setRecorrenciaDia(i)}
                    className={`flex-1 py-1 rounded text-xs transition-colors ${
                      recorrenciaDia === i
                        ? 'bg-emerald-500 text-white font-medium'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {dia}
                  </button>
                ))}
              </div>
            )}
            {recorrencia === 'mensal' && (
              <div className="mt-2">
                <label className="text-xs text-gray-500">Dia do mês</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="ml-2 w-16 border border-gray-200 rounded px-2 py-1 text-sm"
                  value={recorrenciaDia}
                  onChange={e => setRecorrenciaDia(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* Estimativa + Link */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estimativa</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={estimativaTempo}
                onChange={e => setEstimativaTempo(e.target.value)}
              >
                <option value="">—</option>
                {ESTIMATIVAS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Link externo</label>
              <input
                type="url"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="https://..."
                value={link}
                onChange={e => setLink(e.target.value)}
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              rows={3}
              placeholder="Detalhes, observações..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>

          {/* Subtarefas */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Subtarefas</label>
            <div className="space-y-1.5 mb-2">
              {subtarefas.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.concluida}
                    onChange={() => toggleSubtarefa(s.id)}
                    className="accent-emerald-500"
                  />
                  <span className={`flex-1 text-sm ${s.concluida ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {s.titulo}
                  </span>
                  <button
                    onClick={() => removerSubtarefa(s.id)}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Nova subtarefa..."
                value={novaSubtarefa}
                onChange={e => setNovaSubtarefa(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarSubtarefa() } }}
              />
              <button
                onClick={adicionarSubtarefa}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || !titulo.trim() || !dataEntrega}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
          >
            {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar tarefa'}
          </button>
        </div>
      </div>
    </div>
  )
}
