'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, Timestamp, deleteField,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ContaPagar, HistoricoPagamento } from '@/types'

export function useContasPagar() {
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'contas_pagar'),
      where('ativa', '==', true),
      orderBy('diaVencimento', 'asc'),
    )
    const unsub = onSnapshot(q, snap => {
      setContas(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContaPagar)))
      setLoading(false)
    })
    return unsub
  }, [])

  const adicionar = useCallback(async (data: Omit<ContaPagar, 'id' | 'criadoEm' | 'historicoPagamentos'>) => {
    await addDoc(collection(db, 'contas_pagar'), {
      ...data,
      historicoPagamentos: [],
      criadoEm: Timestamp.now(),
    })
  }, [])

  const atualizar = useCallback(async (id: string, data: Partial<ContaPagar>) => {
    // Se mesAnual não está no payload, remove o campo do documento
    const update: Record<string, unknown> = { ...data }
    if (!('mesAnual' in data)) update.mesAnual = deleteField()
    await updateDoc(doc(db, 'contas_pagar', id), update)
  }, [])

  const excluir = useCallback(async (id: string) => {
    await updateDoc(doc(db, 'contas_pagar', id), { ativa: false })
  }, [])

  const marcarPago = useCallback(async (
    conta: ContaPagar,
    valorPago: number,
    usuarioId: string,
    mesRef: number,
    anoRef: number,
  ) => {
    const pagamento: HistoricoPagamento = {
      data: Timestamp.now(),
      valorPago,
      pagoEm: Timestamp.now(),
      mesRef,
      anoRef,
      usuarioId,
    }
    await updateDoc(doc(db, 'contas_pagar', conta.id), {
      historicoPagamentos: [...(conta.historicoPagamentos ?? []), pagamento],
    })
  }, [])

  return { contas, loading, adicionar, atualizar, excluir, marcarPago }
}
