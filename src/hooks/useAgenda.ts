'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, getDoc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AgendaAvec } from '@/types'

interface MetaAgenda {
  metaSemanal: number
  semanaKey: string
}

export function useAgenda() {
  const [historico, setHistorico] = useState<AgendaAvec[]>([])
  const [metaSemanal, setMetaSemanal] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'agenda_avec'), orderBy('uploadEm', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() } as AgendaAvec)))
      setLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    getDoc(doc(db, 'configuracoes', 'agenda_meta')).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as MetaAgenda
        setMetaSemanal(data.metaSemanal)
      }
    })
  }, [])

  const agendaAtual = historico[0] ?? null

  const salvarAgenda = useCallback(async (agenda: Omit<AgendaAvec, 'id'>) => {
    await setDoc(doc(db, 'agenda_avec', agenda.semanaKey), agenda)
  }, [])

  const salvarMeta = useCallback(async (meta: number, semanaKey: string) => {
    await setDoc(doc(db, 'configuracoes', 'agenda_meta'), {
      metaSemanal: meta,
      semanaKey,
      atualizadoEm: Timestamp.now(),
    })
    setMetaSemanal(meta)
  }, [])

  return { agendaAtual, historico, metaSemanal, loading, salvarAgenda, salvarMeta }
}
