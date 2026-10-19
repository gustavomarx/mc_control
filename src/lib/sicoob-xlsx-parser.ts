// Parser para extrato Sicoob exportado em .xlsx pelo internet banking
// Planilha "LANÇAMENTOS": DATA | DOCUMENTO | HISTÓRICO | INFORMAÇÕES COMPLEMENTARES | VALOR
// O VALOR já vem com sinal (negativo = débito). O histórico vem por extenso;
// convertemos para a abreviação do PDF para que palavras-chave e regras
// já cadastradas continuem batendo com a descrição original.

import * as XLSX from 'xlsx'
import { deveIgnorar, limparDescricao, extrairCNPJ } from '@/lib/sicoob-parser'
import type { LancamentoParsed, ResultadoParse } from '@/lib/sicoob-parser'

const HISTORICO_PDF: Record<string, string> = {
  'PIX EMITIDO OUTRA IF':            'PIX EMIT.OUTRA IF',
  'PIX RECEBIDO - OUTRA IF':         'PIX RECEB.OUTRA IF',
  'CR ANTECIPAÇÃO VISA':             'CR ANT VISA',
  'CR ANTECIPAÇÃO MASTERCARD':       'CR ANT MSTD',
  'CR ANTECIPAÇÃO OUTRAS BANDEIRAS': 'CR ANT OUT BND',
  'CR COMPRAS MAESTRO':              'CR CMP MST',
  'CR COMPRAS VISA ELECTRON':        'CR CPS VS ELECTRON',
  'CR COMPRAS DEB OUTRAS BANDEIRAS': 'CR CPS DB OUT BND',
  'TRANSF.REALIZADA PIX SICOOB':     'TRANSF. PIX SICOOB',
  'DÉB.TIT.COMPE EFETIVADO':         'DÉB.TIT.COMPE.EFETI',
  'DÉBITO PACOTE SERVIÇOS':          'DEB PACOTE SERVIÇOS',
}

function celulaData(v: unknown): string | null {
  if (typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(v.trim())) return v.trim()
  if (typeof v === 'number') {
    // Serial do Excel
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`
  }
  return null
}

function celulaValor(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? null : n
  }
  return null
}

export function parseSicoobXlsx(buffer: Buffer): ResultadoParse {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets['LANÇAMENTOS'] ?? wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null })
  const erros: string[] = []

  const header = rows.findIndex(r => String(r[0] ?? '').toUpperCase() === 'DATA')
  if (header < 0) throw new Error('Planilha sem cabeçalho DATA/HISTÓRICO/VALOR — não parece um extrato Sicoob')

  const lancamentos: LancamentoParsed[] = []
  for (const r of rows.slice(header + 1)) {
    const data = celulaData(r[0])
    const valor = celulaValor(r[4])
    const historico = String(r[2] ?? '').trim()
    if (!data || valor === null || !historico) continue
    if (deveIgnorar(historico) || valor === 0) continue

    const documento = String(r[1] ?? '').trim()
    const info = String(r[3] ?? '').replace(/\s*\n\s*/g, ' ').trim()
    const hist = HISTORICO_PDF[historico.toUpperCase()] ?? historico
    const doc = documento ? ` DOC.: ${documento}` : ''
    const descOriginal = `${hist} ${info}${doc}`.replace(/\s+/g, ' ').trim()

    lancamentos.push({
      data,
      descricao: limparDescricao(descOriginal),
      descricaoOriginal: descOriginal,
      valor: Math.abs(valor),
      tipo: valor >= 0 ? 'C' : 'D',
      cnpj: extrairCNPJ(descOriginal),
    })
  }

  // Mês de referência = mês com mais lançamentos (o arquivo pode trazer o saldo do mês anterior)
  const contagem = new Map<string, number>()
  for (const l of lancamentos) {
    const k = l.data.slice(3)
    contagem.set(k, (contagem.get(k) ?? 0) + 1)
  }
  const mesRef = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const [mes, ano] = mesRef
    ? mesRef.split('/').map(Number)
    : [new Date().getMonth() + 1, new Date().getFullYear()]
  if (!mesRef) erros.push('Nenhum lançamento encontrado na planilha')

  const totalEntradas = lancamentos.filter(l => l.tipo === 'C').reduce((s, l) => s + l.valor, 0)
  const totalSaidas   = lancamentos.filter(l => l.tipo === 'D').reduce((s, l) => s + l.valor, 0)

  return { lancamentos, mes, ano, conta: '', totalEntradas, totalSaidas, erros }
}
