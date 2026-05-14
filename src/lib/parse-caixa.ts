import * as XLSX from 'xlsx'
import type { FormaPagamento } from '@/types'

export interface ResultadoParseCaixa {
  formas: FormaPagamento[]
  total: number
}

const NORMALIZACAO: Record<string, string> = {
  'cartão de crédito': 'Cartão Crédito',
  'cartao de credito': 'Cartão Crédito',
  'cartão crédito': 'Cartão Crédito',
  'cartao credito': 'Cartão Crédito',
  'crédito': 'Cartão Crédito',
  'credito': 'Cartão Crédito',
  'cartão de débito': 'Cartão Débito',
  'cartao de debito': 'Cartão Débito',
  'cartão débito': 'Cartão Débito',
  'cartao debito': 'Cartão Débito',
  'débito': 'Cartão Débito',
  'debito': 'Cartão Débito',
  'pix': 'Pix',
  'dinheiro': 'Dinheiro',
  'espécie': 'Dinheiro',
  'especie': 'Dinheiro',
}

function normalizarNome(nome: string): string {
  const key = nome.toLowerCase().trim()
  return NORMALIZACAO[key] ?? nome.trim()
}

function parseMoeda(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0
  const str = String(valor).replace(/[^\d,.-]/g, '').replace(',', '.')
  return parseFloat(str) || 0
}

export async function parseCaixa(file: File): Promise<ResultadoParseCaixa> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  const formasMap = new Map<string, number>()

  for (const row of rows) {
    const nomeRaw = String(row['Forma de pagamento'] ?? row['Forma de Pagamento'] ?? row['forma_pagamento'] ?? '').trim()
    const valor = parseMoeda(row['Faturamento'] ?? row['Valor'] ?? row['faturamento'])

    if (!nomeRaw || valor === 0) continue

    const nome = normalizarNome(nomeRaw)
    formasMap.set(nome, (formasMap.get(nome) ?? 0) + valor)
  }

  const total = Array.from(formasMap.values()).reduce((s, v) => s + v, 0)

  // Ordem preferencial de exibição
  const ORDEM = ['Cartão Crédito', 'Cartão Débito', 'Pix', 'Dinheiro']
  const formas: FormaPagamento[] = []

  for (const nome of ORDEM) {
    if (formasMap.has(nome)) {
      const valor = formasMap.get(nome)!
      formas.push({ nome, valor, percentual: total > 0 ? (valor / total) * 100 : 0 })
      formasMap.delete(nome)
    }
  }

  // Formas restantes (nomes não previstos)
  for (const [nome, valor] of formasMap.entries()) {
    formas.push({ nome, valor, percentual: total > 0 ? (valor / total) * 100 : 0 })
  }

  return { formas, total }
}
