'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { getCategorias, addCategoria, updateCategoria, getNomesCNPJ, addExtrato, updateExtrato, deleteExtrato, addTransacao, getExtratos, getTransacoesByExtrato, deleteTransacoesByExtrato } from '@/lib/firestore'
import { autoCategoria } from '@/lib/categorias'
import { formatBRL } from '@/lib/utils'
import type { Categoria, Extrato } from '@/types'
import type { LancamentoParsed, ResultadoParse } from '@/lib/sicoob-parser'
import { extrairCNPJ } from '@/lib/sicoob-parser'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

type OrdemCol = 'data' | 'descricao' | 'categoria' | 'tipo' | 'valor'

interface EditableRow {
  _id: string
  data: string
  descricao: string
  descricaoOriginal: string
  valor: number
  tipo: 'C' | 'D'
  categoria: string
  tipo1: string
  cnpj?: string
  nomeEmpresa?: string
  excluir: boolean
}

function uid(): string {
  return Math.random().toString(36).slice(2)
}

function buildRows(lancamentos: LancamentoParsed[], categorias: Categoria[]): EditableRow[] {
  return lancamentos.map(l => {
    const textoMatch = [l.descricaoOriginal, l.nomeEmpresa].filter(Boolean).join(' ')
    const match = autoCategoria(textoMatch, categorias)
    return {
      _id: uid(),
      data: l.data,
      descricao: l.descricao,
      descricaoOriginal: l.descricaoOriginal,
      valor: l.valor,
      tipo: l.tipo,
      categoria: match?.categoria ?? '',
      tipo1: match?.tipo1 ?? '',
      cnpj: l.cnpj,
      nomeEmpresa: l.nomeEmpresa,
      excluir: false,
    }
  })
}

