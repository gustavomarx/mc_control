// Integração com o Discord — avisos de contas a pagar e comandos /pago, /pendentes.
// Server-only (usa node:crypto e tokens).
//
// Variáveis de ambiente:
//   DISCORD_WEBHOOK_URL     envio sem bot (sem botões)
//   DISCORD_BOT_TOKEN       envio pelo bot (com botão "Paguei") + registro dos comandos
//   DISCORD_CHANNEL_ID      canal onde o bot posta
//   DISCORD_APPLICATION_ID  id do app (registro dos comandos)
//   DISCORD_GUILD_ID        servidor do estúdio (registro dos comandos)
//   DISCORD_PUBLIC_KEY      chave pública do app (verifica as interações)
//   DISCORD_USUARIOS        quem pode usar /pago (usernames ou ids, separados por vírgula)
//   DISCORD_MENCIONAR       ids a mencionar nos avisos (vazio = @everyone do canal)

import { createPublicKey, verify } from 'node:crypto'
import {
  type ItemVencimento, formatBRL, rotuloDia, ddmm, motivoBancoFechado, proximoDiaUtil,
  somarDias, ehDiaUtil,
} from '@/lib/contas-vencimentos'

const API = 'https://discord.com/api/v10'

// ── Assinatura das interações (Ed25519) ────────────────────────────────

const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex')

export function assinaturaValida(corpo: string, assinatura: string | null, timestamp: string | null): boolean {
  const chave = process.env.DISCORD_PUBLIC_KEY
  if (!chave || !assinatura || !timestamp) return false
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519, Buffer.from(chave, 'hex')]),
      format: 'der', type: 'spki',
    })
    return verify(null, Buffer.from(timestamp + corpo), key, Buffer.from(assinatura, 'hex'))
  } catch {
    return false
  }
}

// ── Quem pode registrar pagamento ──────────────────────────────────────

export interface UsuarioDiscord { id: string; username: string; global_name?: string | null }

export function usuarioAutorizado(u: UsuarioDiscord | undefined): boolean {
  if (!u) return false
  const lista = (process.env.DISCORD_USUARIOS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return lista.includes(u.id) || lista.includes(u.username.toLowerCase())
}

export function nomeUsuario(u: UsuarioDiscord): string {
  return u.global_name || u.username
}

// ── Envio ──────────────────────────────────────────────────────────────

export interface MensagemDiscord {
  content: string
  components?: unknown[]
  allowed_mentions?: { parse?: string[]; users?: string[] }
}

export function modoEnvio(): 'bot' | 'webhook' | null {
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID) return 'bot'
  if (process.env.DISCORD_WEBHOOK_URL) return 'webhook'
  return null
}

