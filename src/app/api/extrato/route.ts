import { NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { parseSicoob } from '@/lib/sicoob-parser'
import { adminDb } from '@/lib/firebase-admin'
import type { LancamentoParsed } from '@/lib/sicoob-parser'

// Cache em memória para a duração da instância serverless (evita chamadas repetidas no mesmo upload)
const memoriaCache = new Map<string, string | null>()

async function buscarNomeEmpresaComCache(cnpj: string): Promise<string | null> {
  const digits = cnpj.replace(/\D/g, '')

  // 1. Cache em memória (instância atual)
  if (memoriaCache.has(digits)) return memoriaCache.get(digits)!

  // 2. Cache no Firestore (persiste entre instâncias e deploys)
  if (!adminDb) return await buscarNaBrasilAPI(digits)
  const docRef = adminDb.collection('cnpj_cache').doc(digits)
  const snap = await docRef.get()
  if (snap.exists) {
    const nome = snap.data()?.nome ?? null
    memoriaCache.set(digits, nome)
    return nome
  }

  // 3. Busca na BrasilAPI
  const nome = await buscarNaBrasilAPI(digits)

  // Salva no Firestore independente do resultado (null = não encontrado, não tenta de novo)
  await docRef.set({ nome, cnpj, consultadoEm: new Date().toISOString() })
  memoriaCache.set(digits, nome)
  return nome
}

async function buscarNaBrasilAPI(digits: string): Promise<string | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': 'https://brasilapi.com.br/',
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.nome_fantasia?.trim() || data.razao_social?.trim()) || null
  } catch {
    return null
  }
}

async function enriquecerComCNPJ(lancamentos: LancamentoParsed[]): Promise<LancamentoParsed[]> {
  const cnpjsUnicos = new Set(lancamentos.map(l => l.cnpj).filter(Boolean) as string[])
  if (cnpjsUnicos.size === 0) return lancamentos

  const nomes = new Map<string, string | null>()
  await Promise.all(
    [...cnpjsUnicos].map(async cnpj => {
      nomes.set(cnpj, await buscarNomeEmpresaComCache(cnpj))
    }),
  )

  return lancamentos.map(l => {
    if (!l.cnpj) return l
    const nome = nomes.get(l.cnpj)
    return nome ? { ...l, nomeEmpresa: nome } : l
  })
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const textResult = await parser.getText({ cellSeparator: '  ', pageJoiner: '\n' })
    await parser.destroy()

    const resultado = parseSicoob(textResult.text)
    resultado.lancamentos = await enriquecerComCNPJ(resultado.lancamentos)

    return NextResponse.json(resultado)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/extrato]', msg)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? msg : 'Falha ao processar o PDF. Verifique se é um extrato Sicoob válido.' },
      { status: 500 },
    )
  }
}
