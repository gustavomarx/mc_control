// Parser para extrato Sicoob — formato pdftotext -layout
// Estrutura do PDF: 3 colunas (DATA | HISTÓRICO | VALOR)
// Linhas com data iniciam nova transação; linhas sem data são continuação da descrição

export interface LancamentoParsed {
  data: string          // DD/MM/YYYY
  descricao: string     // descrição limpa (sem CNPJ)
  valor: number         // sempre positivo
  tipo: 'C' | 'D'       // C = crédito (entrada), D = débito (saída)
  descricaoOriginal: string
  cnpj?: string         // XX.XXX.XXX/XXXX-XX, quando presente na transação
  nomeEmpresa?: string  // preenchido pelo enriquecimento via BrasilAPI
}

export interface ResultadoParse {
  lancamentos: LancamentoParsed[]
  mes: number
  ano: number
  conta: string
  totalEntradas: number
  totalSaidas: number
  erros: string[]
}

// Descricoes que indicam linhas de saldo/cabeçalho a ignorar
const LINHAS_IGNORAR = [
  /saldo anterior/i,
  /saldo bloq/i,
  /saldo do dia/i,
  /hist.rico de movimenta/i,
  /hist.rico$/i,
  /resumo/i,
  /saldo em conta/i,
  /cheque especial/i,
  /juros vencidos/i,
  /tarifas vencidas/i,
  /saldo dispon/i,
  /saldo bloqueado/i,
  /encargos/i,
  /previs.o/i,
  /custo efetivo/i,
  /extratos emitidos/i,
  /ouvidoria/i,
  /sac:/i,
]

// CNPJ no formato Sicoob: "11.377.588 0001-13" ou "11.377.588/0001-13"
const reCNPJ = /\d{2,3}\.\d{3}\.\d{3}[\s/]\d{4}-\d{2}/

export function extrairCNPJ(desc: string): string | undefined {
  const m = desc.match(reCNPJ)
  if (!m) return undefined
  const digits = m[0].replace(/\D/g, '')
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12,14)}`
}

function deveIgnorar(desc: string): boolean {
  return LINHAS_IGNORAR.some(r => r.test(desc))
}

function parseValor(str: string): { valor: number; tipo: 'C' | 'D' } | null {
  // Aceita: 1.234,56C  ou  123,45D  ou  1234,56C
  const m = str.match(/([\d.]+,\d{2})([CD])$/)
  if (!m) return null
  const valor = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  return { valor, tipo: m[2] as 'C' | 'D' }
}

function limparDescricao(desc: string): string {
  return desc
    .replace(/\s+/g, ' ')
    .replace(/DOC\.:?\s*Pix/gi, '')
    .replace(reCNPJ, '')   // remove CNPJ do texto limpo (fica em campo próprio)
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseSicoob(text: string): ResultadoParse {
  const lines = text.split('\n')
  const erros: string[] = []

  // Extrai ano e mês do período
  const periodoMatch = text.match(/PER[IÍ]ODO:\s*(\d{2})\/(\d{2})\/(\d{4})/i)
  const ano = periodoMatch ? parseInt(periodoMatch[3]) : new Date().getFullYear()
  const mes = periodoMatch ? parseInt(periodoMatch[2]) : new Date().getMonth() + 1

  // Extrai conta
  const contaMatch = text.match(/CONTA:\s*[\d.]+-\d+\s*\/\s*(.+)/i)
  const conta = contaMatch ? contaMatch[1].trim() : ''

  // Detecta se linha tem data no início: "DD/MM " seguido de whitespace
  const reData = /^(\d{2}\/\d{2})\s+/
  // Detecta valor no final da linha: whitespace + "123,45C" ou "1.234,56D"
  const reValor = /\s+([\d.]+,\d{2}[CD])\s*$/

  interface Transacao {
    data: string
    descLines: string[]
    valorStr: string | null
  }

  const transacoes: Transacao[] = []
  let current: Transacao | null = null

  for (const line of lines) {
    const dateMatch = line.match(reData)
    const valorMatch = line.match(reValor)

    if (dateMatch) {
      // Nova transação
      if (current) transacoes.push(current)
      const dataMM = dateMatch[1] // DD/MM
      // Inferir ano: se mês da linha for > mês do período, pode ser ano anterior
      const [dd, mm] = dataMM.split('/').map(Number)
      const anoLanc = mm > mes ? ano - 1 : ano
      const dataFull = `${String(dd).padStart(2,'0')}/${String(mm).padStart(2,'0')}/${anoFull(anoLanc)}`

      // Remove data do início e valor do fim para pegar só descrição
      const desc = line.replace(reData, '').replace(reValor, '').trim()

      current = {
        data: dataFull,
        descLines: desc ? [desc] : [],
        valorStr: valorMatch ? valorMatch[1] : null,
      }
    } else if (current) {
      // Linha de continuação
      const contDesc = line.replace(reValor, '').trim()
      if (contDesc) current.descLines.push(contDesc)
      if (valorMatch && !current.valorStr) current.valorStr = valorMatch[1]
    }
  }
  if (current) transacoes.push(current)

  // Converte transações em lançamentos
  const lancamentos: LancamentoParsed[] = []

  for (const t of transacoes) {
    if (!t.valorStr) continue
    const parsed = parseValor(t.valorStr)
    if (!parsed) continue

    const descOriginal = t.descLines.join(' ').trim()
    if (deveIgnorar(descOriginal)) continue
    if (!descOriginal) continue

    lancamentos.push({
      data: t.data,
      descricao: limparDescricao(descOriginal),
      descricaoOriginal: descOriginal,
      valor: parsed.valor,
      tipo: parsed.tipo,
      cnpj: extrairCNPJ(descOriginal),
    })
  }

  const totalEntradas = lancamentos.filter(l => l.tipo === 'C').reduce((s, l) => s + l.valor, 0)
  const totalSaidas   = lancamentos.filter(l => l.tipo === 'D').reduce((s, l) => s + l.valor, 0)

  return { lancamentos, mes, ano, conta, totalEntradas, totalSaidas, erros }
}

function anoFull(ano: number): string {
  return String(ano)
}
