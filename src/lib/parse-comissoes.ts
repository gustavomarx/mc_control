import * as XLSX from 'xlsx'
import type { ComissaoProfissional } from '@/types'

export interface ResultadoParseComissoes {
  profissionais: ComissaoProfissional[]
  totalFaturado: number
  totalAPagar: number
  valorCasa: number
  periodoKey: string | null   // null = não foi possível extrair do nome do arquivo
  periodoInicio: string | null
  periodoFim: string | null
}

function formatarDataISO(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

function extrairPeriodoDoNome(nome: string): { periodoKey: string; periodoInicio: string; periodoFim: string } | null {
  const match = nome.match(/(\d{8})-(\d{8})-0123/)
  if (!match) return null
  const inicio = formatarDataISO(match[1])
  const fim = formatarDataISO(match[2])
  return { periodoKey: `${inicio}_${fim}`, periodoInicio: inicio, periodoFim: fim }
}

function parseMoeda(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0
  const str = String(valor).replace(/[^\d,.-]/g, '').replace(',', '.')
  return parseFloat(str) || 0
}

export async function parseComissoes(file: File): Promise<ResultadoParseComissoes> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  const periodo = extrairPeriodoDoNome(file.name)

  const profissionaisMap: ComissaoProfissional[] = []
  let totalFaturado = 0
  let totalAPagar = 0
  let totalCasa = 0

  for (const row of rows) {
    const nome = String(row['Profissional'] ?? '').trim()
    if (!nome) continue

    const faturado = parseMoeda(row['Faturado'])
    const rateioServicos = parseMoeda(row['Rateio Serviços'] ?? row['Rateio Servicos'])
    const rateioOutros = parseMoeda(row['Rateio Outros'])
    const descontos = parseMoeda(row['Descontos'])
    const aPagar = parseMoeda(row['A pagar'] ?? row['A Pagar'])
    const valorCasa = parseMoeda(row['Valor Casa'])
    const tipoContratacao = String(row['Tipo Contratação'] ?? row['Tipo Contratacao'] ?? '').trim()

    profissionaisMap.push({
      nome,
      tipoContratacao,
      faturado,
      rateioServicos,
      rateioOutros,
      descontos,
      aPagar,
      valorCasa,
      percentualTotal: 0, // calculado após somar total
    })

    totalFaturado += faturado
    totalAPagar += aPagar
    totalCasa += valorCasa
  }

  // Calcular percentual de cada profissional
  const profissionais = profissionaisMap.map(p => ({
    ...p,
    percentualTotal: totalFaturado > 0 ? (p.faturado / totalFaturado) * 100 : 0,
  }))

  // Ordenar por faturado desc
  profissionais.sort((a, b) => b.faturado - a.faturado)

  return {
    profissionais,
    totalFaturado,
    totalAPagar,
    valorCasa: totalCasa,
    periodoKey: periodo?.periodoKey ?? null,
    periodoInicio: periodo?.periodoInicio ?? null,
    periodoFim: periodo?.periodoFim ?? null,
  }
}
