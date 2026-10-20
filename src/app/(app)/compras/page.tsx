'use client'

import { useState, useMemo, useRef } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'
import {
  useCompras, useLojasCompras, useMateriaisCompras,
  type CompraInput, type Autor,
} from '@/hooks/useCompras'
import { formatBRL } from '@/lib/utils'
import type { Compra } from '@/types'

const MESES_NOMES = [
  'Jan','Fev','Mar','Abr','Mai','Jun',
  'Jul','Ago','Set','Out','Nov','Dez',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

// "1.234,56" | "1234.56" | "19,9" → número
function parseNum(s: string): number {
  const t = s.trim()
  if (!t) return 0
  const n = t.includes(',') ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t)
  return isNaN(n) ? 0 : n
}

function numStr(n: number): string {
  return n ? String(n).replace('.', ',') : ''
}

const fmtMoeda = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Máscara de moeda: os dígitos digitados entram pelos centavos ("1990" → "19,90")
function mascaraMoeda(raw: string): string {
  const digitos = raw.replace(/\D/g, '').replace(/^0+/, '')
  if (!digitos) return ''
  return fmtMoeda(parseInt(digitos, 10) / 100)
}

// YYYY-MM-DD local ↔ Timestamp (meio-dia evita virar o dia por fuso)
function toInputDate(ts: Timestamp): string {
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fromInputDate(s: string): Timestamp {
  const [y, m, d] = s.split('-').map(Number)
  return Timestamp.fromDate(new Date(y, m - 1, d, 12))
}
function fmtData(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('pt-BR')
}
function fmtDataHora(ts: Timestamp): string {
  return ts.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Sem acento e minúsculo, para busca
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Itens lançados juntos (lote). Itens antigos sem loteId agrupam por criação + autor.
function grupoDe(c: Compra): string {
  return c.loteId || `${c.criadoEm.toMillis()}|${c.criadoPor}`
}

interface ItemForm {
  id?: string
  material: string
  quantidade: string
  valorUnitario: string
}

const ITEM_VAZIO: ItemForm = { material: '', quantidade: '1', valorUnitario: '' }
const LINHAS_INICIAIS = 3
const novasLinhas = (n = LINHAS_INICIAIS): ItemForm[] => Array.from({ length: n }, () => ({ ...ITEM_VAZIO }))

const INPUT_CLS = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400'

// ── Colunas da tabela ─────────────────────────────────────────────────────────

type ColKey = 'data' | 'material' | 'quantidade' | 'loja' | 'valorUnitario' | 'valor'
// 'lancado' = ordem padrão (último lançamento primeiro), sem coluna própria
type OrdemKey = ColKey | 'lancado'

const COLUNAS: {
  key: ColKey
  label: string
  num?: boolean
  cls: string            // largura/alinhamento da coluna
  sort: (c: Compra) => number | string
  texto: (c: Compra) => string
}[] = [
  { key: 'data',          label: 'Data',        cls: 'w-28',                          sort: c => c.data.toMillis(),  texto: c => fmtData(c.data) },
  { key: 'material',      label: 'Material',    cls: 'min-w-[240px]',                 sort: c => norm(c.material),   texto: c => c.material },
  { key: 'quantidade',    label: 'Qtd',         cls: 'w-16', num: true,               sort: c => c.quantidade,       texto: c => c.quantidade.toLocaleString('pt-BR') },
  { key: 'loja',          label: 'Loja',        cls: 'min-w-[140px]',                 sort: c => norm(c.loja),       texto: c => c.loja },
  { key: 'valorUnitario', label: 'Valor unit.', cls: 'w-28', num: true,               sort: c => c.valorUnitario,    texto: c => fmtMoeda(c.valorUnitario) },
  { key: 'valor',         label: 'Total',       cls: 'w-28', num: true,               sort: c => c.valor,            texto: c => fmtMoeda(c.valor) },
]

const SORT_LANCADO = (c: Compra) => c.criadoEm.toMillis()

// ── Página ────────────────────────────────────────────────────────────────────

export default function ComprasPage() {
  const { usuario } = useAuth()
  const hoje = new Date()
  const [mesVis, setMesVis] = useState(hoje.getMonth() + 1)
  const [anoVis, setAnoVis] = useState(hoje.getFullYear())
  const { compras, loading, lancar, salvarLote, excluir } = useCompras(mesVis, anoVis)
  const lojas = useLojasCompras()
  const materiais = useMateriaisCompras()

  const [filtros, setFiltros] = useState<Partial<Record<ColKey, string>>>({})
  const [ordem, setOrdem] = useState<{ col: OrdemKey; dir: 'asc' | 'desc' }>({ col: 'lancado', dir: 'desc' })
  const [editandoGrupo, setEditandoGrupo] = useState<string | null>(null)

  const autor: Autor | null = usuario ? { uid: usuario.uid, nome: usuario.nome } : null

  function navMes(delta: number) {
    const d = new Date(anoVis, mesVis - 1 + delta, 1)
    setMesVis(d.getMonth() + 1)
    setAnoVis(d.getFullYear())
  }

  function toggleOrdem(col: ColKey) {
    setOrdem(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: col === 'data' ? 'desc' : 'asc' })
  }

  const visiveis = useMemo(() => {
    const ativos = COLUNAS.filter(c => filtros[c.key]?.trim())
    const filtradas = compras.filter(c =>
      ativos.every(col => norm(col.texto(c)).includes(norm(filtros[col.key]!.trim()))),
    )
    const sortFn = ordem.col === 'lancado' ? SORT_LANCADO : COLUNAS.find(c => c.key === ordem.col)!.sort
    const sinal = ordem.dir === 'asc' ? 1 : -1
    return [...filtradas].sort((a, b) => {
      const va = sortFn(a), vb = sortFn(b)
      const cmp = typeof va === 'number' ? va - (vb as number) : va.localeCompare(vb as string, 'pt-BR')
      if (cmp !== 0) return cmp * sinal
      // Mesmo lançamento: mantém a ordem em que os itens foram digitados
      return grupoDe(a) === grupoDe(b) ? (a.ordem ?? 0) - (b.ordem ?? 0) : 0
    })
  }, [compras, filtros, ordem])

  const totais = useMemo(() => ({
    valor: visiveis.reduce((s, c) => s + (c.valor ?? 0), 0),
    itens: visiveis.length,
    lojas: new Set(visiveis.map(c => norm(c.loja.trim())).filter(Boolean)).size,
  }), [visiveis])

  const itensEdicao = useMemo(
    () => editandoGrupo
      ? compras.filter(c => grupoDe(c) === editandoGrupo).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      : null,
    [compras, editandoGrupo],
  )

  async function handleExcluir(c: Compra) {
    if (!confirm(`Excluir "${c.material}" (${formatBRL(c.valor)})?`)) return
    await excluir(c.id)
  }

  const temFiltro = Object.values(filtros).some(v => v?.trim())

  return (
    <div className="max-w-[1400px] mx-auto p-4 lg:p-8">
      {/* Cabeçalho */}
      <div className="mb-5 lg:mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Compras</h1>
        <p className="text-sm text-gray-500 mt-0.5">Lançamento de materiais comprados</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[440px_1fr] gap-6 items-start">
        {/* Lançamento — sempre aberto. key remonta o form ao trocar de lançamento */}
        {autor && (
          <FormCompra
            key={editandoGrupo ?? 'novo'}
            lojas={lojas}
            materiais={materiais}
            edicao={itensEdicao}
            onLancar={itens => lancar(itens, autor)}
            onSalvarEdicao={itens => salvarLote(itensEdicao ?? [], itens, autor)}
            onFimEdicao={() => setEditandoGrupo(null)}
          />
        )}

        <div className="min-w-0">
          {/* Navegação de mês */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button onClick={() => navMes(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg leading-none">‹</button>
            <div className="flex gap-1 flex-wrap">
              {MESES_NOMES.map((nome, i) => (
                <button
                  key={nome}
                  onClick={() => setMesVis(i + 1)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    i + 1 === mesVis ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {nome}
                </button>
              ))}
            </div>
            <button onClick={() => navMes(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg leading-none">›</button>
            <span className="text-sm font-semibold text-gray-700 ml-1">{MESES_NOMES[mesVis - 1]} {anoVis}</span>
          </div>

          {/* KPIs (consideram os filtros) */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card !p-3">
              <p className="text-xs text-gray-500">Total comprado</p>
              <p className="text-base lg:text-lg font-semibold text-gray-900">{formatBRL(totais.valor)}</p>
            </div>
            <div className="card !p-3">
              <p className="text-xs text-gray-500">Itens</p>
              <p className="text-base lg:text-lg font-semibold text-gray-900">{totais.itens}</p>
            </div>
            <div className="card !p-3">
              <p className="text-xs text-gray-500">Lojas</p>
              <p className="text-base lg:text-lg font-semibold text-gray-900">{totais.lojas}</p>
            </div>
          </div>

          {/* Tabela */}
          <div className="card !p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs text-gray-500">
                  {COLUNAS.map(col => (
                    <th key={col.key} className={`px-3 pt-2.5 pb-1 font-medium whitespace-nowrap ${col.cls} ${col.num ? 'text-right' : ''}`}>
                      <button onClick={() => toggleOrdem(col.key)} className="hover:text-gray-800">
                        {col.label}
                        <span className="ml-1 text-gray-400">
                          {ordem.col === col.key ? (ordem.dir === 'asc' ? '↑' : '↓') : ''}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th className="px-3 pt-2.5 pb-1 text-right w-28">
                    {(temFiltro || ordem.col !== 'lancado') && (
                      <button
                        onClick={() => { setFiltros({}); setOrdem({ col: 'lancado', dir: 'desc' }) }}
                        className="text-xs font-normal text-emerald-700 hover:underline whitespace-nowrap"
                      >
                        Limpar
                      </button>
                    )}
                  </th>
                </tr>
                <tr>
                  {COLUNAS.map(col => (
                    <th key={col.key} className="px-2 pb-2">
                      <input
                        type="text"
                        value={filtros[col.key] ?? ''}
                        onChange={e => setFiltros(f => ({ ...f, [col.key]: e.target.value }))}
                        placeholder="Filtrar"
                        className={`w-full px-2 py-1 text-xs font-normal border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-emerald-400 bg-white ${col.num ? 'text-right' : ''}`}
                      />
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr><td colSpan={COLUNAS.length + 1} className="px-3 py-8 text-center text-gray-400">Carregando...</td></tr>
                )}
                {!loading && visiveis.length === 0 && (
                  <tr><td colSpan={COLUNAS.length + 1} className="px-3 py-8 text-center text-gray-400">
                    {temFiltro ? 'Nenhuma compra com esses filtros.' : 'Nenhuma compra neste mês.'}
                  </td></tr>
                )}
                {!loading && visiveis.map(c => {
                  const emEdicao = editandoGrupo === grupoDe(c)
                  return (
                    <tr key={c.id} className={emEdicao ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-2 tabular-nums text-gray-500 whitespace-nowrap" title={`Lançado por ${c.criadoPorNome} em ${fmtDataHora(c.criadoEm)}`}>{fmtData(c.data)}</td>
                      <td className="px-3 py-2 text-gray-800">{c.material}</td>
                      <td className="px-3 py-2 tabular-nums text-right text-gray-600">{c.quantidade.toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.loja}</td>
                      <td className="px-3 py-2 tabular-nums text-right text-gray-600 whitespace-nowrap">{formatBRL(c.valorUnitario)}</td>
                      <td className="px-3 py-2 tabular-nums text-right font-medium text-gray-900 whitespace-nowrap">{formatBRL(c.valor)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => setEditandoGrupo(grupoDe(c))} className="text-xs text-emerald-700 hover:underline mr-3">Editar</button>
                        <button onClick={() => handleExcluir(c)} className="text-xs text-red-500 hover:underline">Excluir</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Autocomplete (loja e material) ────────────────────────────────────────────
// Busca por todas as palavras digitadas em qualquer posição ("fadvan 10" acha "YY FADVAN PRETO 10MM")

function Autocomplete({ value, onChange, opcoes, placeholder, className, inputRef }: {
  value: string
  onChange: (v: string) => void
  opcoes: string[]
  placeholder?: string
  className: string
  inputRef?: React.Ref<HTMLInputElement>
}) {
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const q = norm(value.trim())
  const termos = q.split(/\s+/).filter(Boolean)

  const sugestoes = q
    ? opcoes
        .filter(o => { const n = norm(o); return n !== q && termos.every(t => n.includes(t)) })
        .sort((a, b) => Number(norm(b).startsWith(q)) - Number(norm(a).startsWith(q)))
        .slice(0, 8)
    : []

  function escolher(o: string) {
    onChange(o)
    setAberto(false)
  }

  return (
    <div className="relative min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setAberto(true); setAtivo(0) }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={e => {
          if (!aberto || sugestoes.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(a => Math.min(a + 1, sugestoes.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(a => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); escolher(sugestoes[ativo]) }
          else if (e.key === 'Escape') setAberto(false)
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-20 mt-1 min-w-full w-max max-w-[22rem] bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto text-sm">
          {sugestoes.map((o, i) => (
            <li
              key={o}
              // mouseDown + preventDefault: escolhe antes do blur fechar a lista
              onMouseDown={e => { e.preventDefault(); escolher(o) }}
              className={`px-3 py-1.5 cursor-pointer ${i === ativo ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Formulário: lançar / editar lançamento inteiro ────────────────────────────

type ItemSalvar = CompraInput & { id?: string }

function FormCompra({ lojas, materiais, edicao, onLancar, onSalvarEdicao, onFimEdicao }: {
  lojas: string[]
  materiais: string[]
  edicao: Compra[] | null
  onLancar: (itens: CompraInput[]) => Promise<void>
  onSalvarEdicao: (itens: ItemSalvar[]) => Promise<void>
  onFimEdicao: () => void
}) {
  const base = edicao?.[0]
  const [data, setData] = useState(() => toInputDate(base?.data ?? Timestamp.now()))
  const [loja, setLoja] = useState(base?.loja ?? '')
  const [pedido, setPedido] = useState(base?.pedido ?? '')
  const [itens, setItens] = useState<ItemForm[]>(() => edicao
    ? edicao.map(c => ({ id: c.id, material: c.material, quantidade: numStr(c.quantidade), valorUnitario: fmtMoeda(c.valorUnitario) }))
    : novasLinhas())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const primeiroMaterial = useRef<HTMLInputElement>(null)

  function setItem(i: number, patch: Partial<ItemForm>) {
    setItens(prev => prev.map((it, j) => j === i ? { ...it, ...patch } : it))
  }

  const preenchidos = itens.filter(it => it.material.trim())
  const total = preenchidos.reduce((s, it) => s + parseNum(it.quantidade) * parseNum(it.valorUnitario), 0)

  async function salvar() {
    setErro('')
    setOk('')
    if (!data || !loja.trim()) { setErro('Informe a data e a loja.'); return }
    if (preenchidos.length === 0) { setErro('Preencha pelo menos um material.'); return }
    if (preenchidos.some(it => parseNum(it.quantidade) <= 0)) { setErro('Quantidade deve ser maior que zero.'); return }
    const payload: ItemSalvar[] = preenchidos.map(it => {
      const quantidade = parseNum(it.quantidade)
      const valorUnitario = parseNum(it.valorUnitario)
      return {
        id: it.id,
        data: fromInputDate(data),
        material: it.material.trim().toUpperCase(),
        quantidade,
        valorUnitario,
        valor: Math.round(quantidade * valorUnitario * 100) / 100,
        loja: loja.trim().toUpperCase(),
        pedido: pedido.trim() || undefined,
      }
    })
    setSalvando(true)
    try {
      if (edicao) {
        await onSalvarEdicao(payload)
        onFimEdicao()
        return
      }
      await onLancar(payload)
      setOk(`${preenchidos.length} ${preenchidos.length === 1 ? 'item lançado' : 'itens lançados'} · ${formatBRL(total)}`)
      // Mantém a data para o próximo lançamento
      setLoja('')
      setPedido('')
      setItens(novasLinhas())
      primeiroMaterial.current?.focus()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function excluirLancamento() {
    if (!edicao || !confirm(`Excluir o lançamento inteiro (${edicao.length} itens)?`)) return
    setSalvando(true)
    try {
      await onSalvarEdicao([])
      onFimEdicao()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir')
      setSalvando(false)
    }
  }

  const linhaCls = 'w-full min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400'

  return (
    <div className={`card !p-4 lg:!p-5 xl:sticky xl:top-4 ${edicao ? 'ring-2 ring-amber-300' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">
          {edicao ? 'Editando lançamento' : 'Lançar compra'}
        </h2>
        {edicao && (
          <button onClick={onFimEdicao} className="text-xs text-gray-500 hover:underline">Cancelar edição</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data da compra</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)} className={INPUT_CLS} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nº do pedido</label>
          <input type="text" value={pedido} onChange={e => setPedido(e.target.value)} placeholder="opcional" className={INPUT_CLS} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Loja</label>
          <Autocomplete value={loja} onChange={v => setLoja(v.toUpperCase())} opcoes={lojas} placeholder="Comece a digitar..." className={INPUT_CLS} />
        </div>
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-[1fr_52px_88px_18px] gap-1.5 text-xs text-gray-500 mb-1">
          <span>Material</span><span>Qtd</span><span>Valor unit.</span><span />
        </div>
        <div className="space-y-1.5">
          {itens.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_52px_88px_18px] gap-1.5 items-center">
              <Autocomplete
                inputRef={i === 0 ? primeiroMaterial : undefined}
                value={it.material}
                onChange={v => setItem(i, { material: v.toUpperCase() })}
                opcoes={materiais}
                placeholder={`Material ${i + 1}`}
                className={linhaCls}
              />
              <input
                type="text" inputMode="decimal"
                value={it.quantidade}
                onChange={e => setItem(i, { quantidade: e.target.value })}
                className={`${linhaCls} tabular-nums text-right`}
              />
              <input
                type="text" inputMode="numeric"
                value={it.valorUnitario}
                onChange={e => setItem(i, { valorUnitario: mascaraMoeda(e.target.value) })}
                placeholder="0,00"
                className={`${linhaCls} tabular-nums text-right`}
              />
              <button
                onClick={() => setItens(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ ...ITEM_VAZIO }])}
                className="text-gray-300 hover:text-red-500 text-lg leading-none"
                title="Remover linha"
                tabIndex={-1}
              >×</button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setItens(prev => [...prev, { ...ITEM_VAZIO }])}
          className="mt-2 text-xs text-emerald-700 hover:underline"
        >
          + Adicionar linha
        </button>
      </div>

      <div className="mt-4 pt-3 border-t flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {preenchidos.length} {preenchidos.length === 1 ? 'item' : 'itens'} · <span className="font-semibold text-gray-900">{formatBRL(total)}</span>
        </p>
        <button onClick={salvar} disabled={salvando} className="btn-primary text-sm px-5 py-2">
          {salvando ? 'Salvando...' : edicao ? 'Salvar alterações' : 'Lançar'}
        </button>
      </div>
      {edicao && (
        <div className="mt-2 flex justify-between text-xs text-gray-400">
          <span>Lançado por {base?.criadoPorNome} em {base && fmtDataHora(base.criadoEm)}</span>
          <button onClick={excluirLancamento} disabled={salvando} className="text-red-500 hover:underline">Excluir lançamento</button>
        </div>
      )}
      {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
      {ok && !erro && <p className="text-xs text-emerald-700 mt-2">✓ {ok}</p>}
    </div>
  )
}
