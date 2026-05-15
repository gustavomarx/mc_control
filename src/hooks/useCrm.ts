'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, onSnapshot, doc, setDoc, updateDoc, Timestamp, getDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AniversarianteStatus, RecuperacaoStatus, StatusAniversariante, StatusRecuperacao } from '@/types'
import { parseAniversariantes } from '@/lib/parse-aniversariantes'
import { parseAgenda0051 } from '@/lib/parse-agenda-cross'

interface UploadInfo {
  uploadEm: Timestamp
  totalClientes: number
}

export function useCrm() {
  const [aniversariantes, setAniversariantes] = useState<AniversarianteStatus[]>([])
  const [clientes, setClientes] = useState<RecuperacaoStatus[]>([])
  const [uploadInfoAniv, setUploadInfoAniv] = useState<UploadInfo | null>(null)
  const [uploadInfo0051, setUploadInfo0051] = useState<UploadInfo | null>(null)
  const [loadingAniv, setLoadingAniv] = useState(true)
  const [loadingRec, setLoadingRec] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'aniversariantes_status'), snap => {
      setAniversariantes(snap.docs.map(d => ({ id: d.id, ...d.data() } as AniversarianteStatus)))
      setLoadingAniv(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'recuperacao_status'), snap => {
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() } as RecuperacaoStatus)))
      setLoadingRec(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    getDoc(doc(db, 'configuracoes', 'aniversariantes_upload')).then(snap => {
      if (snap.exists()) setUploadInfoAniv(snap.data() as UploadInfo)
    })
    getDoc(doc(db, 'configuracoes', 'agenda_0051_upload')).then(snap => {
      if (snap.exists()) setUploadInfo0051(snap.data() as UploadInfo)
    })
  }, [])

  const uploadAgenda0051 = useCallback(async (file: File) => {
    const { recuperacao } = await parseAgenda0051(file)
    const agora = Timestamp.now()

    await Promise.all(
      recuperacao.map(c =>
        setDoc(doc(db, 'recuperacao_status', c.id), {
          ...c,
          status: 'nao_contatada',
          atualizadoEm: agora,
        }, { merge: true })
      )
    )

    const info: UploadInfo = { uploadEm: agora, totalClientes: recuperacao.length }
    await setDoc(doc(db, 'configuracoes', 'agenda_0051_upload'), info)
    setUploadInfo0051(info)
  }, [])

  const uploadAniversariantes = useCallback(async (file: File) => {
    const { clientes, total } = await parseAniversariantes(file)
    const agora = Timestamp.now()

    await Promise.all(
      clientes.map(c =>
        setDoc(doc(db, 'aniversariantes_status', c.id), {
          ...c,
          status: 'nao_contatada',
          atualizadoEm: agora,
        }, { merge: true })  // preserva status existente se já cadastrado
      )
    )

    const info: UploadInfo = { uploadEm: agora, totalClientes: total }
    await setDoc(doc(db, 'configuracoes', 'aniversariantes_upload'), info)
    setUploadInfoAniv(info)
  }, [])


  const atualizarStatusAniv = useCallback(async (celular: string, status: StatusAniversariante) => {
    await updateDoc(doc(db, 'aniversariantes_status', celular), {
      status,
      atualizadoEm: Timestamp.now(),
    })
  }, [])

  const atualizarStatusRec = useCallback(async (celular: string, status: StatusRecuperacao) => {
    await updateDoc(doc(db, 'recuperacao_status', celular), {
      status,
      atualizadoEm: Timestamp.now(),
    })
  }, [])

  return {
    aniversariantes,
    clientes,
    loadingAniv,
    loadingRec,
    uploadInfoAniv,
    uploadInfo0051,
    uploadAniversariantes,
    uploadAgenda0051,
    atualizarStatusAniv,
    atualizarStatusRec,
  }
}
