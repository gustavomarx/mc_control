import * as XLSX from 'xlsx'
import { normalizarCelular } from './crm-messages'
import type { AniversarianteStatus } from '@/types'

export interface ResultadoParseAniversariantes {
  clientes: Omit<AniversarianteStatus, 'status' | 'atualizadoEm'>[]
  total: number
}

export async function parseAniversariantes(file: File): Promise<ResultadoParseAniversariantes> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

  const clientes: Omit<AniversarianteStatus, 'status' | 'atualizadoEm'>[] = []

  for (const row of rows) {
    const nome = String(row['Nome'] ?? '').trim()
    const celularRaw = String(row['Celular'] ?? row['Telefone'] ?? '').trim()
    const celular = normalizarCelular(celularRaw)
    const dataNascimento = String(row['Data de Nascimento'] ?? row['Data Nascimento'] ?? '').trim()

    if (!nome || !celular) continue

    clientes.push({
      id: celular,
      nome,
      dataNascimento,
      celular,
      ...(row['E-mail'] ? { email: String(row['E-mail']).trim() } : {}),
    })
  }

  return { clientes, total: clientes.length }
}
