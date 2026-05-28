'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, deleteDoc, getDocs, Timestamp,
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

  // ID do documento = "YYYY-MM" derivado do início do período
  // Garante que re-importar o mesmo mês sobrescreve em vez de criar duplicata
  const salvar = useCallback(async (data: Omit<Comissoes, 'id'>) => {
    const mesKey = data.periodoInicio.slice(0, 7) // "2026-05"
    await setDoc(doc(db, 'comissoes', mesKey), {
      ...data,
      uploadEm: Timestamp.now(),
    })
  }, [])

  // Remove todos os documentos antigos (IDs no formato "inicio_fim") e duplicatas por mês,
  // mantendo apenas o registro mais recente por mês com o novo ID "YYYY-MM"
  const limparDuplicatas = useCallback(async () => {
    const snap = await getDocs(collection(db, 'comissoes'))
    const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Comissoes, 'id'>) }))

    // Agrupa por mês
    const porMes: Record<string, typeof docs> = {}
    for (const d of docs) {
      const mes = d.periodoInicio?.slice(0, 7) ?? d.id.slice(0, 7)
      if (!porMes[mes]) porMes[mes] = []
      porMes[mes].push(d)
    }

    const deletes: Promise<void>[] = []
    const saves: Promise<void>[]   = []

    for (const [mes, registros] of Object.entries(porMes)) {
      // Ordena pelo uploadEm mais recente
      registros.sort((a, b) => {
        const ta = (a.uploadEm as Timestamp)?.toMillis?.() ?? 0
        const tb = (b.uploadEm as Timestamp)?.toMillis?.() ?? 0
        return tb - ta
      })

      const [keeper, ...rest] = registros

      // Deleta os duplicados
      for (const r of rest) deletes.push(deleteDoc(doc(db, 'comissoes', r.id)))

      // Se o keeper não tem o ID no novo formato, recria com o ID correto e apaga o antigo
      if (keeper.id !== mes) {
        const { id, ...data } = keeper
        saves.push(setDoc(doc(db, 'comissoes', mes), data))
        deletes.push(deleteDoc(doc(db, 'comissoes', id)))
      }
    }

    await Promise.all([...deletes, ...saves])
  }, [])

  return { comissoes, atual, anterior, loading, salvar, limparDuplicatas }
}
