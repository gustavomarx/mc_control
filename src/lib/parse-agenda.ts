import * as XLSX from 'xlsx'
import { Timestamp } from 'firebase/firestore'
import type { AgendaAvec, AgendamentoAvec, AgendaDia, StatusAgendamento } from '@/types'

const STATUS_ATIVOS: StatusAgendamento[] = [
  'Agendado', 'Confirmado', 'Aguardando', 'Em Atendimento', 'Pago', 'Finalizado',
]

function getSegundaFeira(d: Date): Date {
  const dia = new Date(d)
  const dow = dia.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  dia.setDate(dia.getDate() + diff)
  dia.setHours(0, 0, 0, 0)
  return dia
}

export function toLocalKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function semanaKey(d: Date): string {
  return toLocalKey(getSegundaFeira(d))
}

function parseDataBR(str: string): Date | null {
  if (!str) return null
  // Aceita DD/MM/YYYY ou YYYY-MM-DD
  const partes = str.includes('/') ? str.split('/') : str.split('-').reverse()
  if (partes.length < 3) return null
  const [dia, mes, ano] = partes.map(Number)
  if (!dia || !mes || !ano) return null
  return new Date(ano, mes - 1, dia)
}

function classificarServico(servico: string): 'cilios' | 'unhas' | 'agregados' | 'outros' {
  const s = servico.toLowerCase()
  if (/c[íi]lio|extens|manut|lifting|lash/.test(s)) return 'cilios'
  if (/unha|manicu|esmalte|esmaltaç|gel|fibra/.test(s)) return 'unhas'
  if (/sobrancelha|brow|spa|epilaç|depil/.test(s)) return 'agregados'
  return 'outros'
}

function isClienteNova(obs: string, dataCadastro: string): boolean {
  if (/primeiro agendamento/i.test(obs)) return true
  const d = parseDataBR(dataCadastro)
  if (!d) return false
  const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
  return diff <= 30
}

// Domingo = não conta (semana é seg-sáb)
function isDomingo(d: Date): boolean {
  return d.getDay() === 0
}

export async function parseAgendaAvec(file: File): Promise<AgendaAvec[]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

  // Agrupa dados por semanaKey
  const semanas = new Map<string, {
    agendamentos: AgendamentoAvec[]
    porDia: Record<string, AgendaDia>
    clientesDia: Record<string, Set<string>>
    porProfissional: Record<string, Record<string, number>>
    porProfissionalClientes: Record<string, Record<string, Set<string>>>
    porServico: { cilios: number; unhas: number; agregados: number; outros: number }
    totalAtivos: number
    totalCancelados: number
    totalFaltas: number
    clientesNovas: number
    clientesUnicasSet: Set<string>
  }>()

  for (const row of rows) {
    const dataReservaStr = String(row['Data Reserva'] ?? row['Data_Reserva'] ?? '')
    const dataReserva = parseDataBR(dataReservaStr)
    if (!dataReserva) continue
    if (isDomingo(dataReserva)) continue

    const chave = semanaKey(dataReserva)

    if (!semanas.has(chave)) {
      semanas.set(chave, {
        agendamentos: [],
        porDia: {},
        clientesDia: {},
        porProfissional: {},
        porProfissionalClientes: {},
        porServico: { cilios: 0, unhas: 0, agregados: 0, outros: 0 },
        totalAtivos: 0,
        totalCancelados: 0,
        totalFaltas: 0,
        clientesNovas: 0,
        clientesUnicasSet: new Set(),
      })
    }

    const s = semanas.get(chave)!
    const status = String(row['Status'] ?? '') as StatusAgendamento
    const profissional = String(row['Profissional'] ?? '').trim()
    const servico = String(row['Serviço'] ?? row['Servico'] ?? '').trim()
    const obs = String(row['Observação'] ?? row['Observacao'] ?? '').trim()
    const dataCadastroCliente = String(row['Data Cadastro Cliente'] ?? '')
    const nova = isClienteNova(obs, dataCadastroCliente)

    const agendamento: AgendamentoAvec = {
      dataReserva: dataReservaStr,
      hora: String(row['Hora'] ?? ''),
      cliente: String(row['Cliente'] ?? '').trim(),
      celular: String(row['Celular'] ?? '').trim(),
      dataCadastroCliente,
      profissional,
      servico,
      status,
      observacao: obs,
      clienteNova: nova,
    }
    s.agendamentos.push(agendamento)

    const dataKey = toLocalKey(dataReserva)
    if (!s.porDia[dataKey]) {
      s.porDia[dataKey] = { ativos: 0, confirmados: 0, aguardando: 0, agendados: 0, cancelados: 0, faltas: 0 }
    }

    if (status === 'Cancelado') {
      s.totalCancelados++
      s.porDia[dataKey].cancelados++
    } else if (status === 'Faltou') {
      s.totalFaltas++
      s.porDia[dataKey].faltas++
    } else if (STATUS_ATIVOS.includes(status)) {
      s.totalAtivos++
      if (status === 'Confirmado') s.porDia[dataKey].confirmados++
      if (status === 'Aguardando') s.porDia[dataKey].aguardando++
      if (status === 'Agendado') s.porDia[dataKey].agendados++
      if (nova) s.clientesNovas++
      const nomeCliente = agendamento.cliente.toLowerCase().trim()
      if (nomeCliente) {
        s.clientesUnicasSet.add(nomeCliente)
        if (!s.clientesDia[dataKey]) s.clientesDia[dataKey] = new Set()
        s.clientesDia[dataKey].add(nomeCliente)
      }

      const cat = classificarServico(servico)
      s.porServico[cat]++

      if (profissional) {
        if (!s.porProfissionalClientes[profissional]) s.porProfissionalClientes[profissional] = {}
        if (!s.porProfissionalClientes[profissional][dataKey]) s.porProfissionalClientes[profissional][dataKey] = new Set()
        const nomeCliente = agendamento.cliente.toLowerCase().trim()
        if (nomeCliente) s.porProfissionalClientes[profissional][dataKey].add(nomeCliente)
      }
    }
  }

  // Preenche ativos com clientes únicas por dia
  for (const s of semanas.values()) {
    for (const [dataKey, dia] of Object.entries(s.porDia)) {
      dia.ativos = s.clientesDia[dataKey]?.size ?? 0
    }
  }

  const agora = Timestamp.now()
  return Array.from(semanas.entries()).map(([chave, s]) => ({
    id: chave,
    semanaKey: chave,
    uploadEm: agora,
    totalAtivos: s.totalAtivos,
    totalCancelados: s.totalCancelados,
    totalFaltas: s.totalFaltas,
    clientesUnicas: s.clientesUnicasSet.size,
    clientesNovas: s.clientesNovas,
    porDia: s.porDia,
    porProfissional: Object.fromEntries(
      Object.entries(s.porProfissionalClientes).map(([prof, dias]) => [
        prof,
        Object.fromEntries(Object.entries(dias).map(([dia, set]) => [dia, set.size])),
      ])
    ),
    porServico: s.porServico,
    agendamentos: s.agendamentos,
  }))
}
