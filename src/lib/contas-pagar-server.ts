// Acesso server-side (Admin SDK) às contas a pagar — usado pelo cron e pelo bot do Discord.

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import {
  type ContaBasica, type ItemVencimento, atrasadas, vencimentosEntre, somarDias, totalPagoNoMes,
  vencimentoNoMes, contaQuitada,
} from '@/lib/contas-vencimentos'

export async function carregarContasAtivas(): Promise<ContaBasica[]> {
  const snap = await adminDb.collection('contas_pagar').where('ativa', '==', true).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ContaBasica))
}

// Em aberto: vencidas (até 12 meses) + as que vencem nos próximos `diasFrente` dias
export function emAberto(contas: ContaBasica[], hoje: Date, diasFrente = 35): ItemVencimento[] {
  return [...atrasadas(contas, hoje), ...vencimentosEntre(contas, hoje, somarDias(hoje, diasFrente))]
}

export interface ResultadoPagamento {
  ok: boolean
  motivo?: string
  conta?: ContaBasica
  valorPago?: number
  previsto?: number | null
  totalPagoMes?: number
  duplicado?: boolean
}

// Registra um pagamento em historicoPagamentos (mesmo formato da tela de Contas).
// valor null = integral (o que falta da conta naquele mês).
// Evita duplicar: mesmo usuário + mesmo mês + mesmo valor nos últimos 2 minutos.
export async function registrarPagamento(params: {
  contaId: string
  ano: number
  mes: number
  valor: number | null
  usuarioId: string
  usuarioNome: string
}): Promise<ResultadoPagamento> {
  const ref = adminDb.collection('contas_pagar').doc(params.contaId)
  return adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref)
    if (!snap.exists) return { ok: false, motivo: 'Conta não encontrada.' }
    const conta = { id: snap.id, ...snap.data() } as ContaBasica
    if (!conta.ativa) return { ok: false, motivo: 'Conta inativa.' }
    if (!vencimentoNoMes(conta, params.ano, params.mes)) {
      return { ok: false, motivo: 'Essa conta não vence nesse mês.' }
    }

    const jaPago = totalPagoNoMes(conta, params.ano, params.mes)
    const previsto = conta.valor ?? null
    const restante = previsto == null || contaQuitada(conta, jaPago)
      ? null
      : Math.round((previsto - jaPago) * 100) / 100
    const valor = params.valor ?? restante
    if (valor == null || valor <= 0) {
      return {
        ok: false, conta,
        motivo: previsto == null && jaPago === 0
          ? 'Essa conta não tem valor fixo. Informe o valor pago.'
          : 'Essa conta já está paga nesse mês. Para registrar outro valor, informe o valor.',
      }
    }

    const doisMin = Date.now() - 120_000
    const duplicado = (conta.historicoPagamentos ?? []).some(h =>
      h.usuarioId === params.usuarioId && h.mesRef === params.mes && h.anoRef === params.ano &&
      Math.abs(h.valorPago - valor) < 0.005 && (h.pagoEm?.toMillis?.() ?? 0) > doisMin)
    if (duplicado) {
      return { ok: true, duplicado: true, conta, valorPago: valor, previsto, totalPagoMes: jaPago }
    }

    const agora = Timestamp.now()
    tx.update(ref, {
      historicoPagamentos: FieldValue.arrayUnion({
        data: agora,
        valorPago: valor,
        pagoEm: agora,
        mesRef: params.mes,
        anoRef: params.ano,
        usuarioId: params.usuarioId,
        usuarioNome: params.usuarioNome,
        origem: 'discord',
      }),
    })
    return { ok: true, conta, valorPago: valor, previsto, totalPagoMes: jaPago + valor }
  })
}
