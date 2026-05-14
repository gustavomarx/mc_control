'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, updateDoc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CaixaFormas } from '@/types'

export function useCaixa() {
  const [registros, setRegistros] = useState<CaixaFormas[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'caixa_formas'), orderBy('uploadEm', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() } as CaixaFormas)))
      setLoading(false)
    })
    return unsub
  }, [])

  const atual = registros[0] ?? null
  const anterior = registros[1] ?? null

  const salvar = useCallback(async (data: Omit<CaixaFormas, 'id'>) => {
    await setDoc(doc(db, 'caixa_formas', data.periodoKey), {
      ...data,
      uploadEm: Timestamp.now(),
    })
  }, [])

  const marcarDepositado = useCallback(async (periodoKey: string) => {
    await updateDoc(doc(db, 'caixa_formas', periodoKey), {
      dinheiroDepositado: true,
      dinheiroDepositadoEm: Timestamp.now(),
    })
  }, [])

  return { registros, atual, anterior, loading, salvar, marcarDepositado }
}
