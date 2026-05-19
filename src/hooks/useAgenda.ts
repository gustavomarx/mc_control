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

export interface TabelaInfo {
  servicos: Record<string, number>   // nome → valor
  totalServicos: number
  atualizadoEm: Timestamp | null
}

export function useAgenda() {
  const [historico, setHistorico]       = useState<AgendaAvec[]>([])
  const [metaSemanal, setMetaSemanal]   = useState(30)
  const [tabela, setTabela]             = useState<TabelaInfo>({
    servicos: {}, totalServicos: 0, atualizadoEm: null,
  })
  const [loading, setLoading]           = useState(true)
  const [loadingTabela, setLoadingTabela] = useState(true)

  // ── Agenda semanal ──────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'agenda_avec'), orderBy('uploadEm', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() } as AgendaAvec)))
      setLoading(false)
    })
    return unsub
  }, [])

  // ── Meta semanal ────────────────────────────────────────────
  useEffect(() => {
    getDoc(doc(db, 'configuracoes', 'agenda_meta')).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as MetaAgenda
        setMetaSemanal(data.metaSemanal)
      }
    })
  }, [])

  // ── Tabela de preços ────────────────────────────────────────
  useEffect(() => {
    getDoc(doc(db, 'configuracoes', 'tabela_precos')).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        setTabela({
          servicos:      data.servicos ?? {},
          totalServicos: data.totalServicos ?? 0,
          atualizadoEm:  data.atualizadoEm ?? null,
        })
      }
      setLoadingTabela(false)
    })
  }, [])

  // ── Agenda atual ────────────────────────────────────────────
  const agendaAtual = (() => {
    const hoje = new Date()
    const dow  = hoje.getDay()
    const diff = dow === 0 ? -6 : 1 - dow
    const seg  = new Date(hoje)
    seg.setDate(hoje.getDate() + diff)
    seg.setHours(0, 0, 0, 0)
    const y = seg.getFullYear()
    const m = String(seg.getMonth() + 1).padStart(2, '0')
    const d = String(seg.getDate()).padStart(2, '0')
    const chaveHoje = `${y}-${m}-${d}`
    return historico.find(h => h.semanaKey === chaveHoje) ?? historico[0] ?? null
  })()

  // ── Saves ───────────────────────────────────────────────────
  const salvarAgenda = useCallback(async (agendas: AgendaAvec | AgendaAvec[]) => {
    const lista = Array.isArray(agendas) ? agendas : [agendas]
    await Promise.all(lista.map(a => setDoc(doc(db, 'agenda_avec', a.semanaKey), a)))
  }, [])

  const salvarMeta = useCallback(async (meta: number, semanaKey: string) => {
    await setDoc(doc(db, 'configuracoes', 'agenda_meta'), {
      metaSemanal: meta,
      semanaKey,
      atualizadoEm: Timestamp.now(),
    })
    setMetaSemanal(meta)
  }, [])

  const salvarTabelaPrecos = useCallback(async (servicos: Record<string, number>) => {
    const agora = Timestamp.now()
    await setDoc(doc(db, 'configuracoes', 'tabela_precos'), {
      servicos,
      totalServicos: Object.keys(servicos).length,
      atualizadoEm:  agora,
    })
    setTabela({ servicos, totalServicos: Object.keys(servicos).length, atualizadoEm: agora })
  }, [])

  return {
    agendaAtual, historico, metaSemanal, loading,
    tabela, loadingTabela,
    salvarAgenda, salvarMeta, salvarTabelaPrecos,
  }
}
