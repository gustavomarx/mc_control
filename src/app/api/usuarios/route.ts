import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { getAuth } from 'firebase-admin/auth'
import { Timestamp } from 'firebase-admin/firestore'
import type { PerfilUsuario } from '@/types'
import { PERMISSOES_PADRAO } from '@/types'

async function getRequisitante(req: NextRequest) {
  const token = req.cookies.get('firebase-token')?.value
  if (!token) return null
  try {
    const decoded = await getAuth().verifyIdToken(token)
    const snap = await adminDb.collection('usuarios').doc(decoded.uid).get()
    if (!snap.exists) return null
    const data = snap.data()!
    if (data.perfil !== 'admin' || data.ativo === false) return null
    return decoded
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const admin = await getRequisitante(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { nome, email, senha, perfil } = await req.json() as {
    nome: string
    email: string
    senha: string
    perfil: PerfilUsuario
  }

  if (!nome || !email || !senha || !perfil) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  try {
    const userRecord = await getAuth().createUser({ email, password: senha, displayName: nome })

    await adminDb.collection('usuarios').doc(userRecord.uid).set({
      uid: userRecord.uid,
      nome,
      email,
      perfil,
      ativo: true,
      permissoes: PERMISSOES_PADRAO,
      criadoEm: Timestamp.now(),
      criadoPor: admin.uid,
    })

    await getAuth().generatePasswordResetLink(email)

    return NextResponse.json({ uid: userRecord.uid }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao criar usuário'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
