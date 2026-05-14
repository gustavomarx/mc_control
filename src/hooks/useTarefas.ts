'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Tarefa, RecorrenciaTarefa } from '@/types'

function calcularProximaData(dataEntrega: Date, recorrencia: RecorrenciaTarefa, recorrenciaDia?: number): Date {
  const proxima = new Date(dataEntrega)

  if (recorrencia === 'diaria') {
    proxima.setDate(proxima.getDate() + 1)
    return proxima
  }

  if (recorrencia === 'semanal' && recorrenciaDia !== undefined) {
    const hoje = new Date()
    const diasAte = (recorrenciaDia - hoje.getDay() + 7) % 7 || 7
    proxima.setTime(hoje.getTime())
    proxima.setDate(hoje.getDate() + diasAte)
    return proxima
  }

  if (recorrencia === 'quinzenal') {
    proxima.setDate(proxima.getDate() + 15)
    return proxima
  }

  if (recorrencia === 'mensal') {
    const dia = recorrenciaDia ?? dataEntrega.getDate()
    proxima.setMonth(proxima.getMonth() + 1)
    proxima.setDate(dia)
    return proxima
  }

  return proxima
}

export function useTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'tarefas'),
      orderBy('dataEntrega', 'asc'),
    )
    const unsub = onSnapshot(q, snap => {
      setTarefas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tarefa)))
      setLoading(false)
    })
    return unsub
  }, [])

  const adicionar = useCallback(async (
    data: Omit<Tarefa, 'id' | 'criadaEm' | 'atualizadaEm' | 'historico_conclusoes' | 'concluida'>
  ) => {
    await addDoc(collection(db, 'tarefas'), {
      ...data,
      concluida: false,
      historico_conclusoes: [],
      criadaEm: Timestamp.now(),
      atualizadaEm: Timestamp.now(),
    })
  }, [])

  const atualizar = useCallback(async (id: string, data: Partial<Tarefa>) => {
    await updateDoc(doc(db, 'tarefas', id), {
      ...data,
      atualizadaEm: Timestamp.now(),
    })
  }, [])

  const excluir = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'tarefas', id))
  }, [])

  const concluir = useCallback(async (tarefa: Tarefa) => {
    const agora = Timestamp.now()
    const conclusao = { concluidaEm: agora }

    await updateDoc(doc(db, 'tarefas', tarefa.id), {
      concluida: true,
      concluidaEm: agora,
      historico_conclusoes: [...tarefa.historico_conclusoes, conclusao],
      atualizadaEm: agora,
    })

    if (tarefa.recorrencia !== 'unica') {
      const dataEntrega = tarefa.dataEntrega.toDate()
      const proximaData = calcularProximaData(dataEntrega, tarefa.recorrencia, tarefa.recorrenciaDia)

      const { id: _id, criadaEm: _c, concluidaEm: _ce, ...base } = tarefa as Tarefa & { [key: string]: unknown }
      void _id; void _c; void _ce

      await addDoc(collection(db, 'tarefas'), {
        ...base,
        concluida: false,
        historico_conclusoes: [],
        dataEntrega: Timestamp.fromDate(proximaData),
        criadaEm: agora,
        atualizadaEm: agora,
      })
    }
  }, [])

  const reabrirTarefa = useCallback(async (id: string) => {
    await updateDoc(doc(db, 'tarefas', id), {
      concluida: false,
      concluidaEm: null,
      atualizadaEm: Timestamp.now(),
    })
  }, [])

  return { tarefas, loading, adicionar, atualizar, excluir, concluir, reabrirTarefa }
}