export async function enviarMensagem(msg: MensagemDiscord): Promise<void> {
  const modo = modoEnvio()
  if (modo === 'bot') {
    const r = await fetch(`${API}/channels/${process.env.DISCORD_CHANNEL_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    })
    if (!r.ok) throw new Error(`Discord (bot) ${r.status}: ${await r.text()}`)
    return
  }
  if (modo === 'webhook') {
    // webhook comum não aceita botões
    const r = await fetch(process.env.DISCORD_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg.content, allowed_mentions: msg.allowed_mentions }),
    })
    if (!r.ok) throw new Error(`Discord (webhook) ${r.status}: ${await r.text()}`)
    return
  }
  throw new Error('Discord não configurado (DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID ou DISCORD_WEBHOOK_URL)')
}

function mencoes(): { texto: string; allowed: MensagemDiscord['allowed_mentions'] } {
  const ids = (process.env.DISCORD_MENCIONAR ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (ids.length) return { texto: ids.map(id => `<@${id}>`).join(' '), allowed: { users: ids } }
  return { texto: '@everyone', allowed: { parse: ['everyone'] } }
}

// ── Montagem do aviso ──────────────────────────────────────────────────

export function linhaItem(it: ItemVencimento, comData = true): string {
  const valor = it.restante == null
    ? (it.conta.percentual ? `${it.conta.percentual}% do faturamento` : 'valor a definir')
    : `${it.estimado ? '≈ ' : ''}${formatBRL(it.restante)}`
  const parcial = it.pago > 0 ? ` _(já pago ${formatBRL(it.pago)})_` : ''
  const data = comData ? `\`${rotuloDia(it.vencimento)}\` ` : ''
  return `${data}${it.conta.nome}: **${valor}**${parcial}`
}

function total(itens: ItemVencimento[]): string {
  const soma = itens.reduce((s, it) => s + (it.restante ?? 0), 0)
  const temEstimado = itens.some(it => it.estimado)
  return `${temEstimado ? '≈ ' : ''}${formatBRL(soma)}`
}

// Observações de dias sem banco dentro da lista
function avisosBancoFechado(itens: ItemVencimento[]): string[] {
  const vistos = new Set<string>()
  const out: string[] = []
  for (const it of itens) {
    const motivo = motivoBancoFechado(it.vencimento)
    const k = ddmm(it.vencimento)
    if (!motivo || vistos.has(k)) continue
    vistos.add(k)
    const util = proximoDiaUtil(somarDias(it.vencimento, -1))
    out.push(`⚠️ ${rotuloDia(it.vencimento)} é ${motivo}: banco fechado. Pague antes ou até ${rotuloDia(util)}.`)
  }
  return out
}

export interface DadosAviso {
  hoje: Date
  semana?: { de: Date; ate: Date; itens: ItemVencimento[] }
  vespera?: { de: Date; ate: Date; itens: ItemVencimento[] }
  atrasadas?: ItemVencimento[]
}

const MAX_ATRASADAS = 12
const MAX_BOTOES = 20

export function montarAviso(d: DadosAviso): MensagemDiscord | null {
  const blocos: string[] = []
  const comBotao: ItemVencimento[] = []

  if (d.semana) {
    const { de, ate, itens } = d.semana
    const linhas = [`## 📅 Contas da semana · ${ddmm(de)} a ${ddmm(ate)}`]
    if (itens.length) {
      linhas.push(...itens.map(it => linhaItem(it)))
      linhas.push(`**Total: ${total(itens)}**`)
      linhas.push(...avisosBancoFechado(itens))
    } else {
      linhas.push('Nenhuma conta vence esta semana. 🎉')
    }
    blocos.push(linhas.join('\n'))
    comBotao.push(...itens)
  }

  if (d.vespera && d.vespera.itens.length) {
    const { de, ate, itens } = d.vespera
    const titulo = de.getTime() === ate.getTime()
      ? `## ⏰ Vence amanhã (${rotuloDia(de)})`
      : `## ⏰ Vence até ${rotuloDia(ate)}`
    const linhas = [titulo]
    if (de.getTime() !== ate.getTime()) {
      const dias = []
      for (let x = de; x < ate; x = somarDias(x, 1)) if (!ehDiaUtil(x)) dias.push(`${rotuloDia(x)} (${motivoBancoFechado(x)})`)
      if (dias.length) linhas.push(`_Banco fechado em ${dias.join(', ')}. Por isso já aviso tudo até o próximo dia útil._`)
    }
    linhas.push(...itens.map(it => linhaItem(it)))
    if (itens.length > 1) linhas.push(`**Total: ${total(itens)}**`)
    linhas.push(...avisosBancoFechado(itens))
    blocos.push(linhas.join('\n'))
    comBotao.push(...itens)
  }

  if (d.atrasadas && d.atrasadas.length) {
    const it = d.atrasadas
    const linhas = [`## 🔴 Em aberto de datas anteriores · ${it.length} conta${it.length > 1 ? 's' : ''} · ${total(it)}`]
    linhas.push(...it.slice(0, MAX_ATRASADAS).map(x =>
      `\`${String(x.mesRef).padStart(2, '0')}/${x.anoRef}\` ${linhaItem(x, false)}`))
    if (it.length > MAX_ATRASADAS) linhas.push(`_+ ${it.length - MAX_ATRASADAS} outras. Veja tudo com \`/pendentes\`._`)
    linhas.push('_Se já pagou, registre com `/pago` para sair daqui._')
    blocos.push(linhas.join('\n'))
  }

  if (!blocos.length) return null

  const legenda: string[] = []
  const todos = [...(d.semana?.itens ?? []), ...(d.vespera?.itens ?? []), ...(d.atrasadas ?? [])]
  if (todos.some(it => it.estimado)) legenda.push('≈ = conta variável, valor estimado')
  legenda.push('registre com `/pago`' + (modoEnvio() === 'bot' ? ' ou pelo botão' : ''))

  const m = mencoes()
  let content = `${m.texto}\n${blocos.join('\n\n')}\n\n-# ${legenda.join(' · ')}`
  if (content.length > 2000) content = content.slice(0, 1990) + '\n…'

  return {
    content,
    allowed_mentions: m.allowed,
    components: botoesPagamento(comBotao),
  }
}

// Botões "Paguei" (só funcionam em mensagem enviada pelo bot)
export function botoesPagamento(itens: ItemVencimento[]): unknown[] {
  const unicos = new Map<string, ItemVencimento>()
  for (const it of itens) unicos.set(`${it.conta.id}:${it.anoRef}:${it.mesRef}`, it)
  const botoes = [...unicos.entries()].slice(0, MAX_BOTOES).map(([chave, it]) => ({
    type: 2, style: 3,
    custom_id: `pagar:${chave}`,
    label: `Paguei · ${it.conta.nome} ${ddmm(it.vencimento)}`.slice(0, 80),
  }))
  const linhas = []
  for (let i = 0; i < botoes.length; i += 5) linhas.push({ type: 1, components: botoes.slice(i, i + 5) })
  return linhas
}

// Definição dos comandos /pago e /pendentes: scripts/discord-comandos.mjs
