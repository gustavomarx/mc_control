import { Timestamp } from 'firebase/firestore'
import type { ContaPagar, HistoricoPagamento } from '@/types'

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(date: Date | Timestamp): string {
  const d = date instanceof Timestamp ? date.toDate() : date
  return d.toLocaleDateString('pt-BR')
}

export function mesAtual(): { mes: number; ano: number } {
  const now = new Date()
  return { mes: now.getMonth() + 1, ano: now.getFullYear() }
}

// Retorna o vencimento de uma conta no mês/ano dado
export function vencimentoNomes(dia: number, mes: number, ano: number): Date {
  return new Date(ano, mes - 1, dia || 1)
}

// Verifica se uma conta deve aparecer no mês/ano dado
export function contaAparece(conta: ContaPagar, mes: number, ano: number): boolean {
  if (conta.recorrencia === 'anual') {
    return conta.mesAnual === mes
  }
  return true // mensal, semanal, unica aparecem sempre
}

// Status de pagamento de uma conta num mês/ano específico
export function statusPagamento(conta: ContaPagar, mes?: number, ano?: number): 'pago' | 'atrasado' | 'pendente' {
  const { mes: mesC, ano: anoC } = mesAtual()
  const m = mes ?? mesC
  const a = ano ?? anoC

  const pago = (conta.historicoPagamentos ?? []).some(h => {
    // Registros novos têm mesRef/anoRef; legado usa data de pagoEm
    if (h.mesRef !== undefined && h.anoRef !== undefined) {
      return h.mesRef === m && h.anoRef === a
    }
    const d = h.pagoEm instanceof Timestamp ? h.pagoEm.toDate() : new Date(h.pagoEm as unknown as string)
    return d.getMonth() + 1 === m && d.getFullYear() === a
  })
  if (pago) return 'pago'

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const isMesAtual = m === mesC && a === anoC
  const isMesPassado = a < anoC || (a === anoC && m < mesC)

  if (isMesPassado) return 'atrasado'
  if (isMesAtual) {
    const venc = vencimentoNomes(conta.diaVencimento, m, a)
    return hoje > venc ? 'atrasado' : 'pendente'
  }
  return 'pendente'
}

// Gera todos os meses não pagos de todas as contas (acumulado)
export function gerarAtrasados(contas: ContaPagar[]): Array<{ conta: ContaPagar; mes: number; ano: number }> {
  const hoje = new Date()
  const mesHoje = hoje.getMonth() + 1
  const anoHoje = hoje.getFullYear()

  const result: Array<{ conta: ContaPagar; mes: number; ano: number }> = []

  for (const conta of contas) {
    if (!conta.ativa) continue

    // Usa mesInicio/anoInicio se definido, senão cai no criadoEm
    let mes: number
    let ano: number
    if (conta.mesInicio && conta.anoInicio) {
      mes = conta.mesInicio
      ano = conta.anoInicio
    } else {
      const criado = conta.criadoEm instanceof Timestamp ? conta.criadoEm.toDate() : new Date()
      mes = criado.getMonth() + 1
      ano = criado.getFullYear()
    }

    // Limite: no máximo 24 meses para trás
    const limite = new Date(hoje)
    limite.setMonth(limite.getMonth() - 24)
    if (new Date(ano, mes - 1) < limite) {
      mes = limite.getMonth() + 1
      ano = limite.getFullYear()
    }

    while (ano < anoHoje || (ano === anoHoje && mes <= mesHoje)) {
      if (contaAparece(conta, mes, ano) && statusPagamento(conta, mes, ano) === 'atrasado') {
        result.push({ conta, mes, ano })
      }
      mes++
      if (mes > 12) { mes = 1; ano++ }
    }
  }

  return result.sort((a, b) => {
    if (a.ano !== b.ano) return a.ano - b.ano
    if (a.mes !== b.mes) return a.mes - b.mes
    return a.conta.nome.localeCompare(b.conta.nome, 'pt-BR')
  })
}

// Último pagamento registrado
export function ultimoPagamento(conta: ContaPagar): HistoricoPagamento | null {
  const hist = conta.historicoPagamentos ?? []
  if (!hist.length) return null
  return hist[hist.length - 1]
}

// Projeção dos próximos N dias — retorna contas com data de vencimento
export function projecao30Dias(contas: ContaPagar[]): Array<{ conta: ContaPagar; vencimento: Date }> {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const fim = new Date(hoje)
  fim.setDate(fim.getDate() + 30)

  const result: Array<{ conta: ContaPagar; vencimento: Date }> = []
  for (const c of contas) {
    if (!c.ativa) continue
    // Verifica nos próximos 2 meses para cobrir virada de mês
    for (let delta = 0; delta <= 1; delta++) {
      const d = new Date(hoje)
      d.setMonth(d.getMonth() + delta)
      const venc = new Date(d.getFullYear(), d.getMonth(), c.diaVencimento || 1)
      if (venc >= hoje && venc <= fim) {
        result.push({ conta: c, vencimento: venc })
      }
    }
  }
  return result.sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())
}

export const CATEGORIAS_LISTA = [
  'Aluguel',
  'Marketing Local',
  'Serviço de Atendimento',
  'Contabilidade',
  'Sistemas',
  'Bancárias e Financeiras',
  'Royalties',
  'Comissões',
  'Impostos',
  'Energia, internet, telefone',
  'Material Operacional',
  'Outros',
]
