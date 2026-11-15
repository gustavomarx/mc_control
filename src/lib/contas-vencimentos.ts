// Motor de vencimentos das contas a pagar — puro (sem SDK do Firebase), usado
// pelo aviso no Discord (cron) e pelos comandos /pago e /pendentes.
//
// Datas são tratadas como "dia de calendário" em UTC 00:00 (Date.UTC), para não
// depender do fuso do servidor (a Vercel roda em UTC; o estúdio está em UTC-3).

export interface ContaBasica {
  id: string
  nome: string
  fornecedor?: string
  valor: number | null
  percentual?: number | null
  diaVencimento: number
  recorrencia: 'mensal' | 'semanal' | 'unica' | 'anual'
  mesAnual?: number
  mesInicio?: number
  anoInicio?: number
  tipo?: 'fixo' | 'variavel'
  ativa: boolean
  criadoEm?: { toDate?: () => Date }
  historicoPagamentos?: Array<{
    valorPago: number
    mesRef?: number
    anoRef?: number
    usuarioId?: string
    pagoEm?: { toMillis?: () => number }
  }>
}

export interface ItemVencimento {
  conta: ContaBasica
  vencimento: Date   // UTC 00:00 do dia
  mesRef: number
  anoRef: number
  valorPrevisto: number | null
  pago: number
  restante: number | null
  estimado: boolean  // conta variável: valor cadastrado é estimativa
}

const DIA_MS = 86_400_000

// ── Datas ────────────────────────────────────────────────────────────────

export function dia(ano: number, mes: number, d: number): Date {
  return new Date(Date.UTC(ano, mes - 1, d))
}

export function somarDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DIA_MS)
}

export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

// Data de hoje no fuso de São Paulo (UTC 00:00 daquele dia)
export function hojeSaoPaulo(agora = new Date()): Date {
  const [a, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora).split('-').map(Number)
  return dia(a, m, d)
}

