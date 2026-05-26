'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, Timestamp, getDoc, getDocs,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AniversarianteStatus, RecuperacaoStatus, StatusAniversariante, StatusRecuperacao, MensagemTemplate } from '@/types'
import { parseAniversariantes } from '@/lib/parse-aniversariantes'
import { parseAgenda0051 } from '@/lib/parse-agenda-cross'

interface CrmConfig {
  templateAnivId: string
  templateRecId: string
}

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
  const [templates, setTemplates] = useState<MensagemTemplate[]>([])
  const [templateAnivId, setTemplateAnivId] = useState('')
  const [templateRecId, setTemplateRecId] = useState('')

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
    getDoc(doc(db, 'configuracoes', 'crm_config')).then(snap => {
      if (snap.exists()) {
        const cfg = snap.data() as CrmConfig
        setTemplateAnivId(cfg.templateAnivId ?? '')
        setTemplateRecId(cfg.templateRecId ?? '')
      }
    })
    getDocs(collection(db, 'mensagens_templates')).then(snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as MensagemTemplate)).filter(t => t.ativo))
    })
  }, [])

  const uploadAgenda0051 = useCallback(async (file: File) => {
    const { recuperacao } = await parseAgenda0051(file)
    const agora = Timestamp.now()
    const novosIds = new Set(recuperacao.map(c => c.id))

    // Busca docs existentes para deletar quem saiu da lista (agendou ou não precisa mais)
    const existentes = await getDocs(collection(db, 'recuperacao_status'))
    await Promise.all(
      existentes.docs
        .filter(d => !novosIds.has(d.id))
        .map(d => deleteDoc(d.ref))
    )

    // Adiciona/atualiza quem está na nova lista
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


  const salvarConfigTemplate = useCallback(async (tipo: 'aniversario' | 'recuperacao', templateId: string) => {
    if (tipo === 'aniversario') setTemplateAnivId(templateId)
    else setTemplateRecId(templateId)

    const snap = await getDoc(doc(db, 'configuracoes', 'crm_config'))
    const atual = snap.exists() ? (snap.data() as CrmConfig) : { templateAnivId: '', templateRecId: '' }
    await setDoc(doc(db, 'configuracoes', 'crm_config'), {
      ...atual,
      [tipo === 'aniversario' ? 'templateAnivId' : 'templateRecId']: templateId,
    })
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

  const atualizarObservacaoRec = useCallback(async (celular: string, observacao: string) => {
    await updateDoc(doc(db, 'recuperacao_status', celular), { observacao })
  }, [])

  const excluirClienteRec = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'recuperacao_status', id))
  }, [])

  return {
    aniversariantes,
    clientes,
    loadingAniv,
    loadingRec,
    uploadInfoAniv,
    uploadInfo0051,
    templates,
    templateAnivId,
    templateRecId,
    uploadAniversariantes,
    uploadAgenda0051,
    atualizarStatusAniv,
    atualizarStatusRec,
    atualizarObservacaoRec,
    excluirClienteRec,
    salvarConfigTemplate,
  }
}
