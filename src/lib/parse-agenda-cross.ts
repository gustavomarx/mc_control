import * as XLSX from 'xlsx'

const STATUS_ATIVOS = ['Agendado', 'Confirmado', 'Aguardando', 'Em Atendimento', 'Pago', 'Finalizado']

function parseDataBR(str: string): Date | null {
  if (!str) return null
  if (str.includes('/')) {
    // dd/mm/yyyy
    const [dia, mes, ano] = str.split('/').map(Number)
    if (!dia || !mes || !ano) return null
    return new Date(ano, mes - 1, dia)
  }
  const partes = str.split('-')
  if (partes.length < 3) return null
  if (partes[0].length === 4) {
    // yyyy-mm-dd (ISO — gerado pelo getCol ao receber Date object do XLSX)
    const [ano, mes, dia] = partes.map(Number)
    if (!ano || !mes || !dia) return null
    return new Date(ano, mes - 1, dia)
  }
  // dd-mm-yyyy
  const [dia, mes, ano] = partes.map(Number)
  if (!dia || !mes || !ano) return null
  return new Date(ano, mes - 1, dia)
}

function normTel(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('55') && (digits.length === 13 || digits.length === 12)) return digits.slice(2)
  return digits
}

function normNome(nome: string): string {
  return nome.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
}

function isModelo(servico: string): boolean {
  return /modelo/i.test(servico)
}

// Retorna o período que o usuário deve exportar no AVEC:
// início = primeiro dia de 2 meses atrás
// fim    = último dia do próximo mês
export function periodoExportacao(): { inicio: Date; fim: Date; label: string } {
  const hoje = new Date()
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0)
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  return { inicio, fim, label: `${fmt(inicio)} até ${fmt(fim)}` }
}

export interface AgendaCrossData {
  celulares: string[]   // agendadas no futuro (para excluir da recuperação)
  nomes: string[]
  totalAgendadas: number
}

export interface RecuperacaoDerivada {
  id: string
  nome: string
  celular: string
  ultimaVisita: string
  diasSemRetorno: number
  isModelo: boolean
  alertaCancelamento?: string
}

export interface Agenda0051Result {
  cross: AgendaCrossData
  recuperacao: RecuperacaoDerivada[]
}

// Case-insensitive field lookup: tries multiple column name variants
// Handles Date objects from XLSX cellDates:true converting them to ISO "YYYY-MM-DD"
function getCol(row: Record<string, unknown>, ...names: string[]): string {
  const normalized: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    const key = k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (v instanceof Date) {
      // Use UTC methods to avoid timezone shifting the date (XLSX stores as UTC midnight)
      const yyyy = v.getUTCFullYear()
      const mm = String(v.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(v.getUTCDate()).padStart(2, '0')
      normalized[key] = `${yyyy}-${mm}-${dd}`
    } else {
      normalized[key] = String(v)
    }
  }
  for (const name of names) {
    const key = name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (normalized[key] !== undefined) return normalized[key]
  }
  return ''
}

export async function parseAgenda0051(file: File): Promise<Agenda0051Result> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const fimProximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0, 23, 59, 59, 999)

  // Agendamentos futuros (para cross)
  const futurosCelulares = new Set<string>()
  const futurosNomes = new Set<string>()

  // Por cliente: última visita passada, flag modelo e cancelamentos/faltas após a visita
  const clienteMap = new Map<string, {
    nome: string
    celular: string
    ultimaVisita: Date
    isModelo: boolean
    cancelamentos: { data: Date; tipo: 'Cancelou' | 'Faltou' }[]
  }>()

  for (const row of rows) {
    const nome = getCol(row, 'Cliente', 'Nome').trim()
    if (!nome) continue

    const tel = normTel(getCol(row, 'Celular', 'Telefone', 'Tel', 'Fone', 'Celular/WhatsApp', 'WhatsApp').trim())
    const servico = getCol(row, 'Serviço', 'Servico', 'Serviço/Produto', 'Produto', 'Descrição', 'Descricao').trim()
    const status = getCol(row, 'Status')
    const dataStr = getCol(row, 'Data Reserva', 'Data_Reserva', 'Data')
    const data = parseDataBR(dataStr)

    const chave = tel || normNome(nome)

    if (data && data >= hoje && data <= fimProximoMes && STATUS_ATIVOS.includes(status)) {
      // Agendamento futuro → cross
      if (tel) futurosCelulares.add(tel)
      futurosNomes.add(normNome(nome))
    } else if (data && data < hoje) {
      if (STATUS_ATIVOS.includes(status)) {
        // Visita passada confirmada → candidata à recuperação
        const existente = clienteMap.get(chave)
        const eModelo = isModelo(servico)
        if (!existente || data > existente.ultimaVisita) {
          clienteMap.set(chave, {
            nome,
            celular: tel,
            ultimaVisita: data,
            isModelo: eModelo || (existente?.isModelo ?? false),
            cancelamentos: existente?.cancelamentos ?? [],
          })
        } else if (eModelo) {
          existente.isModelo = true
        }
      } else if (status === 'Cancelado' || status === 'Faltou') {
        // Cancelamento ou falta → registrar para alerta posterior
        const existente = clienteMap.get(chave)
        const tipo = status === 'Cancelado' ? 'Cancelou' : 'Faltou'
        if (existente) {
          existente.cancelamentos.push({ data, tipo })
        } else {
          // Cliente só tem cancelamentos (nunca veio) — ignora para recuperação
        }
      }
    }
  }

  // Recuperação = clientes com visita passada que NÃO têm agendamento futuro
  const diasMs = 1000 * 60 * 60 * 24
  const recuperacao: RecuperacaoDerivada[] = []
  const fmtData = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

  for (const [chave, c] of clienteMap.entries()) {
    const temFuturo =
      (c.celular && futurosCelulares.has(c.celular)) ||
      futurosNomes.has(normNome(c.nome))
    if (temFuturo) continue

    // Cancelamentos/faltas APÓS a última visita
    const aposVisita = c.cancelamentos.filter(x => x.data > c.ultimaVisita)
    let alertaCancelamento: string | undefined
    if (aposVisita.length > 0) {
      const mais_recente = aposVisita.sort((a, b) => b.data.getTime() - a.data.getTime())[0]
      alertaCancelamento = `${mais_recente.tipo} em ${fmtData(mais_recente.data)}`
      if (aposVisita.length > 1) {
        alertaCancelamento += ` (+${aposVisita.length - 1} vez${aposVisita.length > 2 ? 'es' : ''})`
      }
    }

    recuperacao.push({
      id: c.celular || chave,
      nome: c.nome,
      celular: c.celular,
      ultimaVisita: fmtData(c.ultimaVisita),
      diasSemRetorno: Math.floor((hoje.getTime() - c.ultimaVisita.getTime()) / diasMs),
      isModelo: c.isModelo,
      ...(alertaCancelamento ? { alertaCancelamento } : {}),
    })
  }

  recuperacao.sort((a, b) => b.diasSemRetorno - a.diasSemRetorno)

  return {
    cross: {
      celulares: Array.from(futurosCelulares),
      nomes: Array.from(futurosNomes),
      totalAgendadas: futurosCelulares.size,
    },
    recuperacao,
  }
}