export default function ExtratoPage() {
  const { user } = useAuth()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [processando, setProcessando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoParse | null>(null)
  const [rows, setRows] = useState<EditableRow[]>([])
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [catBulk, setCatBulk] = useState('')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<{ col: OrdemCol; dir: 'asc' | 'desc' } | null>(null)
  const [modalCat, setModalCat] = useState(false)
  const [novaCatNome, setNovaCatNome] = useState('')
  const [novaCatGrupo, setNovaCatGrupo] = useState('')
  const [novaCatKw, setNovaCatKw] = useState('')
  const [salvandoCat, setSalvandoCat] = useState(false)
  const [modalGerenciar, setModalGerenciar] = useState(false)
  const [editandoCatId, setEditandoCatId] = useState<string | null>(null)
  const [kwInput, setKwInput] = useState('')
  const [salvandoKw, setSalvandoKw] = useState(false)
  const [extratosSalvos, setExtratosSalvos] = useState<Extrato[]>([])
  const [carregandoLista, setCarregandoLista] = useState(false)
  const [extratoCarregadoId, setExtratoCarregadoId] = useState<string | null>(null)
  const [excluindoExtratoId, setExcluindoExtratoId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getCategorias().then(setCategorias)
  }, [])

  const catOpcoes = Array.from(new Set(categorias.map(c => c.tipo2))).sort()

  const GRUPOS_FIXOS = [
    'Descontos da Receita',
    'Despesas Fixas',
    'Despesas variáveis',
    'Investimento/Resgate',
    'Receita',
  ]
  const tipo1Opcoes = Array.from(
    new Set([...GRUPOS_FIXOS, ...categorias.map(c => c.tipo1)])
  ).sort()

  async function criarCategoria() {
    if (!novaCatNome.trim() || !novaCatGrupo) return
    setSalvandoCat(true)
    try {
      const maxOrdem = categorias.reduce((m, c) => Math.max(m, c.ordem ?? 0), 0)
      const palavrasChave = novaCatKw
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
      const nova = await addCategoria({
        tipo2: novaCatNome.trim(),
        tipo1: novaCatGrupo,
        palavrasChave,
        ativa: true,
        ordem: maxOrdem + 1,
      })
      const catsAtualizadas = [...categorias, nova]
      setCategorias(catsAtualizadas)
      recategorizarPendentes(catsAtualizadas)
      setModalCat(false)
      setNovaCatNome('')
      setNovaCatGrupo('')
      setNovaCatKw('')
    } finally {
      setSalvandoCat(false)
    }
  }

  const recategorizarPendentes = useCallback((catsAtualizadas: Categoria[]) => {
    setRows(prev => prev.map(r => {
      if (r.excluir) return r
      const textoMatch = [r.descricaoOriginal, r.nomeEmpresa].filter(Boolean).join(' ')
      const match = autoCategoria(textoMatch, catsAtualizadas)
      return match ? { ...r, categoria: match.categoria, tipo1: match.tipo1 } : r
    }))
  }, [])

  async function excluirExtrato(e: React.MouseEvent, extrato: Extrato) {
    e.stopPropagation()
    if (excluindoExtratoId === extrato.id) {
      // Segunda confirmação: executa a exclusão
      try {
        await deleteTransacoesByExtrato(extrato.id)
        await deleteExtrato(extrato.id)
        setExtratosSalvos(prev => prev.filter(ex => ex.id !== extrato.id))
      } finally {
        setExcluindoExtratoId(null)
      }
    } else {
      // Primeira vez: pede confirmação
      setExcluindoExtratoId(extrato.id)
    }
  }

  async function abrirListaExtratos() {
    setCarregandoLista(true)
    const lista = await getExtratos()
    setExtratosSalvos(lista)
    setCarregandoLista(false)
  }

  async function carregarExtrato(extrato: Extrato) {
    setProcessando(true)
    setErro(null)
    setSucesso(false)
    try {
      const transacoes = await getTransacoesByExtrato(extrato.id)
      const rowsCarregadas: EditableRow[] = transacoes.map(t => {
        const ts = t.data.toDate()
        const dd = String(ts.getDate()).padStart(2, '0')
        const mm = String(ts.getMonth() + 1).padStart(2, '0')
        const yyyy = ts.getFullYear()
        return {
          _id: uid(),
          data: `${dd}/${mm}/${yyyy}`,
          descricao: t.descricao,
          descricaoOriginal: t.descricaoOriginal,
          valor: Math.abs(t.valor),
          tipo: t.valor >= 0 ? 'C' : 'D',
          categoria: t.categoria === 'Sem categoria' ? '' : t.categoria,
          tipo1: t.tipo1,
          cnpj: extrairCNPJ(t.descricaoOriginal),
          nomeEmpresa: undefined,
          excluir: false,
        }
      })

      // Enrich with company names from Firestore cache
      const cnpjsUnicos = [...new Set(rowsCarregadas.map(r => r.cnpj).filter(Boolean))] as string[]
      const nomes = cnpjsUnicos.length > 0 ? await getNomesCNPJ(cnpjsUnicos) : new Map<string, string>()
      const rowsEnriquecidas = rowsCarregadas.map(r =>
        r.cnpj && nomes.has(r.cnpj) ? { ...r, nomeEmpresa: nomes.get(r.cnpj) } : r
      )

      setResultado({ mes: extrato.mes, ano: extrato.ano, conta: extrato.banco, lancamentos: [], totalEntradas: 0, totalSaidas: 0, erros: [] })
      setRows(rowsEnriquecidas)
      setExtratoCarregadoId(extrato.id)
      setArquivo(null)
      setExtratosSalvos([])
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar extrato')
    } finally {
      setProcessando(false)
    }
  }

  function abrirEdicaoKw(cat: Categoria) {
    setEditandoCatId(cat.id)
    setKwInput(cat.palavrasChave?.join(', ') ?? '')
  }

  async function salvarKw(cat: Categoria) {
    setSalvandoKw(true)
    const palavrasChave = kwInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    try {
      await updateCategoria(cat.id, { palavrasChave })
      const catsAtualizadas = categorias.map(c => c.id === cat.id ? { ...c, palavrasChave } : c)
      setCategorias(catsAtualizadas)
      recategorizarPendentes(catsAtualizadas)
      setEditandoCatId(null)
      setKwInput('')
    } finally {
      setSalvandoKw(false)
    }
  }

  async function processarPDF(file: File) {
    setArquivo(file)
    setProcessando(true)
    setErro(null)
    setSucesso(false)
    setSelecionados(new Set())
    setBusca('')
    setOrdem(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/extrato', { method: 'POST', body: fd })
      if (!res.ok) {
        let msg = 'Erro ao processar PDF'
        try { const d = await res.json(); msg = d.error ?? msg } catch { /* resposta não é JSON */ }
        throw new Error(msg)
      }
      const data: ResultadoParse = await res.json()
      setResultado(data)
      setRows(buildRows(data.lancamentos, categorias))
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado')
      setArquivo(null)
      setResultado(null)
    } finally {
      setProcessando(false)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processarPDF(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') processarPDF(file)
  }

  function setRow(id: string, patch: Partial<EditableRow>) {
    setRows(prev => prev.map(r => r._id === id ? { ...r, ...patch } : r))
  }

  function setCategoriaRow(id: string, catNome: string) {
    const cat = categorias.find(c => c.tipo2 === catNome)
    setRow(id, { categoria: catNome, tipo1: cat?.tipo1 ?? '' })
  }

  function toggleOrdem(col: OrdemCol) {
    setOrdem(prev =>
      prev?.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' }
    )
  }

  // Filtragem por busca
  const rowsFiltrados = rows.filter(r => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return (
      r.descricao.toLowerCase().includes(q) ||
      r.descricaoOriginal.toLowerCase().includes(q) ||
      r.nomeEmpresa?.toLowerCase().includes(q) ||
      r.cnpj?.toLowerCase().includes(q) ||
      r.categoria.toLowerCase().includes(q)
    )
  })

  // Ordenação
  const rowsVisiveis = [...rowsFiltrados].sort((a, b) => {
    if (!ordem) return 0
    const { col, dir } = ordem
    let cmp = 0
    if (col === 'data') cmp = a.data.localeCompare(b.data)
    else if (col === 'descricao') cmp = a.descricao.localeCompare(b.descricao, 'pt-BR')
    else if (col === 'categoria') cmp = a.categoria.localeCompare(b.categoria, 'pt-BR')
    else if (col === 'tipo') cmp = a.tipo.localeCompare(b.tipo)
    else if (col === 'valor') cmp = a.valor - b.valor
    return dir === 'asc' ? cmp : -cmp
  })

  // Seleção (considera apenas os filtrados visíveis)
  const ativasIds = rowsFiltrados.filter(r => !r.excluir).map(r => r._id)
  const todosSelecionados = ativasIds.length > 0 && ativasIds.every(id => selecionados.has(id))
  const algumSelecionado = selecionados.size > 0

  function toggleSelecionado(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (todosSelecionados) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(ativasIds))
    }
  }

  function aplicarCategoriaBulk() {
    if (!catBulk) return
    const cat = categorias.find(c => c.tipo2 === catBulk)
    setRows(prev => prev.map(r =>
      selecionados.has(r._id)
        ? { ...r, categoria: catBulk, tipo1: cat?.tipo1 ?? '' }
        : r
    ))
    setSelecionados(new Set())
    setCatBulk('')
  }

  async function salvar() {
    if (!resultado) return
    setSalvando(true)
    setErro(null)
    try {
      const ativas = rows.filter(r => !r.excluir)
      const totalEntradas = ativas.filter(r => r.tipo === 'C').reduce((s, r) => s + r.valor, 0)
      const totalSaidas = ativas.filter(r => r.tipo === 'D').reduce((s, r) => s + r.valor, 0)
      const temPendente = ativas.some(r => !r.categoria)

      let extratoId: string
      if (extratoCarregadoId) {
        // Atualiza extrato existente
        await updateExtrato(extratoCarregadoId, {
          totalLancamentos: ativas.length,
          totalEntradas,
          totalSaidas,
          status: temPendente ? 'com_pendencias' : 'processado',
        })
        await deleteTransacoesByExtrato(extratoCarregadoId)
        extratoId = extratoCarregadoId
      } else {
        // Cria novo extrato
        const ref = await addExtrato({
          mes: resultado.mes,
          ano: resultado.ano,
          banco: 'Sicoob',
          nomeArquivo: arquivo?.name ?? '',
          dataUpload: Timestamp.now(),
          usuarioId: user?.uid ?? '',
          totalLancamentos: ativas.length,
          totalEntradas,
          totalSaidas,
          status: temPendente ? 'com_pendencias' : 'processado',
        })
        extratoId = ref.id
      }

      for (const row of ativas) {
        const [dd, mm, yyyy] = row.data.split('/').map(Number)
        await addTransacao({
          data: Timestamp.fromDate(new Date(yyyy, mm - 1, dd)),
          descricao: row.descricao,
          descricaoOriginal: row.descricaoOriginal,
          valor: row.tipo === 'C' ? row.valor : -row.valor,
          categoria: row.categoria || 'Sem categoria',
          tipo1: row.tipo1 || '',
          origem: 'Sicoob',
          mes: resultado.mes,
          ano: resultado.ano,
          extratoId,
          status: row.categoria ? 'categorizado' : 'pendente',
        })
      }

      setSucesso(true)
      setArquivo(null)
      setResultado(null)
      setRows([])
      setSelecionados(new Set())
      setExtratoCarregadoId(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar extrato')
    } finally {
      setSalvando(false)
    }
  }

  function novoUpload() {
    setArquivo(null)
    setResultado(null)
    setRows([])
    setErro(null)
    setSucesso(false)
    setSelecionados(new Set())
    setBusca('')
    setOrdem(null)
    setExtratoCarregadoId(null)
    setExtratosSalvos([])
    if (inputRef.current) inputRef.current.value = ''
  }

  const ativas = rows.filter(r => !r.excluir)
  const pendentes = ativas.filter(r => !r.categoria).length
  const totalEntradas = ativas.filter(r => r.tipo === 'C').reduce((s, r) => s + r.valor, 0)
  const totalSaidas = ativas.filter(r => r.tipo === 'D').reduce((s, r) => s + r.valor, 0)

  return (
    <div className="flex flex-col h-full">

      {/* ── Header fixo ─────────────────────────────────────────────────────── */}
      <div className="bg-white px-8 pt-8 pb-3 border-b border-gray-100 shrink-0">
        {/* Título */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Extrato Bancário</h1>
            {resultado && (
              <p className="text-sm text-gray-500 mt-0.5">
                {MESES[resultado.mes - 1]} {resultado.ano} · {resultado.conta}
                {extratoCarregadoId && <span className="ml-2 text-amber-500">· editando</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setModalGerenciar(true)} className="text-sm text-gray-500 hover:text-gray-700">
              Categorias
            </button>
            {resultado && (
              <button onClick={novoUpload} className="text-sm text-gray-500 hover:text-gray-700">
                ← Novo upload
              </button>
            )}
          </div>
        </div>

        {sucesso && (
          <div className="mb-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            Extrato salvo com sucesso!
          </div>
        )}
        {erro && (
          <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {erro}
          </div>
        )}

        {/* KPIs + busca + action bar — só quando há resultado */}
        {resultado && rows.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="card">
                <p className="text-xs text-gray-500 mb-1">Entradas</p>
                <p className="text-lg font-semibold text-emerald-600">{formatBRL(totalEntradas)}</p>
              </div>
              <div className="card">
                <p className="text-xs text-gray-500 mb-1">Saídas</p>
                <p className="text-lg font-semibold text-red-500">{formatBRL(totalSaidas)}</p>
              </div>
              <div className="card">
                <p className="text-xs text-gray-500 mb-1">Sem categoria</p>
                <p className={`text-lg font-semibold ${pendentes > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {pendentes} lançamento{pendentes !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Busca */}
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                placeholder="Buscar por descrição, empresa, CNPJ ou categoria..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              />
              <button
                onClick={() => setModalCat(true)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 whitespace-nowrap"
              >
                + Categoria
              </button>
            </div>

            {/* Action bar */}
            {algumSelecionado ? (
              <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                <span className="text-sm font-medium text-emerald-800">
                  {selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <select
                    className="text-xs border border-emerald-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-400 bg-white text-gray-700"
                    value={catBulk}
                    onChange={e => setCatBulk(e.target.value)}
                  >
                    <option value="">Escolha a categoria...</option>
                    {catOpcoes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    onClick={aplicarCategoriaBulk}
                    disabled={!catBulk}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Aplicar
                  </button>
                  <button onClick={() => setSelecionados(new Set())} className="text-xs text-emerald-600 hover:text-emerald-800 px-2">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {ativas.length} lançamento{ativas.length !== 1 ? 's' : ''}
                  {rows.some(r => r.excluir) && (
                    <span className="ml-2 text-xs text-gray-400">
                      ({rows.filter(r => r.excluir).length} removido{rows.filter(r => r.excluir).length !== 1 ? 's' : ''})
                    </span>
                  )}
                </p>
                <button
                  onClick={salvar}
                  disabled={salvando || ativas.length === 0}
                  className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {salvando ? 'Salvando...' : 'Salvar extrato'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {/* ── fim header fixo ──────────────────────────────────────────────────── */}

      {/* Conteúdo rolável */}
      <div className="flex-1 overflow-auto px-8 pt-4 pb-8">
      <div className="max-w-6xl mx-auto">

      {/* Upload zone */}
      {!resultado && !processando && (
        <div className="mt-6 space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer
              ${dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />
            <p className="text-2xl mb-3">📄</p>
            <p className="text-sm font-medium text-gray-700">Arraste o PDF do Sicoob ou clique para selecionar</p>
            <p className="text-xs text-gray-400 mt-1">Apenas arquivos .pdf</p>
          </div>

          {/* Extratos salvos */}
          <div>
            {extratosSalvos.length === 0 ? (
              <button
                onClick={abrirListaExtratos}
                disabled={carregandoLista}
                className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors"
              >
                {carregandoLista ? 'Carregando...' : 'Carregar extrato salvo'}
              </button>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Extratos salvos</p>
                  <button onClick={() => setExtratosSalvos([])} className="text-xs text-gray-400 hover:text-gray-600">Fechar</button>
                </div>
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {extratosSalvos.map(e => {
                    const dataUpload = e.dataUpload.toDate()
                    const status = e.status === 'com_pendencias' ? 'com pendências' : 'processado'
                    const confirmando = excluindoExtratoId === e.id
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
                        onMouseLeave={() => { if (confirmando) setExcluindoExtratoId(null) }}
                      >
                        <button
                          onClick={() => carregarExtrato(e)}
                          className="flex-1 text-left flex items-center justify-between gap-4 min-w-0"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {MESES[e.mes - 1]} {e.ano} · {e.banco}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {e.nomeArquivo} · {e.totalLancamentos} lançamentos
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-400">
                              {dataUpload.toLocaleDateString('pt-BR')} {dataUpload.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className={`text-xs mt-0.5 ${e.status === 'com_pendencias' ? 'text-amber-500' : 'text-emerald-600'}`}>
                              {status}
                            </p>
                          </div>
                        </button>
                        <button
                          onClick={ev => excluirExtrato(ev, e)}
                          className={`shrink-0 text-xs px-2 py-1 rounded transition-colors whitespace-nowrap
                            ${confirmando
                              ? 'bg-red-100 text-red-700 hover:bg-red-200 font-medium'
                              : 'text-gray-300 hover:text-red-400'}`}
                          title="Excluir extrato"
                        >
                          {confirmando ? 'Confirmar exclusão' : '✕'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {processando && (
        <div className="flex items-center justify-center py-24 text-sm text-gray-400">
          Processando PDF...
        </div>
      )}

      {/* Tabela */}
      {resultado && rows.length > 0 && (
        <>
          <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={todosSelecionados}
                        onChange={toggleTodos}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-400"
                        title="Selecionar todos visíveis"
                      />
                    </th>
                    <SortTh col="data" label="Data" ordem={ordem} onClick={toggleOrdem} align="left" />
                    <SortTh col="descricao" label="Descrição" ordem={ordem} onClick={toggleOrdem} align="left" />
                    <SortTh col="categoria" label="Categoria" ordem={ordem} onClick={toggleOrdem} align="left" />
                    <SortTh col="tipo" label="Tipo" ordem={ordem} onClick={toggleOrdem} align="center" />
                    <SortTh col="valor" label="Valor" ordem={ordem} onClick={toggleOrdem} align="right" />
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rowsVisiveis.map(row => {
                    const selecionado = selecionados.has(row._id)
                    return (
                      <tr
                        key={row._id}
                        className={`transition-colors
                          ${row.excluir ? 'opacity-40' : ''}
                          ${selecionado ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3">
                          {!row.excluir && (
                            <input
                              type="checkbox"
                              checked={selecionado}
                              onChange={() => toggleSelecionado(row._id)}
                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-400"
                            />
                          )}
                        </td>

                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {row.data.slice(0, 5)}
                        </td>

                        {/* Descrição editável */}
                        <td className="px-4 py-3">
                          {editandoId === row._id ? (
                            <input
                              autoFocus
                              className="w-full text-sm border-b border-emerald-400 outline-none bg-transparent"
                              value={row.descricao}
                              onChange={e => setRow(row._id, { descricao: e.target.value })}
                              onBlur={() => setEditandoId(null)}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditandoId(null) }}
                            />
                          ) : (
                            <button
                              className={`text-left w-full whitespace-normal break-all ${row.excluir ? '' : 'hover:text-emerald-700'}`}
                              onClick={() => !row.excluir && setEditandoId(row._id)}
                              disabled={row.excluir}
                            >
                              {row.descricao || <span className="text-gray-300">—</span>}
                            </button>
                          )}
                          {(row.nomeEmpresa || row.cnpj) && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {row.nomeEmpresa ?? row.cnpj}
                            </p>
                          )}
                        </td>

                        {/* Categoria */}
                        <td className="px-4 py-3">
                          <select
                            className={`text-xs border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-400
                              ${!row.categoria ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 bg-transparent text-gray-700'}`}
                            value={row.categoria}
                            onChange={e => setCategoriaRow(row._id, e.target.value)}
                            disabled={row.excluir}
                          >
                            <option value="">Sem categoria</option>
                            {catOpcoes.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>

                        {/* Tipo C/D */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setRow(row._id, { tipo: row.tipo === 'C' ? 'D' : 'C' })}
                            disabled={row.excluir}
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium transition-colors
                              ${row.tipo === 'C'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                            title="Clique para alternar"
                          >
                            {row.tipo === 'C' ? 'Entrada' : 'Saída'}
                          </button>
                        </td>

                        {/* Valor */}
                        <td className={`px-4 py-3 text-right font-medium whitespace-nowrap
                          ${row.tipo === 'C' ? 'text-emerald-700' : 'text-red-600'}`}>
                          {row.tipo === 'D' ? '−' : '+'}{formatBRL(row.valor)}
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setRow(row._id, { excluir: !row.excluir })
                              if (!row.excluir) setSelecionados(prev => { const n = new Set(prev); n.delete(row._id); return n })
                            }}
                            className={`text-xs ${row.excluir ? 'text-gray-400 hover:text-gray-600' : 'text-red-400 hover:text-red-600'}`}
                            title={row.excluir ? 'Restaurar' : 'Remover'}
                          >
                            {row.excluir ? 'Restaurar' : '✕'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex gap-6 text-xs text-gray-600">
                <span>Entradas: <strong className="text-emerald-700">{formatBRL(totalEntradas)}</strong></span>
                <span>Saídas: <strong className="text-red-600">{formatBRL(totalSaidas)}</strong></span>
                <span>Saldo: <strong className={totalEntradas - totalSaidas >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                  {formatBRL(totalEntradas - totalSaidas)}
                </strong></span>
              </div>
              <button
                onClick={salvar}
                disabled={salvando || ativas.length === 0}
                className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {salvando ? 'Salvando...' : 'Salvar extrato'}
              </button>
            </div>
          </div>
        </>
      )}

      {resultado && rows.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-400">
          Nenhum lançamento encontrado no PDF.
        </div>
      )}

      </div>{/* fim max-w-6xl */}
      </div>{/* fim conteúdo rolável */}

      {/* Modal — gerenciar categorias */}
      {modalGerenciar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Categorias</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setModalGerenciar(false); setModalCat(true) }}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  + Nova
                </button>
                <button
                  onClick={() => { setModalGerenciar(false); setEditandoCatId(null) }}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {Object.entries(
                categorias.reduce<Record<string, Categoria[]>>((acc, cat) => {
                  ;(acc[cat.tipo1] ??= []).push(cat)
                  return acc
                }, {})
              )
                .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
                .map(([grupo, cats]) => (
                  <div key={grupo}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{grupo}</p>
                    <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                      {cats.map(cat => (
                        <div key={cat.id} className="px-3 py-2.5">
                          {editandoCatId === cat.id ? (
                            <div>
                              <p className="text-sm font-medium text-gray-900 mb-1.5">{cat.tipo2}</p>
                              <input
                                autoFocus
                                type="text"
                                value={kwInput}
                                onChange={e => setKwInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') salvarKw(cat)
                                  if (e.key === 'Escape') { setEditandoCatId(null); setKwInput('') }
                                }}
                                placeholder="PALAVRA1, PALAVRA2, ..."
                                className="w-full px-2.5 py-1.5 text-xs border border-emerald-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
                              />
                              <div className="flex gap-2 mt-1.5">
                                <button
                                  onClick={() => salvarKw(cat)}
                                  disabled={salvandoKw}
                                  className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40"
                                >
                                  {salvandoKw ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button
                                  onClick={() => { setEditandoCatId(null); setKwInput('') }}
                                  className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button className="w-full text-left group" onClick={() => abrirEdicaoKw(cat)}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-800 group-hover:text-emerald-700 transition-colors">
                                    {cat.tipo2}
                                  </p>
                                  {cat.palavrasChave?.length > 0 ? (
                                    <p className="text-xs text-gray-400 font-mono truncate mt-0.5">
                                      {cat.palavrasChave.join(', ')}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-amber-500 mt-0.5">Sem palavras-chave</p>
                                  )}
                                </div>
                                <span className="text-xs text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0 mt-0.5">
                                  Editar
                                </span>
                              </div>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal — nova categoria */}
      {modalCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Nova categoria</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nome</label>
                <input
                  autoFocus
                  type="text"
                  value={novaCatNome}
                  onChange={e => setNovaCatNome(e.target.value)}
                  placeholder="Ex: Manutenção"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Grupo (tipo1)</label>
                <select
                  value={novaCatGrupo}
                  onChange={e => setNovaCatGrupo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                >
                  <option value="">Selecione...</option>
                  {tipo1Opcoes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Palavras-chave <span className="text-gray-400">(opcional, separadas por vírgula)</span>
                </label>
                <input
                  type="text"
                  value={novaCatKw}
                  onChange={e => setNovaCatKw(e.target.value)}
                  placeholder="Ex: LIMPEZA, MANUTENCAO"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setModalCat(false); setNovaCatNome(''); setNovaCatGrupo(''); setNovaCatKw('') }}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={criarCategoria}
                disabled={!novaCatNome.trim() || !novaCatGrupo || salvandoCat}
                className="flex-1 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {salvandoCat ? 'Salvando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SortTh({
  col, label, ordem, onClick, align,
}: {
  col: OrdemCol
  label: string
  ordem: { col: OrdemCol; dir: 'asc' | 'desc' } | null
  onClick: (col: OrdemCol) => void
  align: 'left' | 'center' | 'right'
}) {
  const ativo = ordem?.col === col
  const alignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'
  return (
    <th className={`px-4 py-3 ${alignClass}`}>
      <button
        onClick={() => onClick(col)}
        className={`text-xs font-medium inline-flex items-center gap-1 hover:text-gray-800 transition-colors
          ${ativo ? 'text-emerald-600' : 'text-gray-500'}`}
      >
        {label}
        <span className="text-gray-300">
          {ativo ? (ordem.dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}
