'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Comissoes } from '@/types'

export function useComissoes() {
  const [comissoes, setComissoes] = useState<Comissoes[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'comissoes'), orderBy('uploadEm', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setComissoes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comissoes)))
      setLoading(false)
    })
    return unsub
  }, [])

  const atual = comissoes[0] ?? null
  const anterior = comissoes[1] ?? null

  const salvar = useCallback(async (data: Omit<Comissoes, 'id'>) => {
    await setDoc(doc(db, 'comissoes', data.periodoKey), {
      ...data,
      uploadEm: Timestamp.now(),
    })
  }, [])

  return { comissoes, atual, anterior, loading, salvar }
}
