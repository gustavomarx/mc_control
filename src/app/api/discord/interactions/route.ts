export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { carregarContasAtivas, emAberto, registrarPagamento } from '@/lib/contas-pagar-server'
import {
  type ItemVencimento, hojeSaoPaulo, somarDias, ddmm, formatBRL, parseValorBR, vencimentosEntre,
  atrasadas,
} from '@/lib/contas-vencimentos'
import {
  assinaturaValida, usuarioAutorizado, nomeUsuario, linhaItem, type UsuarioDiscord,
} from '@/lib/discord'

// Endpoint de interações do Discord ("Interactions Endpoint URL" do app).
//   /pago conta:<autocomplete> [valor]  → registra pagamento
//   /pendentes                          → lista o que está em aberto
//   botão "Paguei"                      → abre formulário com o valor já preenchido

const EPHEMERAL = 64

type Opcao = { name: string; value?: string | number; focused?: boolean }
interface Interacao {
  type: number
  data?: {
    name?: string
    options?: Opcao[]
    custom_id?: string
    components?: Array<{ components: Array<{ custom_id: string; value: string }> }>
  }
  member?: { user: UsuarioDiscord }
  user?: UsuarioDiscord
}

function responder(content: string, privado = false) {
  return NextResponse.json({
    type: 4,
    data: { content, flags: privado ? EPHEMERAL : 0, allowed_mentions: { parse: [] } },
  })
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function chaveItem(it: ItemVencimento): string {
  return `${it.conta.id}|${it.anoRef}|${it.mesRef}`
}

function rotuloEscolha(it: ItemVencimento, hoje: Date): string {
  const valor = it.restante == null ? 'informe o valor' : `${it.estimado ? '≈ ' : ''}${formatBRL(it.restante)}`
  const atraso = it.vencimento < hoje ? ' · ATRASADA' : ''
  return `${it.conta.nome} · venc ${ddmm(it.vencimento)}/${it.anoRef} · ${valor}${atraso}`.slice(0, 100)
}

export async function POST(req: NextRequest) {
  const corpo = await req.text()
  if (!assinaturaValida(corpo, req.headers.get('x-signature-ed25519'), req.headers.get('x-signature-timestamp'))) {
    return new NextResponse('assinatura inválida', { status: 401 })
  }

  const i = JSON.parse(corpo) as Interacao
  if (i.type === 1) return NextResponse.json({ type: 1 }) // PING

  const usuario = i.member?.user ?? i.user
  const hoje = hojeSaoPaulo()

  try {
    // Autocomplete do /pago
    if (i.type === 4) {
      if (!usuarioAutorizado(usuario)) return NextResponse.json({ type: 8, data: { choices: [] } })
      const digitado = normalizar(String(i.data?.options?.find(o => o.focused)?.value ?? ''))
      const itens = emAberto(await carregarContasAtivas(), hoje)
      const filtrados = itens.filter(it =>
        !digitado || digitado.split(/\s+/).every(p =>
          normalizar(`${it.conta.nome} ${it.conta.fornecedor ?? ''}`).includes(p)))
      return NextResponse.json({
        type: 8,
        data: { choices: filtrados.slice(0, 25).map(it => ({ name: rotuloEscolha(it, hoje), value: chaveItem(it) })) },
      })
    }

    if (!usuarioAutorizado(usuario)) {
      return responder('🚫 Você não tem permissão para registrar pagamentos.', true)
    }
    const u = usuario!

    // Comandos
    if (i.type === 2 && i.data?.name === 'pendentes') {
      const contas = await carregarContasAtivas()
      const vencidas = atrasadas(contas, hoje)
      const proximas = vencimentosEntre(contas, hoje, somarDias(hoje, 7))
      const blocos: string[] = []
      if (vencidas.length) {
        blocos.push(`**🔴 Vencidas (${vencidas.length})**\n` + vencidas.map(x =>
          `\`${String(x.mesRef).padStart(2, '0')}/${x.anoRef}\` ${linhaItem(x, false)}`).join('\n'))
      }
      if (proximas.length) blocos.push(`**📅 Próximos 7 dias**\n` + proximas.map(x => linhaItem(x)).join('\n'))
      let txt = blocos.length ? blocos.join('\n\n') : 'Nada em aberto. 🎉'
      if (txt.length > 1990) txt = txt.slice(0, 1980) + '\n…'
      return responder(txt, true)
    }

    if (i.type === 2 && i.data?.name === 'pago') {
      const conta = String(i.data.options?.find(o => o.name === 'conta')?.value ?? '')
      const valorOpt = i.data.options?.find(o => o.name === 'valor')?.value
      const valor = typeof valorOpt === 'number' ? Math.round(valorOpt * 100) / 100 : null

      let alvo = conta.split('|')
      if (alvo.length !== 3) {
        // Texto digitado sem escolher da lista: tenta achar pelo nome (a mais antiga em aberto)
        const t = normalizar(conta)
        const achados = emAberto(await carregarContasAtivas(), hoje)
          .filter(it => normalizar(it.conta.nome).includes(t))
        const nomes = new Set(achados.map(it => it.conta.id))
        if (!achados.length) return responder(`Não achei conta em aberto com "${conta}". Escolha da lista ao digitar.`, true)
        if (nomes.size > 1) return responder(`"${conta}" bate com mais de uma conta. Escolha da lista ao digitar.`, true)
        alvo = chaveItem(achados[0]).split('|')
      }
      return await registrarEResponder(u, alvo[0], Number(alvo[1]), Number(alvo[2]), valor)
    }

    // Botão "Paguei" → formulário com o valor
    if (i.type === 3 && i.data?.custom_id?.startsWith('pagar:')) {
      const [, contaId, ano, mes] = i.data.custom_id.split(':')
      const item = emAberto(await carregarContasAtivas(), hoje)
        .find(it => it.conta.id === contaId && it.anoRef === Number(ano) && it.mesRef === Number(mes))
      if (!item) return responder('✅ Essa conta já está paga nesse mês.', true)
      return NextResponse.json({
        type: 9,
        data: {
          custom_id: `pagarmodal:${contaId}:${ano}:${mes}`,
          title: `Pagar ${item.conta.nome}`.slice(0, 45),
          components: [{
            type: 1,
            components: [{
              type: 4, custom_id: 'valor', style: 1, required: true, max_length: 20,
              label: item.estimado ? 'Valor pago (R$), confira o valor real' : 'Valor pago (R$)',
              value: item.restante != null ? item.restante.toFixed(2).replace('.', ',') : '',
              placeholder: 'ex.: 244,19',
            }],
          }],
        },
      })
    }

    // Envio do formulário
    if (i.type === 5 && i.data?.custom_id?.startsWith('pagarmodal:')) {
      const [, contaId, ano, mes] = i.data.custom_id.split(':')
      const txt = i.data.components?.[0]?.components?.[0]?.value ?? ''
      const valor = parseValorBR(txt)
      if (valor == null) return responder(`Valor inválido: "${txt}". Use, por exemplo, 244,19.`, true)
      return await registrarEResponder(u, contaId, Number(ano), Number(mes), valor)
    }

    return responder('Comando não reconhecido.', true)
  } catch (err) {
    console.error('[discord/interactions]', err)
    return responder('❌ Erro ao processar. Tente de novo ou registre pelo sistema.', true)
  }
}

async function registrarEResponder(u: UsuarioDiscord, contaId: string, ano: number, mes: number, valor: number | null) {
  const r = await registrarPagamento({
    contaId, ano, mes, valor,
    usuarioId: `discord:${u.username}`,
    usuarioNome: nomeUsuario(u),
  })
  if (!r.ok) return responder(`⚠️ ${r.motivo}`, true)
  if (r.duplicado) return responder('Esse pagamento já tinha sido registrado agora há pouco. Não dupliquei.', true)

  const ref = `${String(mes).padStart(2, '0')}/${ano}`
  let extra = ''
  if (r.previsto != null && r.conta?.tipo === 'variavel') {
    if (Math.abs(r.valorPago! - r.previsto) > 0.005) extra = ` · estimado era ${formatBRL(r.previsto)}`
  } else if (r.previsto != null) {
    const falta = Math.round((r.previsto - (r.totalPagoMes ?? 0)) * 100) / 100
    if (falta > 0.005) extra = ` · parcial, falta ${formatBRL(falta)}`
    else if (r.conta?.tipo === 'variavel' && Math.abs(r.valorPago! - r.previsto) > 0.005) {
      extra = ` · estimado era ${formatBRL(r.previsto)}`
    }
  }
  return responder(`✅ **${r.conta!.nome}** (${ref}) paga por ${nomeUsuario(u)}: **${formatBRL(r.valorPago!)}**${extra}`)
}
