'use client'

import { useState, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { useCrm } from '@/hooks/useCrm'
import CardAniversariante from '@/components/crm/CardAniversariante'
import CardRecuperacao from '@/components/crm/CardRecuperacao'
import { periodoExportacao } from '@/lib/parse-agenda-cross'
import type { AniversarianteStatus, StatusAniversariante, StatusRecuperacao } from '@/types'

type AbaAniv = 'hoje' | 'semana' | 'mes'
type AbaRec = 'todos' | 'clientes' | 'modelos'
type FiltroRec = 'todos' | 'nao_contatadas' | 'contatadas'

const AVEC_ANIV = 'https://admin.avec.beauty/admin/relatorio/0001'
const AVEC_AGENDA = 'https://admin.avec.beauty/admin/relatorio/0051'

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
    uploadInfoAniv, uploadInfo0051,
    templates, templateAnivId, templateRecId,
    uploadAniversariantes, uploadAgenda0051,
    atualizarStatusAniv, atualizarStatusRec, atualizarObservacaoRec,
    salvarConfigTemplate,
  } = useCrm()

  const periodo = periodoExportacao()

  const [aba, setAba] = useState<'aniversariantes' | 'recuperacao'>('aniversariantes')
  const [abaAniv, setAbaAniv] = useState<AbaAniv>('hoje')
  const [abaRec, setAbaRec] = useState<AbaRec>('todos')
  const [filtroRec, setFiltroRec] = useState<FiltroRec>('todos')
  const [soNaoContatadas, setSoNaoContatadas] = useState(false)
  const [uploadingAniv, setUploadingAniv] = useState(false)
  const [uploading0051, setUploading0051] = useState(false)
  const [diasMinimos, setDiasMinimos] = useState(21)
  const [diasMaximos, setDiasMaximos] = useState(90)
  const [inputMin, setInputMin] = useState('21')
  const [inputMax, setInputMax] = useState('90')

  const inputAnivRef = useRef<HTMLInputElement>(null)
  const inputAgendaRef = useRef<HTMLInputElement>(null)

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

  function gerarArquivoMensagens() {
    if (clientesFiltrados.length === 0) return

    const dados = clientesFiltrados.map(c => ({ cliente: c.nome, celular: c.celular, status: 'Recuperacao' }))
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Recuperação')

    const segmento = abaRec === 'modelos' ? 'modelos' : abaRec === 'clientes' ? 'clientes' : 'todos'
    const hoje = new Date()
    const data = `${String(hoje.getDate()).padStart(2, '0')}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${hoje.getFullYear()}`
    XLSX.writeFile(wb, `recuperacao_${segmento}_${diasMinimos}-${diasMaximos}d_${data}.xlsx`)
  }

  async function handleUpload0051(file: File) {
    setUploading0051(true)
    try {
      await uploadAgenda0051(file)
    } catch (e) {
      console.error(e)
      alert('Erro ao processar o arquivo. Verifique se é o relatório 0051 do AVEC.')
    } finally {
      setUploading0051(false)
    }
  }

  const aniversariantesFiltrados = useMemo(() => {
    let lista = filtrarAniversariantes(aniversariantes, abaAniv)
    if (soNaoContatadas) lista = lista.filter(c => c.status === 'nao_contatada')
    return lista
  }, [aniversariantes, abaAniv, soNaoContatadas])

  const clientesFiltrados = useMemo(() => {
    let lista = [...clientes].sort((a, b) => b.diasSemRetorno - a.diasSemRetorno)
    // Aba: clientes vs modelos (isModelo vem direto do Firestore)
    if (abaRec === 'clientes') lista = lista.filter(c => !c.isModelo)
    else if (abaRec === 'modelos') lista = lista.filter(c => c.isModelo)
    // Filtro secundário de contato
    if (filtroRec === 'nao_contatadas') lista = lista.filter(c => c.status === 'nao_contatada')
    if (filtroRec === 'contatadas') lista = lista.filter(c => c.status === 'contatada')
    // Filtro de período (dias sem retorno)
    lista = lista.filter(c => c.diasSemRetorno >= diasMinimos && c.diasSemRetorno <= diasMaximos)
    return lista
  }, [clientes, filtroRec, abaRec, diasMinimos, diasMaximos])

  const totalNaoContatadas = aniversariantes.filter(c => c.status === 'nao_contatada').length
  const totalNaoContatadasRec = clientes.filter(c => c.status === 'nao_contatada').length
  const totalModelos = clientes.filter(c => c.isModelo).length

  const templateAnivConteudo = templates.find(t => t.id === templateAnivId)?.conteudo
  const templateRecConteudo = templates.find(t => t.id === templateRecId)?.conteudo

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

            {/* Seletor de template padrão */}
            <div className="flex items-center gap-2 mb-4 bg-white border border-gray-100 rounded-xl px-4 py-2.5">
              <span className="text-xs text-gray-500 shrink-0">Mensagem padrão:</span>
              <select
                value={templateAnivId}
                onChange={e => salvarConfigTemplate('aniversario', e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-700"
              >
                <option value="">Padrão do sistema</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.titulo}</option>
                ))}
              </select>
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
                    templateConteudo={templateAnivConteudo}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: Recuperação */}
        {aba === 'recuperacao' && (
          <div>
            {/* Instrução com período calculado */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
              <span className="text-base mt-0.5">📋</span>
              <div className="text-xs text-amber-800 leading-relaxed">
                <p className="font-semibold mb-1">Exporte o relatório <strong>0051</strong> no AVEC com o período:</p>
                <p className="text-sm font-bold text-amber-900">{periodo.label}</p>
                <p className="mt-1 text-amber-600">A lista de recuperação e a identificação de modelos são geradas automaticamente. Clientes com agendamento futuro são excluídas.</p>
              </div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                {uploadInfo0051 && (
                  <span className="text-xs text-gray-400">
                    {uploadInfo0051.totalClientes} clientes · atualizado {uploadInfo0051.uploadEm.toDate().toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <a href={AVEC_AGENDA} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition-colors">
                  Abrir 0051 no AVEC ↗
                </a>
                <button
                  onClick={() => inputAgendaRef.current?.click()}
                  disabled={uploading0051}
                  className="px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {uploading0051 ? 'Processando...' : 'Upload 0051'}
                </button>
                <input ref={inputAgendaRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload0051(f); e.target.value = '' }} />
              </div>
            </div>

            {/* Painel de números */}
            {clientes.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{clientes.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Para recuperar</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700">{totalModelos}</p>
                  <p className="text-xs text-purple-600 mt-0.5">Modelos</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{totalNaoContatadasRec}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Não contatadas</p>
                </div>
              </div>
            )}

            {/* Abas: Todos / Clientes / Modelos */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {([
                  { v: 'todos', label: 'Todos' },
                  { v: 'clientes', label: 'Clientes' },
                  { v: 'modelos', label: 'Modelos' },
                ] as const).map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => setAbaRec(v)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      abaRec === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Filtro secundário de contato */}
              <div className="flex gap-1">
                {([
                  { v: 'todos', label: 'Todas' },
                  { v: 'nao_contatadas', label: 'Não contatada' },
                  { v: 'contatadas', label: 'Contatada' },
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
            </div>

            {/* Gerador de arquivo para mensagens */}
            <div className="flex items-center gap-2 mb-4 bg-white border border-gray-100 rounded-xl px-4 py-3 flex-wrap">
              <span className="text-xs text-gray-600 shrink-0">Período:</span>
              <input
                type="text"
                inputMode="numeric"
                value={inputMin}
                onChange={e => setInputMin(e.target.value.replace(/\D/g, ''))}
                onBlur={() => {
                  const v = Math.max(1, parseInt(inputMin) || 1)
                  setDiasMinimos(v)
                  setInputMin(String(v))
                  if (v >= diasMaximos) { setDiasMaximos(v + 1); setInputMax(String(v + 1)) }
                }}
                className="w-14 text-center border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-500 shrink-0">até</span>
              <input
                type="text"
                inputMode="numeric"
                value={inputMax}
                onChange={e => setInputMax(e.target.value.replace(/\D/g, ''))}
                onBlur={() => {
                  const v = Math.max(diasMinimos + 1, parseInt(inputMax) || diasMinimos + 1)
                  setDiasMaximos(v)
                  setInputMax(String(v))
                }}
                className="w-14 text-center border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-600 shrink-0">dias sem retorno</span>
              <span className="text-xs text-gray-400 shrink-0">({clientesFiltrados.length} clientes)</span>
              <button
                onClick={gerarArquivoMensagens}
                disabled={clientesFiltrados.length === 0}
                className="ml-auto px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-40 transition-colors shrink-0"
              >
                ⬇ Baixar XLSX
              </button>
            </div>

            {/* Seletor de template padrão */}
            <div className="flex items-center gap-2 mb-4 bg-white border border-gray-100 rounded-xl px-4 py-2.5">
              <span className="text-xs text-gray-500 shrink-0">Mensagem padrão:</span>
              <select
                value={templateRecId}
                onChange={e => salvarConfigTemplate('recuperacao', e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-700"
              >
                <option value="">Padrão do sistema</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.titulo}</option>
                ))}
              </select>
            </div>

            {loadingRec ? (
              <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
            ) : clientesFiltrados.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-sm">
                  {clientes.length === 0
                    ? 'Nenhum dado ainda. Faça upload do relatório 0051.'
                    : 'Nenhuma cliente neste filtro.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {clientesFiltrados.map(c => (
                  <CardRecuperacao
                    key={c.id}
                    cliente={c}
                    onAtualizarStatus={atualizarStatusRec}
                    onAtualizarObservacao={atualizarObservacaoRec}
                    templateConteudo={templateRecConteudo}
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
