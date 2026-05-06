'use client'

import { useEffect, useState } from 'react'
import type { ContaPagar, TipoContaPagar } from '@/types'
import { CATEGORIAS_LISTA, mesAtual } from '@/lib/utils'

interface Props {
  conta?: ContaPagar | null
  onSalvar: (data: Omit<ContaPagar, 'id' | 'criadoEm' | 'historicoPagamentos'>) => Promise<void>
  onFechar: () => void
}

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const { mes: mesHoje, ano: anoHoje } = mesAtual()

// Anos disponíveis: 2 anos atrás até o atual
const ANOS_INICIO = Array.from({ length: 3 }, (_, i) => anoHoje - 2 + i)

const VAZIO = {
  nome: '',
  fornecedor: '',
  valor: '' as unknown as number,
  percentual: '' as unknown as number,
  baseCalculo: null as 'faturamento' | null,
  diaVencimento: '' as unknown as number,
  recorrencia: 'mensal' as ContaPagar['recorrencia'],
  mesAnual: 1 as number,
  mesInicio: mesHoje,
  anoInicio: anoHoje,
  tipo: 'fixo' as TipoContaPagar,
  categoria: '',
  ativa: true,
}

export default function ModalConta({ conta, onSalvar, onFechar }: Props) {
  const [form, setForm] = useState({ ...VAZIO })
  const [tipoValor, setTipoValor] = useState<'fixo' | 'percentual'>('fixo')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (conta) {
      setForm({
        nome: conta.nome,
        fornecedor: conta.fornecedor,
        valor: conta.valor ?? ('' as unknown as number),
        percentual: conta.percentual ?? ('' as unknown as number),
        baseCalculo: conta.baseCalculo,
        diaVencimento: conta.diaVencimento,
        recorrencia: conta.recorrencia,
        mesAnual: conta.mesAnual ?? 1,
        mesInicio: conta.mesInicio ?? mesHoje,
        anoInicio: conta.anoInicio ?? anoHoje,
        tipo: conta.tipo ?? 'fixo',
        categoria: conta.categoria,
        ativa: conta.ativa,
      })
      setTipoValor(conta.percentual ? 'percentual' : 'fixo')
    }
  }, [conta])

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.nome || !form.categoria) { setErro('Preencha nome e categoria.'); return }
    if (tipoValor === 'fixo' && !form.valor) { setErro('Informe o valor.'); return }
    if (tipoValor === 'percentual' && !form.percentual) { setErro('Informe o percentual.'); return }
    if (form.recorrencia === 'anual' && !form.mesAnual) { setErro('Informe o mês de pagamento.'); return }

    setSalvando(true)
    try {
      const payload: Omit<ContaPagar, 'id' | 'criadoEm' | 'historicoPagamentos'> = {
        ...form,
        valor: tipoValor === 'fixo' ? Number(form.valor) : null,
        percentual: tipoValor === 'percentual' ? Number(form.percentual) : null,
        baseCalculo: tipoValor === 'percentual' ? 'faturamento' : null,
        diaVencimento: Number(form.diaVencimento) || 0,
      }
      if (form.recorrencia === 'anual') {
        payload.mesAnual = Number(form.mesAnual)
      } else {
        delete payload.mesAnual
      }
      await onSalvar(payload)
      onFechar()
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{conta ? 'Editar conta' : 'Nova conta'}</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nome</label>
              <input className="input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Aluguel estúdio" />
            </div>
            <div className="col-span-2">
              <label className="label">Fornecedor</label>
              <input className="input" value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)} placeholder="Ex: Ibagy Imóveis" />
            </div>
          </div>

          {/* Tipo da conta: Fixo / Variável */}
          <div>
            <label className="label">Natureza</label>
            <div className="flex gap-4 mt-1">
              {(['fixo', 'variavel'] as TipoContaPagar[]).map(t => (
                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={form.tipo === t} onChange={() => set('tipo', t)} />
                  {t === 'fixo' ? 'Fixo' : 'Variável'}
                </label>
              ))}
            </div>
          </div>

          {/* Tipo de valor: R$ / % */}
          <div>
            <label className="label">Tipo de valor</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={tipoValor === 'fixo'} onChange={() => setTipoValor('fixo')} />
                Valor fixo (R$)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={tipoValor === 'percentual'} onChange={() => setTipoValor('percentual')} />
                Percentual do faturamento (%)
              </label>
            </div>
          </div>

          {tipoValor === 'fixo' ? (
            <div>
              <label className="label">Valor (R$)</label>
              <input className="input" type="number" step="0.01" min="0" value={form.valor}
                onChange={e => set('valor', e.target.value as unknown as number)} placeholder="0,00" />
            </div>
          ) : (
            <div>
              <label className="label">Percentual (%)</label>
              <input className="input" type="number" step="0.1" min="0" max="100" value={form.percentual}
                onChange={e => set('percentual', e.target.value as unknown as number)} placeholder="Ex: 7.5" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Dia do vencimento</label>
              <input className="input" type="number" min="0" max="31" value={form.diaVencimento}
                onChange={e => set('diaVencimento', e.target.value as unknown as number)} placeholder="0 = variável" />
            </div>
            <div>
              <label className="label">Recorrência</label>
              <select className="input" value={form.recorrencia}
                onChange={e => set('recorrencia', e.target.value as ContaPagar['recorrencia'])}>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
                <option value="semanal">Semanal</option>
                <option value="unica">Única</option>
              </select>
            </div>
          </div>

          {form.recorrencia === 'anual' && (
            <div>
              <label className="label">Mês de pagamento</label>
              <select className="input" value={form.mesAnual}
                onChange={e => set('mesAnual', Number(e.target.value))}>
                {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}

          {/* Competência a partir de */}
          <div>
            <label className="label">Cobrar a partir de</label>
            <div className="flex gap-2">
              <select className="input flex-1" value={form.mesInicio}
                onChange={e => set('mesInicio', Number(e.target.value))}>
                {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
              <select className="input w-24" value={form.anoInicio}
                onChange={e => set('anoInicio', Number(e.target.value))}>
                {ANOS_INICIO.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Meses anteriores ao atual aparecerão automaticamente como atrasados.
            </p>
          </div>

          <div>
            <label className="label">Categoria</label>
            <select className="input" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              <option value="">Selecione...</option>
              {CATEGORIAS_LISTA.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar} className="flex-1 btn-secondary">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 btn-primary">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
