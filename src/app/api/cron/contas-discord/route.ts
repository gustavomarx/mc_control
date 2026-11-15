export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { carregarContasAtivas } from '@/lib/contas-pagar-server'
import {
  hojeSaoPaulo, janelaSemana, janelaVespera, vencimentosEntre, atrasadas, diaSemana, chaveDia,
  dia,
} from '@/lib/contas-vencimentos'
import { montarAviso, enviarMensagem, modoEnvio, type DadosAviso } from '@/lib/discord'

// Aviso diário de contas a pagar no Discord. Disparado pelo cron da Vercel às 8h (11:00 UTC).
//   - Segunda: contas da semana (seg–dom) + o que ficou em aberto de datas anteriores
//   - Dia útil: o que vence amanhã (na véspera de fim de semana/feriado, até o próximo dia útil)
//
// Autorização: header "Authorization: Bearer $CRON_SECRET" (a Vercel envia sozinha).
// Parâmetros de teste: ?data=AAAA-MM-DD (simula o dia) · ?dry=1 (só mostra, não envia)
//                      · ?forcar=1 (envia mesmo se já enviou hoje)
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const dry = sp.get('dry') === '1'
  const forcar = sp.get('forcar') === '1'
  const dataParam = sp.get('data')
  const hoje = dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam)
    ? dia(...(dataParam.split('-').map(Number) as [number, number, number]))
    : hojeSaoPaulo()
  const chave = chaveDia(hoje)

  try {
    const controleRef = adminDb.collection('configuracoes').doc('discord_contas')
    if (!dry && !forcar && !dataParam) {
      const controle = await controleRef.get()
      if (controle.data()?.ultimoAviso === chave) {
        return NextResponse.json({ ok: true, enviado: false, motivo: `Aviso de ${chave} já enviado` })
      }
    }

    const contas = await carregarContasAtivas()
    const dados: DadosAviso = { hoje }

    if (diaSemana(hoje) === 1) {
      const sem = janelaSemana(hoje)
      dados.semana = { ...sem, itens: vencimentosEntre(contas, sem.de, sem.ate) }
      dados.atrasadas = atrasadas(contas, hoje)
    }
    const vesp = janelaVespera(hoje)
    if (vesp) {
      const itens = vencimentosEntre(contas, vesp.de, vesp.ate)
      if (itens.length) dados.vespera = { ...vesp, itens }
    }

    const msg = montarAviso(dados)
    if (!msg) {
      return NextResponse.json({ ok: true, enviado: false, data: chave, motivo: 'Nada a avisar hoje' })
    }
    if (dry) {
      return NextResponse.json({ ok: true, enviado: false, dry: true, data: chave, modo: modoEnvio(), mensagem: msg })
    }

    await enviarMensagem(msg)
    if (!dataParam) await controleRef.set({ ultimoAviso: chave, ultimoAvisoEm: new Date() }, { merge: true })
    return NextResponse.json({ ok: true, enviado: true, data: chave, modo: modoEnvio() })
  } catch (err) {
    console.error('[cron/contas-discord]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
