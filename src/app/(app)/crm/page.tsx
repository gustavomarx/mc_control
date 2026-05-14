'use client'

import { useState, useRef, useMemo } from 'react'
import { useCrm } from '@/hooks/useCrm'
import CardAniversariante from '@/components/crm/CardAniversariante'
import CardRecuperacao from '@/components/crm/CardRecuperacao'
import type { AniversarianteStatus, StatusAniversariante, StatusRecuperacao } from '@/types'

type AbaAniv = 'hoje' | 'semana' | 'mes'
type FiltroRec = 'todos' | 'nao_contatadas'

const AVEC_ANIV = 'https://admin.avec.beauty/admin/relatorio/0001'
const AVEC_REC = 'https://admin.avec.beauty/admin/relatorio/0057'

function getMesAtual() {
  const d = new Date()
  return { mes: d.getMonth() + 1, ano: d.getFullYear() }
}

function getDiaHoje() {
  return new Date().getDate()
}

function getSegundaFeira(): Date {
  const d = new Date()
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseDiaMes(dataNascimento: string): { dia: number; mes: number } | null {
  if (!dataNascimento) return null
  const partes = dataNascimento.split('/')
  if (partes.length < 2) return null
  return { dia: parseInt(partes[0]), mes: parseInt(partes[1]) }
}

function filtrarAniversariantes(lista: AniversarianteStatus[], aba: AbaAniv): AniversarianteStatus[] {
  const { mes } = getMesAtual()
  const hoje = getDiaHoje()
  const segunda = getSegundaFeira()
  const domingo = new Date(segunda)
  domingo.setDate(domingo.getDate() + 6)

  return lista.filter(c => {
    const dm = parseDiaMes(c.dataNascimento)
    if (!dm) return false
    if (aba === 'hoje') return dm.dia === hoje && dm.mes === mes
    if (aba === 'mes') return dm.mes === mes
    if (aba === 'semana') {
      const ano = new Date().getFullYear()
      const dataAniv = new Date(ano, dm.mes - 1, dm.dia)
      return dataAniv >= segunda && dataAniv <= domingo
    }
    return false
  })
}

export default function CrmPage() {
  const {
    aniversariantes, clientes,
    loadingAniv, loadingRec,
    uploadInfoAniv, uploadInfoRec,
    uploadAniversariantes, uploadRecuperacao,
    atualizarStatusAniv, atualizarStatusRec,
  } = useCrm()

  const [aba, setAba] = useState<'aniversariantes' | 'recuperacao'>('aniversariantes')
  const [abaAniv, setAbaAniv] = useState<AbaAniv>('hoje')
  const [filtroRec, setFiltroRec] = useState<FiltroRec>('todos')
  const [soNaoContatadas, setSoNaoContatadas] = useState(false)
  const [uploadingAniv, setUploadingAniv] = useState(false)
  const [uploadingRec, setUploadingRec] = useState(false)

  const inputAnivRef = useRef<HTMLInputElement>(null)
  const inputRecRef = useRef<HTMLInputElement>(null)

  async function handleUploadAniv(file: File) {
    setUploadingAniv(true)
    try {
      await uploadAniversariantes(file)
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo. Verifique se é o relatório 0001 do AVEC.')
    } finally {
      setUploadingAniv(false)
    }
  }

  async function handleUploadRec(file: File) {
    setUploadingRec(true)
    try {
      await uploadRecuperacao(file)
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo. Verifique se é o relatório 0057 do AVEC.')
    } finally {
      setUploadingRec(false)
    }
  }

  const aniversariantesFiltrados = useMemo(() => {
    let lista = filtrarAniversariantes(aniversariantes, abaAniv)
    if (soNaoContatadas) lista = lista.filter(c => c.status === 'nao_contatada')
    return lista
  }, [aniversariantes, abaAniv, soNaoContatadas])

  const clientesFiltrados = useMemo(() => {
    let lista = [...clientes].sort((a, b) => b.diasSemRetorno - a.diasSemRetorno)
    if (filtroRec === 'nao_contatadas') lista = lista.filter(c => c.status === 'nao_contatada')
    return lista
  }, [clientes, filtroRec])

  const totalNaoContatadas = aniversariantes.filter(c => c.status === 'nao_contatada').length
  const totalNaoContatadasRec = clientes.filter(c => c.status === 'nao_contatada').length

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">

        <h1 className="text-xl font-bold text-gray-900 mb-6">CRM / Relacionamento</h1>

        {/* Abas principais */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {(['aniversariantes', 'recuperacao'] as const).map(a => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                aba === a ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {a === 'aniversariantes' ? '🎂 Aniversariantes' : '🔄 Recuperação'}
            </button>
          ))}
        </div>

        {/* ABA: Aniversariantes */}
        {aba === 'aniversariantes' && (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {uploadInfoAniv && (
                  <span className="text-xs text-gray-400">
                    {uploadInfoAniv.totalClientes} clientes · atualizado {uploadInfoAniv.uploadEm.toDate().toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <a href={AVEC_ANIV} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition-colors">
                  Abrir no AVEC ↗
                </a>
                <button
                  onClick={() => inputAnivRef.current?.click()}
                  disabled={uploadingAniv}
                  className="px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {uploadingAniv ? 'Processando...' : 'Upload XLSX'}
                </button>
                <input ref={inputAnivRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadAniv(f); e.target.value = '' }} />
              </div>
            </div>

            {/* Sub-abas + filtro */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {([
                  { v: 'hoje', label: 'Hoje' },
                  { v: 'semana', label: 'Esta semana' },
                  { v: 'mes', label: 'Este mês' },
                ] as const).map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => setAbaAniv(v)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      abaAniv === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSoNaoContatadas(v => !v)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  soNaoContatadas
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Só não contatadas {soNaoContatadas && `(${totalNaoContatadas})`}
              </button>
            </div>

            {loadingAniv ? (
              <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
            ) : aniversariantesFiltrados.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-sm">
                  {aniversariantes.length === 0
                    ? 'Nenhum dado ainda. Faça upload do relatório 0001.'
                    : 'Nenhum aniversariante neste período.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {aniversariantesFiltrados.map(c => (
                  <CardAniversariante
                    key={c.id}
                    cliente={c}
                    onAtualizarStatus={atualizarStatusAniv}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: Recuperação */}
        {aba === 'recuperacao' && (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {uploadInfoRec && (
                  <span className="text-xs text-gray-400">
                    {uploadInfoRec.totalClientes} clientes · atualizado {uploadInfoRec.uploadEm.toDate().toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <a href={AVEC_REC} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition-colors">
                  Abrir no AVEC ↗
                </a>
                <button
                  onClick={() => inputRecRef.current?.click()}
                  disabled={uploadingRec}
                  className="px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {uploadingRec ? 'Processando...' : 'Upload XLSX'}
                </button>
                <input ref={inputRecRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadRec(f); e.target.value = '' }} />
              </div>
            </div>

            {/* Indicador de retenção */}
            {clientes.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex items-center gap-3">
                <span className="text-lg">📊</span>
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    {clientes.filter(c => c.status === 'agendou').length} de {clientes.length} clientes já retornaram
                    {' '}({clientes.length > 0 ? ((clientes.filter(c => c.status === 'agendou').length / clientes.length) * 100).toFixed(0) : 0}%)
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">{totalNaoContatadasRec} ainda não contatadas</p>
                </div>
              </div>
            )}

            {/* Filtros */}
            <div className="flex gap-2 mb-4">
              {([
                { v: 'todos', label: 'Todos' },
                { v: 'nao_contatadas', label: 'Só não contatadas' },
              ] as const).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setFiltroRec(v)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    filtroRec === v
                      ? 'bg-emerald-500 text-white font-medium'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {loadingRec ? (
              <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
            ) : clientesFiltrados.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-sm">
                  {clientes.length === 0
                    ? 'Nenhum dado ainda. Faça upload do relatório 0057.'
                    : 'Nenhum cliente neste filtro.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {clientesFiltrados.map(c => (
                  <CardRecuperacao
                    key={c.id}
                    cliente={c}
                    onAtualizarStatus={atualizarStatusRec}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
