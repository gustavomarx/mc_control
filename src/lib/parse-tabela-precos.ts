import * as XLSX from 'xlsx'

export interface ServicoPreco {
  servico: string
  valor: number
}

/**
 * Lê o CSV/XLSX de preços do AVEC (colunas: Serviço, Descrição, Categoria, Valor).
 * Retorna lista de { servico, valor }.
 */
export async function parseTabelaPrecos(file: File): Promise<ServicoPreco[]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  const resultado: ServicoPreco[] = []

  for (const row of rows) {
    const keys = Object.keys(row)
    const servicoKey = keys.find(k => /servi/i.test(k))
    const valorKey   = keys.find(k => /valor/i.test(k))
    if (!servicoKey || !valorKey) continue

    const servico = String(row[servicoKey]).trim()
    const valorRaw = row[valorKey]
    let valor: number

    if (typeof valorRaw === 'number') {
      valor = valorRaw
    } else {
      // Remove "R$", espaços, pontos de milhar; troca vírgula decimal por ponto
      const s = String(valorRaw).replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim()
      valor = parseFloat(s)
    }

    if (servico && !isNaN(valor) && valor > 0) {
      resultado.push({ servico, valor })
    }
  }

  return resultado
}
