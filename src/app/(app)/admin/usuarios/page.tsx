'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { getUsuarios } from '@/lib/firestore'
import type { Usuario, PerfilUsuario, PermissoesUsuario, NivelTarefas } from '@/types'
import { PERMISSOES_PADRAO } from '@/types'

const BADGE: Record<PerfilUsuario, string> = {
  admin: 'bg-purple-100 text-purple-700',
  atendente: 'bg-blue-100 text-blue-700',
}

const MODULOS: { key: keyof Omit<PermissoesUsuario, 'tarefasNivel'>; label: string }[] = [
  { key: 'mensagens',   label: 'Mensagens' },
  { key: 'tarefas',    label: 'Tarefas' },
  { key: 'agenda',     label: 'Agenda' },
  { key: 'crm',        label: 'CRM' },
  { key: 'comissoes',  label: 'Comissões' },
  { key: 'caixa',      label: 'Caixa' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'facebook_ads', label: 'Facebook Ads' },
]

export default function UsuariosPage() {
  const { usuario, perfil } = useAuth()
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    perfil: 'atendente' as PerfilUsuario,
    permissoes: { ...PERMISSOES_PADRAO } as PermissoesUsuario,
  })

  useEffect(() => {
    if (perfil && perfil !== 'admin') router.replace('/mensagens')
  }, [perfil, router])

  useEffect(() => {
    if (perfil !== 'admin') return
    getUsuarios().then(data => { setUsuarios(data); setLoading(false) })
  }, [perfil])

  function abrirNovoModal() {
    setEditando(null)
    setForm({ nome: '', email: '', senha: '', perfil: 'atendente', permissoes: { ...PERMISSOES_PADRAO } })
    setErro('')
    setModalAberto(true)
  }

  function abrirEditarModal(u: Usuario) {
    setEditando(u)
    setForm({ nome: u.nome, email: u.email, senha: '', perfil: u.perfil, permissoes: { ...PERMISSOES_PADRAO, ...u.permissoes } })
    setErro('')
    setModalAberto(true)
  }

  function toggleModulo(key: keyof Omit<PermissoesUsuario, 'tarefasNivel'>) {
    setForm(f => ({ ...f, permissoes: { ...f.permissoes, [key]: !f.permissoes[key] } }))
  }

  function setNivelTarefas(nivel: NivelTarefas) {
    setForm(f => ({ ...f, permissoes: { ...f.permissoes, tarefasNivel: nivel } }))
  }

  async function salvar() {
    setErro('')
    setSalvando(true)
    try {
      if (editando) {
        const patch: Record<string, unknown> = { nome: form.nome, perfil: form.perfil }
        if (form.perfil !== 'admin') patch.permissoes = form.permissoes
        const res = await fetch(`/api/usuarios/${editando.uid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        setUsuarios(prev => prev.map(u => u.uid === editando.uid
          ? { ...u, nome: form.nome, perfil: form.perfil, permissoes: form.permissoes }
          : u))
      } else {
        const res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const lista = await getUsuarios()
        setUsuarios(lista)
      }
      setModalAberto(false)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function alterarAtivo(u: Usuario, ativo: boolean) {
    if (u.uid === usuario?.uid) return
    const method = ativo ? 'PATCH' : 'DELETE'
    const body = ativo ? JSON.stringify({ ativo: true }) : undefined
    const res = await fetch(`/api/usuarios/${u.uid}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (res.ok) {
      setUsuarios(prev => prev.map(x => x.uid === u.uid ? { ...x, ativo } : x))
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Usuários</h1>
          <button
            onClick={abrirNovoModal}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            + Novo usuário
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">E-mail</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Perfil</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usuarios.map(u => (
                <tr key={u.uid} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[u.perfil]}`}>
                      {u.perfil === 'admin' ? 'Admin' : 'Atendente'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => abrirEditarModal(u)}
                        className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        Editar
                      </button>
                      {u.uid !== usuario?.uid && (
                        u.ativo
                          ? <button
                              onClick={() => alterarAtivo(u, false)}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors"
                            >
                              Desativar
                            </button>
                          : <button
                              onClick={() => alterarAtivo(u, true)}
                              className="text-xs text-emerald-500 hover:text-emerald-700 transition-colors"
                            >
                              Reativar
                            </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-gray-900 mb-5">
              {editando ? 'Editar usuário' : 'Novo usuário'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nome</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>
              {!editando && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">E-mail</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Senha temporária</label>
                    <input
                      type="password"
                      value={form.senha}
                      onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Perfil</label>
                <select
                  value={form.perfil}
                  onChange={e => setForm(f => ({ ...f, perfil: e.target.value as PerfilUsuario }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                >
                  <option value="atendente">Atendente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {form.perfil !== 'admin' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-2">Módulos</label>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {MODULOS.map(({ key, label }) => (
                      <div key={key}>
                        <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={form.permissoes[key]}
                            onChange={() => toggleModulo(key)}
                            className="accent-emerald-500"
                          />
                          <span className="text-sm text-gray-700">{label}</span>
                        </label>
                        {key === 'tarefas' && form.permissoes.tarefas && (
                          <div className="flex gap-3 px-9 pb-2.5">
                            {(['equipe', 'todos'] as NivelTarefas[]).map(nivel => (
                              <label key={nivel} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="tarefasNivel"
                                  value={nivel}
                                  checked={form.permissoes.tarefasNivel === nivel}
                                  onChange={() => setNivelTarefas(nivel)}
                                  className="accent-emerald-500"
                                />
                                <span className="text-xs text-gray-600 capitalize">
                                  {nivel === 'equipe' ? 'Somente equipe' : 'Todos'}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {erro && <p className="text-xs text-red-500 mt-3">{erro}</p>}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalAberto(false)}
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
          </div>
        </div>
      )}
    </div>
  )
}
