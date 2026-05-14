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

function semanaKey(d: Date): string {
  return getSegundaFeira(d).toISOString().slice(0, 10)
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

export async function parseAgendaAvec(file: File): Promise<AgendaAvec> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

  const agora = new Date()
  const chave = semanaKey(agora)
  const inicioSemana = getSegundaFeira(agora)
  const fimSemana = new Date(inicioSemana)
  fimSemana.setDate(fimSemana.getDate() + 6)
  fimSemana.setHours(23, 59, 59, 999)

  const agendamentos: AgendamentoAvec[] = []
  const porDia: Record<string, AgendaDia> = {}
  const porProfissional: Record<string, Record<string, number>> = {}
  const porServico = { cilios: 0, unhas: 0, agregados: 0, outros: 0 }

  let totalAtivos = 0
  let totalCancelados = 0
  let totalFaltas = 0
  let clientesNovas = 0

  for (const row of rows) {
    const dataReservaStr = String(row['Data Reserva'] ?? row['Data_Reserva'] ?? '')
    const dataReserva = parseDataBR(dataReservaStr)
    if (!dataReserva) continue
    if (dataReserva < inicioSemana || dataReserva > fimSemana) continue

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
    agendamentos.push(agendamento)

    const dataKey = dataReserva.toISOString().slice(0, 10)
    if (!porDia[dataKey]) {
      porDia[dataKey] = { ativos: 0, confirmados: 0, aguardando: 0, agendados: 0, cancelados: 0, faltas: 0 }
    }

    if (status === 'Cancelado') {
      totalCancelados++
      porDia[dataKey].cancelados++
    } else if (status === 'Faltou') {
      totalFaltas++
      porDia[dataKey].faltas++
    } else if (STATUS_ATIVOS.includes(status)) {
      totalAtivos++
      porDia[dataKey].ativos++
      if (status === 'Confirmado') porDia[dataKey].confirmados++
      if (status === 'Aguardando') porDia[dataKey].aguardando++
      if (status === 'Agendado') porDia[dataKey].agendados++
      if (nova) clientesNovas++

      const cat = classificarServico(servico)
      porServico[cat]++

      if (profissional) {
        if (!porProfissional[profissional]) porProfissional[profissional] = {}
        porProfissional[profissional][dataKey] = (porProfissional[profissional][dataKey] ?? 0) + 1
      }
    }
  }

  return {
    id: chave,
    semanaKey: chave,
    uploadEm: Timestamp.now(),
    totalAtivos,
    totalCancelados,
    totalFaltas,
    clientesNovas,
    porDia,
    porProfissional,
    porServico,
    agendamentos,
  }
}
