import * as XLSX from 'xlsx'
import type { RecuperacaoStatus } from '@/types'

// Mesma normalização do parse-agenda-cross para garantir match no cruzamento
function normTel(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length === 13) return digits.slice(2)
  if (digits.startsWith('55') && digits.length === 12) return digits.slice(2)
  return digits
}

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
    const celular = normTel(celularRaw)
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
