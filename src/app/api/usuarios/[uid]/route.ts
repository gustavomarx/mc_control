import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { getAuth } from 'firebase-admin/auth'
import type { PerfilUsuario, PermissoesUsuario } from '@/types'

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const admin = await getRequisitante(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { uid } = await params
  const body = await req.json() as { nome?: string; perfil?: PerfilUsuario; ativo?: boolean; permissoes?: PermissoesUsuario }

  try {
    await adminDb.collection('usuarios').doc(uid).update(body)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const admin = await getRequisitante(req)
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { uid } = await params

  if (uid === admin.uid) {
    return NextResponse.json({ error: 'Não é possível desativar o próprio usuário' }, { status: 400 })
  }

  try {
    await adminDb.collection('usuarios').doc(uid).update({ ativo: false })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao desativar'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
