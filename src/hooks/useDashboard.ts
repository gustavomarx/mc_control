'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { statusPagamento, contaAparece, mesAtual } from '@/lib/utils'
import type { ContaPagar, Configuracoes } from '@/types'

// Chave da semana atual: "YYYY-MM-DD" da segunda-feira
function chaveSemana(): string {
  const hoje = new Date()
  const dow = hoje.getDay()
  const diffSeg = dow === 0 ? -6 : 1 - dow
  const seg = new Date(hoje)
  seg.setDate(hoje.getDate() + diffSeg)
  return seg.toISOString().slice(0, 10)
}

// Janela: seg da semana passada → dom da semana atual (14 dias)
function janelaContas(contas: ContaPagar[]): Array<{ conta: ContaPagar; vencimento: Date }> {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dow = hoje.getDay()
  const diffSeg = dow === 0 ? -6 : 1 - dow
  const segundaAtual = new Date(hoje); segundaAtual.setDate(hoje.getDate() + diffSeg)
  const segundaPassada = new Date(segundaAtual); segundaPassada.setDate(segundaAtual.getDate() - 7)
  const domingoAtual = new Date(segundaAtual); domingoAtual.setDate(segundaAtual.getDate() + 6); domingoAtual.setHours(23, 59, 59, 999)

  const result: Array<{ conta: ContaPagar; vencimento: Date }> = []
  const seen = new Set<string>()

  for (const conta of contas) {
    if (!conta.ativa || !conta.diaVencimento) continue
    for (let delta = -2; delta <= 1; delta++) {
      const ref = new Date(hoje); ref.setMonth(ref.getMonth() + delta)
      const venc = new Date(ref.getFullYear(), ref.getMonth(), conta.diaVencimento)
      const key = `${conta.id}-${venc.toISOString().slice(0, 10)}`
      if (venc >= segundaPassada && venc <= domingoAtual && !seen.has(key) && contaAparece(conta, venc.getMonth() + 1, venc.getFullYear())) {
        seen.add(key)
        result.push({ conta, vencimento: venc })
      }
    }
  }
  return result.sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())
}

export function useDashboard() {
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [loadingContas, setLoadingContas] = useState(true)
  const [saldoPJ, setSaldoPJState] = useState<number>(0)
  const [loadingSaldo, setLoadingSaldo] = useState(true)
  const [config, setConfig] = useState<Configuracoes | null>(null)
  const [prioridades, setPrioridades] = useState<Set<string>>(new Set())
  const [loadingPrioridades, setLoadingPrioridades] = useState(true)

  const { mes, ano } = mesAtual()
  const semanaKey = chaveSemana()

  // Contas a pagar (realtime)
  useEffect(() => {
    const q = query(
      collection(db, 'contas_pagar'),
      where('ativa', '==', true),
      orderBy('diaVencimento', 'asc'),
    )
    return onSnapshot(q, snap => {
      setContas(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContaPagar)))
      setLoadingContas(false)
    })
  }, [])

  // Saldo PJ
  useEffect(() => {
    getDoc(doc(db, 'configuracoes', 'saldo')).then(snap => {
      if (snap.exists()) setSaldoPJState(snap.data().valorAtual ?? 0)
      setLoadingSaldo(false)
    })
  }, [])

  // Configurações
  useEffect(() => {
    getDoc(doc(db, 'configuracoes', 'parametros')).then(snap => {
      if (snap.exists()) setConfig(snap.data() as Configuracoes)
    })
  }, [])

  // Prioridades da semana — reseta automaticamente em semana nova
  useEffect(() => {
    getDoc(doc(db, 'configuracoes', 'planejamento_semana')).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        // Semana diferente → ignora prioridades antigas
        if (data.semanaKey === semanaKey) {
          setPrioridades(new Set(data.prioridades ?? []))
        }
      }
      setLoadingPrioridades(false)
    })
  }, [semanaKey])

  async function salvarSaldoPJ(valor: number) {
    setSaldoPJState(valor)
    await setDoc(doc(db, 'configuracoes', 'saldo'), { valorAtual: valor }, { merge: true })
  }

  const togglePrioridade = useCallback(async (contaId: string) => {
    setPrioridades(prev => {
      const next = new Set(prev)
      if (next.has(contaId)) next.delete(contaId)
      else next.add(contaId)
      // Salva no Firestore (fire-and-forget)
      setDoc(doc(db, 'configuracoes', 'planejamento_semana'), {
        semanaKey,
        prioridades: [...next],
      })
      return next
    })
  }, [semanaKey])

  const janela = useMemo(() => janelaContas(contas), [contas])

  const totaisJanela = useMemo(() => {
    const pendentes = janela.filter(({ conta, vencimento }) =>
      statusPagamento(conta, vencimento.getMonth() + 1, vencimento.getFullYear()) !== 'pago'
    )
    const priorizadas = pendentes.filter(({ conta }) => prioridades.has(conta.id))
    return {
      total: janela.reduce((s, { conta }) => s + (conta.valor ?? 0), 0),
      pendente: pendentes.reduce((s, { conta }) => s + (conta.valor ?? 0), 0),
      priorizado: priorizadas.reduce((s, { conta }) => s + (conta.valor ?? 0), 0),
      qTotal: janela.length,
      qPendente: pendentes.length,
      qPriorizado: priorizadas.length,
    }
  }, [janela, prioridades])

  const totaisMes = useMemo(() => {
    const contasMes = contas.filter(c => contaAparece(c, mes, ano))
    const fixas = contasMes.filter(c => (c.tipo ?? 'fixo') === 'fixo')
    return {
      custoFixo: fixas.reduce((s, c) => s + (c.valor ?? 0), 0),
      totalMes: contasMes.reduce((s, c) => s + (c.valor ?? 0), 0),
    }
  }, [contas, mes, ano])

  const gap = saldoPJ - totaisJanela.priorizado

  return {
    contas,
    janela,
    saldoPJ,
    salvarSaldoPJ,
    prioridades,
    togglePrioridade,
    loadingContas,
    loadingSaldo,
    loadingPrioridades,
    config,
    totaisJanela,
    totaisMes,
    gap,
    mes,
    ano,
  }
}