export function chaveDia(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function diaSemana(d: Date): number {
  return d.getUTCDay() // 0 = domingo
}

const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function rotuloDia(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${DIAS_SEMANA_CURTO[diaSemana(d)]} ${dd}/${mm}`
}

export function ddmm(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// ── Feriados nacionais (em que banco não abre) ──────────────────────────

function pascoa(ano: number): Date {
  // Algoritmo de Meeus/Jones/Butcher
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const d2 = ((h + l - 7 * m + 114) % 31) + 1
  return dia(ano, mes, d2)
}

const cacheFeriados = new Map<number, Map<string, string>>()

export function feriadosNacionais(ano: number): Map<string, string> {
  const cache = cacheFeriados.get(ano)
  if (cache) return cache
  const p = pascoa(ano)
  const lista: Array<[Date, string]> = [
    [dia(ano, 1, 1), 'Confraternização Universal'],
    [somarDias(p, -48), 'Carnaval'],
    [somarDias(p, -47), 'Carnaval'],
    [somarDias(p, -2), 'Sexta-feira Santa'],
    [dia(ano, 4, 21), 'Tiradentes'],
    [dia(ano, 5, 1), 'Dia do Trabalho'],
    [somarDias(p, 60), 'Corpus Christi'],
    [dia(ano, 9, 7), 'Independência'],
    [dia(ano, 10, 12), 'Nossa Senhora Aparecida'],
    [dia(ano, 11, 2), 'Finados'],
    [dia(ano, 11, 15), 'Proclamação da República'],
    [dia(ano, 11, 20), 'Consciência Negra'],
    [dia(ano, 12, 25), 'Natal'],
  ]
  const mapa = new Map(lista.map(([d, nome]) => [chaveDia(d), nome]))
  cacheFeriados.set(ano, mapa)
  return mapa
}

export function feriado(d: Date): string | null {
  return feriadosNacionais(d.getUTCFullYear()).get(chaveDia(d)) ?? null
}

export function ehDiaUtil(d: Date): boolean {
  const s = diaSemana(d)
  return s !== 0 && s !== 6 && !feriado(d)
}

export function proximoDiaUtil(d: Date): Date {
  let x = somarDias(d, 1)
  while (!ehDiaUtil(x)) x = somarDias(x, 1)
  return x
}

// Motivo de banco fechado (fim de semana ou feriado), ou null se dia útil
export function motivoBancoFechado(d: Date): string | null {
  const f = feriado(d)
  if (f) return `feriado de ${f}`
  const s = diaSemana(d)
  if (s === 6) return 'sábado'
  if (s === 0) return 'domingo'
  return null
}

// ── Vencimentos ─────────────────────────────────────────────────────────

// Vencimento da conta no mês/ano, ou null se a conta não vence naquele mês.
// Dia maior que o último do mês (ex.: 30 em fevereiro) cai no último dia do mês.
export function vencimentoNoMes(conta: ContaBasica, ano: number, mes: number): Date | null {
  if (conta.recorrencia === 'anual' && conta.mesAnual !== mes) return null
  const d = Math.min(Math.max(conta.diaVencimento || 1, 1), ultimoDiaDoMes(ano, mes))
  return dia(ano, mes, d)
}

export function totalPagoNoMes(conta: ContaBasica, ano: number, mes: number): number {
  return (conta.historicoPagamentos ?? [])
    .filter(h => h.mesRef === mes && h.anoRef === ano)
    .reduce((s, h) => s + (h.valorPago || 0), 0)
}

// Quitada: pagou o valor cadastrado. Conta variável (valor é só estimativa) ou sem valor
// fixo: qualquer pagamento no mês quita.
export function contaQuitada(conta: ContaBasica, pago: number): boolean {
  if (pago <= 0) return false
  if (conta.tipo === 'variavel' || conta.valor == null) return true
  return pago >= conta.valor - 0.005
}

function montarItem(conta: ContaBasica, ano: number, mes: number, venc: Date): ItemVencimento | null {
  const pago = totalPagoNoMes(conta, ano, mes)
  const previsto = conta.valor ?? null
  if (contaQuitada(conta, pago)) return null
  return {
    conta, vencimento: venc, mesRef: mes, anoRef: ano,
    valorPrevisto: previsto,
    pago,
    restante: previsto == null ? null : Math.round((previsto - pago) * 100) / 100,
    estimado: conta.tipo === 'variavel',
  }
}

// Contas não quitadas com vencimento dentro de [de, ate] (inclusive)
export function vencimentosEntre(contas: ContaBasica[], de: Date, ate: Date): ItemVencimento[] {
  const out: ItemVencimento[] = []
  for (const conta of contas) {
    if (!conta.ativa) continue
    let ano = de.getUTCFullYear()
    let mes = de.getUTCMonth() + 1
    const fimAno = ate.getUTCFullYear()
    const fimMes = ate.getUTCMonth() + 1
    while (ano < fimAno || (ano === fimAno && mes <= fimMes)) {
      const venc = vencimentoNoMes(conta, ano, mes)
      if (venc && venc >= de && venc <= ate && !antesDoInicio(conta, ano, mes)) {
        const item = montarItem(conta, ano, mes, venc)
        if (item) out.push(item)
      }
      mes++
      if (mes > 12) { mes = 1; ano++ }
    }
  }
  return ordenar(out)
}

// Mesmo critério da aba "Atrasados" da tela: mesInicio/anoInicio, senão o mês de cadastro
function antesDoInicio(conta: ContaBasica, ano: number, mes: number): boolean {
  let mi = conta.mesInicio
  let ai = conta.anoInicio
  if (!mi || !ai) {
    const criado = conta.criadoEm?.toDate?.()
    if (!criado) return false
    mi = criado.getMonth() + 1
    ai = criado.getFullYear()
  }
  return ano < ai || (ano === ai && mes < mi)
}

// Contas vencidas e não quitadas (até ontem), olhando no máximo `mesesAtras` meses
export function atrasadas(contas: ContaBasica[], hoje: Date, mesesAtras = 12): ItemVencimento[] {
  let ano = hoje.getUTCFullYear()
  let mes = hoje.getUTCMonth() + 1 - mesesAtras
  while (mes < 1) { mes += 12; ano-- }
  return vencimentosEntre(contas, dia(ano, mes, 1), somarDias(hoje, -1))
}

function ordenar(itens: ItemVencimento[]): ItemVencimento[] {
  return itens.sort((a, b) =>
    a.vencimento.getTime() - b.vencimento.getTime() ||
    a.conta.nome.localeCompare(b.conta.nome, 'pt-BR'))
}

// ── Janelas do aviso diário ─────────────────────────────────────────────

// Aviso "véspera": num dia útil, cobre de amanhã até o próximo dia útil
// (na sexta pega sáb, dom e seg; antes de feriado pega o feriado também).
// Em dia sem banco não manda nada (já foi coberto no último dia útil).
export function janelaVespera(hoje: Date): { de: Date; ate: Date } | null {
  if (!ehDiaUtil(hoje)) return null
  return { de: somarDias(hoje, 1), ate: proximoDiaUtil(hoje) }
}

// Semana corrente: segunda a domingo
export function janelaSemana(hoje: Date): { de: Date; ate: Date } {
  const s = diaSemana(hoje)
  const seg = somarDias(hoje, s === 0 ? -6 : 1 - s)
  return { de: seg, ate: somarDias(seg, 6) }
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// "1.234,56" | "1234.56" | "R$ 244,19" → número
export function parseValorBR(txt: string): number | null {
  const limpo = txt.replace(/[R$\s]/g, '')
  if (!limpo) return null
  const normal = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo
  const n = Number(normal)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}
