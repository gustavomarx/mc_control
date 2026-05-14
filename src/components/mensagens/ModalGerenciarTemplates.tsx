'use client'

import { useState } from 'react'
import type { MensagemTemplate, TipoTemplate, CategoriaTemplate } from '@/types'

const VARIAVEIS: string[] = ['{nome}', '{data}', '{hora}', '{servicos}', '{profissional}', '{studio}', '{validade}', '{mensagem}']

const CATEGORIAS: { value: CategoriaTemplate; label: string }[] = [
  { value: 'confirmacao', label: 'Confirmação' },
  { value: 'lembrete', label: 'Lembrete' },
  { value: 'pos_atendimento', label: 'Pós-atendimento' },
  { value: 'aniversario', label: 'Aniversário' },
  { value: 'cobranca', label: 'Cobrança' },
  { value: 'livre', label: 'Livre' },
]

const TIPOS: { value: TipoTemplate; label: string }[] = [
  { value: 'ambos', label: 'Ambos' },
  { value: 'lote', label: 'Lote' },
  { value: 'individual', label: 'Individual' },
]

interface Props {
  templates: MensagemTemplate[]
  onClose: () => void
  onCriar: (data: { titulo: string; tipo: TipoTemplate; categoria: CategoriaTemplate; conteudo: string; ativo: boolean }) => Promise<void>
  onAtualizar: (id: string, data: Partial<MensagemTemplate>) => Promise<void>
}

const formVazio = { titulo: '', tipo: 'ambos' as TipoTemplate, categoria: 'confirmacao' as CategoriaTemplate, conteudo: '', ativo: true }

export default function ModalGerenciarTemplates({ templates, onClose, onCriar, onAtualizar }: Props) {
  const [editando, setEditando] = useState<MensagemTemplate | null>(null)
  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [conteudoRef, setConteudoRef] = useState<HTMLTextAreaElement | null>(null)

  function abrirNovo() {
    setEditando(null)
    setForm(formVazio)
    setCriando(true)
  }

  function abrirEditar(t: MensagemTemplate) {
    setEditando(t)
    setForm({ titulo: t.titulo, tipo: t.tipo, categoria: t.categoria, conteudo: t.conteudo, ativo: t.ativo })
    setCriando(true)
  }

  function inserirVariavel(v: string) {
    if (!conteudoRef) return
    const start = conteudoRef.selectionStart
    const end = conteudoRef.selectionEnd
    const novo = form.conteudo.slice(0, start) + v + form.conteudo.slice(end)
    setForm(f => ({ ...f, conteudo: novo }))
    setTimeout(() => {
      conteudoRef.focus()
      conteudoRef.setSelectionRange(start + v.length, start + v.length)
    }, 0)
  }

  async function salvar() {
    setSalvando(true)
    try {
      if (editando) {
        await onAtualizar(editando.id, form)
      } else {
        await onCriar(form)
      }
      setCriando(false)
      setEditando(null)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {criando ? (editando ? 'Editar template' : 'Novo template') : 'Gerenciar templates'}
          </h2>
          <button onClick={criando ? () => setCriando(false) : onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
            {criando ? '←' : '×'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!criando ? (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={abrirNovo}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  + Novo template
                </button>
              </div>
              <div className="space-y-2">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{t.titulo}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.categoria} · {t.tipo}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {t.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    <button
                      onClick={() => abrirEditar(t)}
                      className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onAtualizar(t.id, { ativo: !t.ativo })}
                      className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      {t.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Título</label>
                <input
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoTemplate }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  >
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Categoria</label>
                  <select
                    value={form.categoria}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value as CategoriaTemplate }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  >
                    {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Conteúdo</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {VARIAVEIS.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => inserirVariavel(v)}
                      className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors font-mono"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={el => setConteudoRef(el)}
                  value={form.conteudo}
                  onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
                  rows={5}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="ativo-toggle"
                  type="checkbox"
                  checked={form.ativo}
                  onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="ativo-toggle" className="text-sm text-gray-600">Ativo</label>
              </div>
            </div>
          )}
        </div>

        {criando && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button
              onClick={() => setCriando(false)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
