'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, orderBy, onSnapshot,
  deleteDoc, doc, Timestamp, writeBatch, type WriteBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Compra } from '@/types'

// Campos que o formulário preenche por item
export type CompraInput = Pick<Compra, 'data' | 'material' | 'quantidade' | 'valorUnitario' | 'valor' | 'loja' | 'pedido'>

export interface Autor { uid: string; nome: string }

// Compras do mês (mes 1-12)
export function useCompras(mes: number, ano: number) {
  const [compras, setCompras] = useState<Compra[]>([])
  // Mês já carregado — loading é derivado (evita setState síncrono no effect)
  const chave = `${ano}-${mes}`
  const [carregado, setCarregado] = useState<string | null>(null)
  const loading = carregado !== chave

  useEffect(() => {
    const inicio = Timestamp.fromDate(new Date(ano, mes - 1, 1))
    const fim = Timestamp.fromDate(new Date(ano, mes, 1))
    const q = query(
      collection(db, 'compras'),
      where('data', '>=', inicio),
      where('data', '<', fim),
      orderBy('data', 'desc'),
    )
    const unsub = onSnapshot(q, snap => {
      setCompras(snap.docs.map(d => ({ id: d.id, ...d.data() } as Compra)))
      setCarregado(`${ano}-${mes}`)
    })
    return unsub
  }, [mes, ano])

  // Novo lançamento: todos os itens no mesmo lote
  const lancar = useCallback(async (itens: CompraInput[], autor: Autor) => {
    const batch = writeBatch(db)
    const agora = Timestamp.now()
    const loteId = doc(collection(db, 'compras')).id
    itens.forEach((item, ordem) => {
      batch.set(doc(collection(db, 'compras')), {
        ...semVazios(item), loteId, ordem,
        criadoEm: agora, criadoPor: autor.uid, criadoPorNome: autor.nome,
      })
    })
    registrarCadastros(batch, itens)
    await batch.commit()
  }, [])

  // Edição do lançamento inteiro: atualiza os existentes, cria os novos, apaga os removidos
  const salvarLote = useCallback(async (
    originais: Compra[],
    itens: (CompraInput & { id?: string })[],
    autor: Autor,
  ) => {
    const batch = writeBatch(db)
    const agora = Timestamp.now()
    const base = originais[0]
    const loteId = base?.loteId || doc(collection(db, 'compras')).id
    const mantidos = new Set(itens.map(i => i.id).filter(Boolean))

    itens.forEach(({ id, ...item }, ordem) => {
      const dados = { ...semVazios(item), pedido: item.pedido ?? '', loteId, ordem, atualizadoEm: agora }
      if (id) {
        batch.update(doc(db, 'compras', id), dados)
      } else {
        batch.set(doc(collection(db, 'compras')), {
          ...dados,
          criadoEm: base?.criadoEm ?? agora,
          criadoPor: base?.criadoPor ?? autor.uid,
          criadoPorNome: base?.criadoPorNome ?? autor.nome,
        })
      }
    })
    for (const o of originais) if (!mantidos.has(o.id)) batch.delete(doc(db, 'compras', o.id))
    registrarCadastros(batch, itens)
    await batch.commit()
  }, [])

  const excluir = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'compras', id))
  }, [])

  return { compras, loading, lancar, salvarLote, excluir }
}

// Firestore não aceita undefined; pedido vazio não é gravado. Ignora campos extras (ex.: id do form).
function semVazios(item: CompraInput): CompraInput {
  const { data, material, quantidade, valorUnitario, valor, loja, pedido } = item
  return { data, material, quantidade, valorUnitario, valor, loja, ...(pedido ? { pedido } : {}) }
}

// ── Cadastros para autocompletar (lojas e materiais) ──────────────────────────
// Coleções compras_lojas / compras_materiais: um doc por nome, id = nome normalizado

function chaveCadastro(nome: string): string {
  return nome.trim().toUpperCase().replace(/\//g, '-')
}

function registrarCadastros(batch: WriteBatch, itens: CompraInput[]) {
  const agora = Timestamp.now()
  for (const loja of new Set(itens.map(i => i.loja.trim()).filter(Boolean))) {
    batch.set(doc(db, 'compras_lojas', chaveCadastro(loja)), { nome: loja.toUpperCase(), usadoEm: agora }, { merge: true })
  }
  for (const material of new Set(itens.map(i => i.material.trim()).filter(Boolean))) {
    batch.set(doc(db, 'compras_materiais', chaveCadastro(material)), { nome: material.toUpperCase(), usadoEm: agora }, { merge: true })
  }
}

function useCadastro(colecao: string) {
  const [nomes, setNomes] = useState<string[]>([])
  useEffect(() => {
    const unsub = onSnapshot(collection(db, colecao), snap => {
      setNomes(snap.docs.map(d => d.data().nome as string).sort((a, b) => a.localeCompare(b, 'pt-BR')))
    })
    return unsub
  }, [colecao])
  return nomes
}

export const useLojasCompras = () => useCadastro('compras_lojas')
export const useMateriaisCompras = () => useCadastro('compras_materiais')
