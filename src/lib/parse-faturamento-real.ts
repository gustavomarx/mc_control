import * as XLSX from 'xlsx'

export interface DiaFaturamentoReal {
  data: string    // YYYY-MM-DD
  faturado: number
  comandas: number
}

export interface ResultadoParseFaturamentoReal {
  id: string      // "YYYY-MM"
  mes: number
  ano: number
  dias: DiaFaturamentoReal[]
}

function parseMoeda(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0
  const str = String(valor).replace(/[^\d,.-]/g, '').replace(',', '.')
  return parseFloat(str) || 0
}

function parseData(valor: unknown): string | null {
  if (!valor) return null
  const str = String(valor).trim()
  if (str.includes('/')) {
    const partes = str.split('/')
    if (partes.length === 3) {
      const [d, m, a] = partes
      const ano = parseInt(a) < 100 ? 2000 + parseInt(a) : parseInt(a)
      return `${ano}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }
  return null
}

export async function parseFaturamentoReal(file: File): Promise<ResultadoParseFaturamentoReal> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  const dias: DiaFaturamentoReal[] = []

  for (const row of rows) {
    const dataRaw = row['Data'] ?? row['data'] ?? row['DATA']
    const data = parseData(dataRaw)
    if (!data) continue

    const faturado = parseMoeda(
      row['Faturado'] ?? row['faturado'] ?? row['FATURADO'] ?? row['Valor'] ?? row['valor']
    )
    const comandas = parseInt(
      String(row['Número de comandas'] ?? row['Comandas'] ?? row['comandas'] ?? '0')
    ) || 0

    if (faturado > 0) {
      dias.push({ data, faturado, comandas })
    }
  }

  if (dias.length === 0) {
    throw new Error('Nenhum dado encontrado. Verifique se o arquivo é o relatório 0088 do AVEC.')
  }

  const [anoStr, mesStr] = dias[0].data.split('-')
  const ano = parseInt(anoStr)
  const mes = parseInt(mesStr)

  return { id: `${ano}-${String(mes).padStart(2, '0')}`, mes, ano, dias }
}
