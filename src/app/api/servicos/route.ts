export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

// Lista de serviços da tabela de preços do AVEC (configuracoes/tabela_precos).
// Usada pela mc_extension (Finalização no WhatsApp) para autocompletar o serviço.
// Sem autenticação: a extensão não tem o login do mc_control e só expomos nome + preço.
export async function GET() {
  try {
    const snap = await adminDb.collection('configuracoes').doc('tabela_precos').get()
    const servicos = (snap.data()?.servicos ?? {}) as Record<string, number>
    const lista = Object.entries(servicos)
      .map(([nome, preco]) => ({ nome, preco }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return NextResponse.json(
      { servicos: lista, atualizadoEm: snap.data()?.atualizadoEm?.toDate?.() ?? null },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    )
  } catch (err) {
    console.error('[api/servicos]', err)
    return NextResponse.json({ error: 'Falha ao carregar serviços' }, { status: 500 })
  }
}
