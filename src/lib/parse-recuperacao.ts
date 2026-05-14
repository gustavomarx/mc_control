import * as XLSX from 'xlsx'
import { normalizarCelular } from './crm-messages'
import type { RecuperacaoStatus } from '@/types'

export interface ResultadoParseRecuperacao {
  clientes: Omit<RecuperacaoStatus, 'status' | 'atualizadoEm'>[]
  total: number
}

function parseDataBR(str: string): Date | null {
  if (!str) return null
  const partes = str.includes('/') ? str.split('/') : str.split('-').reverse()
  if (partes.length < 3) return null
  const [dia, mes, ano] = partes.map(Number)
  if (!dia || !mes || !ano) return null
  return new Date(ano, mes - 1, dia)
}

export async function parseRecuperacao(file: File): Promise<ResultadoParseRecuperacao> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const clientes: Omit<RecuperacaoStatus, 'status' | 'atualizadoEm'>[] = []

  for (const row of rows) {
    const nome = String(row['Cliente'] ?? '').trim()
    const celularRaw = String(row['Celular'] ?? row['Telefone'] ?? '').trim()
    const celular = normalizarCelular(celularRaw)
    const ultimaVisitaStr = String(row['Última Visita'] ?? row['Ultima Visita'] ?? '').trim()

    if (!nome || !celular) continue

    const ultimaVisitaDate = parseDataBR(ultimaVisitaStr)
    const diasSemRetorno = ultimaVisitaDate
      ? Math.floor((hoje.getTime() - ultimaVisitaDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    clientes.push({
      id: celular,
      nome,
      ultimaVisita: ultimaVisitaStr,
      diasSemRetorno,
      celular,
      ...(row['E-mail'] ? { email: String(row['E-mail']).trim() } : {}),
    })
  }

  // Ordenar por mais dias sem retorno
  clientes.sort((a, b) => b.diasSemRetorno - a.diasSemRetorno)

  return { clientes, total: clientes.length }
}
