'use client'

import { useState } from 'react'
import type { ContaPagar } from '@/types'
import { formatBRL, mesAtual } from '@/lib/utils'

const MESES_NOMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

interface Props {
  conta: ContaPagar
  defaultMes?: number
  defaultAno?: number
  faturamentoMes?: number
  valorRestante?: number
  onConfirmar: (valorPago: number, mesRef: number, anoRef: number) => Promise<void>
  onFechar: () => void
}

export default function ModalPagamento({ conta, defaultMes, defaultAno, faturamentoMes, valorRestante, onConfirmar, onFechar }: Props) {
  const { mes: mesHoje, ano: anoHoje } = mesAtual()
  const [mesRef, setMesRef] = useState(defaultMes ?? mesHoje)
  const [anoRef, setAnoRef] = useState(defaultAno ?? anoHoje)

  const valorSugerido = valorRestante !== undefined
    ? valorRestante
    : conta.valor
      ? conta.valor
      : conta.percentual && faturamentoMes
        ? (conta.percentual / 100) * faturamentoMes
        : 0

  const [valorPago, setValorPago] = useState(valorSugerido.toFixed(2))
  const [confirmando, setConfirmando] = useState(false)

  // Anos disponíveis: 2 anos atrás até ano atual
  const anos = Array.from({ length: 3 }, (_, i) => anoHoje - 2 + i)

  async function handleConfirmar() {
    setConfirmando(true)
    try {
      await onConfirmar(Number(valorPago), mesRef, anoRef)
      onFechar()
    } finally {
      setConfirmando(false)
    }
  }

  const isRetroativo = mesRef !== mesHoje || anoRef !== anoHoje

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Registrar pagamento</h2>
          <p className="text-sm text-gray-500 mt-0.5">{conta.nome}</p>
        </div>
        <div className="px-6 py-5 space-y-4">

          {/* Mês de referência */}
          <div>
            <label className="label">Mês de referência</label>
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={mesRef}
                onChange={e => setMesRef(Number(e.target.value))}
              >
                {MESES_NOMES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                className="input w-24"
                value={anoRef}
                onChange={e => setAnoRef(Number(e.target.value))}
              >
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {isRetroativo && (
              <p className="text-xs text-amber-600 mt-1">Pagamento retroativo</p>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="label">Valor pago (R$)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={valorPago}
              onChange={e => setValorPago(e.target.value)}
            />
            {valorRestante !== undefined && conta.valor && (
              <p className="text-xs text-amber-600 mt-1">
                Pagamento parcial — já pago: {formatBRL(conta.valor - valorRestante)} · restante: {formatBRL(valorRestante)}
              </p>
            )}
            {valorRestante === undefined && valorSugerido > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Sugerido: {formatBRL(valorSugerido)}
                {conta.percentual ? ` (${conta.percentual}% do faturamento)` : ''}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onFechar} className="flex-1 btn-secondary">Cancelar</button>
            <button onClick={handleConfirmar} disabled={confirmando || !valorPago} className="flex-1 btn-primary">
              {confirmando ? 'Registrando...' : 'Confirmar pago'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
