import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  Usuario,
  Transacao,
  Extrato,
  ContaPagar,
  Profissional,
  FaturamentoAvec,
  FaturamentoRealMes,
  DreMensal,
  DreConfig,
  Categoria,
  Configuracoes,
  MensagemTemplate,
  MensagemEnviada,
} from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

const col = (name: string) => collection(db, name)

// ── Usuários ──────────────────────────────────────────────────────────────────

export async function getUsuario(uid: string): Promise<Usuario | null> {
  const snap = await getDoc(doc(db, 'usuarios', uid))
  return snap.exists() ? (snap.data() as Usuario) : null
}

export async function getUsuarios(): Promise<Usuario[]> {
  const snap = await getDocs(query(col('usuarios'), orderBy('criadoEm', 'asc')))
  return snap.docs.map(d => d.data() as Usuario)
}

export async function criarUsuario(uid: string, data: Omit<Usuario, 'uid' | 'criadoEm'>) {
  await setDoc(doc(db, 'usuarios', uid), {
    ...data,
    uid,
    criadoEm: Timestamp.now(),
  })
}

export async function updateUsuario(uid: string, data: Partial<Omit<Usuario, 'uid' | 'criadoEm'>>) {
  await updateDoc(doc(db, 'usuarios', uid), data)
}

// ── Transações ────────────────────────────────────────────────────────────────

export async function getTransacoes(mes: number, ano: number): Promise<Transacao[]> {
  const q = query(col('transacoes'), where('mes', '==', mes), where('ano', '==', ano), orderBy('data', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transacao))
}

export async function addTransacao(data: Omit<Transacao, 'id' | 'criadoEm'>) {
  return addDoc(col('transacoes'), { ...data, criadoEm: Timestamp.now() })
}

export async function getTransacoesByExtrato(extratoId: string): Promise<Transacao[]> {
  const snap = await getDocs(query(col('transacoes'), where('extratoId', '==', extratoId)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Transacao))
    .sort((a, b) => a.data.toMillis() - b.data.toMillis())
}

export async function deleteTransacoesByExtrato(extratoId: string) {
  const snap = await getDocs(query(col('transacoes'), where('extratoId', '==', extratoId)))
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'transacoes', d.id))))
}

export async function updateTransacao(id: string, data: Partial<Transacao>) {
  await updateDoc(doc(db, 'transacoes', id), data)
}

export async function deleteTransacao(id: string) {
  await deleteDoc(doc(db, 'transacoes', id))
}

// ── Extratos ──────────────────────────────────────────────────────────────────

export async function getExtrato(id: string): Promise<Extrato | null> {
  const snap = await getDoc(doc(db, 'extratos', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Extrato) : null
}

export async function getExtratos(mes?: number, ano?: number): Promise<Extrato[]> {
  const constraints: QueryConstraint[] = [orderBy('criadoEm', 'desc')]
  if (mes !== undefined) constraints.unshift(where('mes', '==', mes))
  if (ano !== undefined) constraints.unshift(where('ano', '==', ano))
  const snap = await getDocs(query(col('extratos'), ...constraints))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Extrato))
}

export async function addExtrato(data: Omit<Extrato, 'id' | 'criadoEm'>) {
  return addDoc(col('extratos'), { ...data, criadoEm: Timestamp.now() })
}

export async function updateExtrato(id: string, data: Partial<Extrato>) {
  await updateDoc(doc(db, 'extratos', id), data)
}

export async function deleteExtrato(id: string) {
  await deleteDoc(doc(db, 'extratos', id))
}

// ── Contas a Pagar ────────────────────────────────────────────────────────────

export async function getContasPagar(apenasAtivas = true): Promise<ContaPagar[]> {
  const constraints: QueryConstraint[] = [orderBy('diaVencimento', 'asc')]
  if (apenasAtivas) constraints.unshift(where('ativa', '==', true))
  const snap = await getDocs(query(col('contas_pagar'), ...constraints))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ContaPagar))
}

export async function addContaPagar(data: Omit<ContaPagar, 'id' | 'criadoEm'>) {
  return addDoc(col('contas_pagar'), { ...data, criadoEm: Timestamp.now() })
}

export async function updateContaPagar(id: string, data: Partial<ContaPagar>) {
  await updateDoc(doc(db, 'contas_pagar', id), data)
}

export async function deleteContaPagar(id: string) {
  await deleteDoc(doc(db, 'contas_pagar', id))
}

// ── Profissionais ─────────────────────────────────────────────────────────────

export async function getProfissionais(apenasAtivos = true): Promise<Profissional[]> {
  const constraints: QueryConstraint[] = [orderBy('nome', 'asc')]
  if (apenasAtivos) constraints.unshift(where('ativa', '==', true))
  const snap = await getDocs(query(col('profissionais'), ...constraints))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Profissional))
}

export async function updateProfissional(id: string, data: Partial<Profissional>) {
  await updateDoc(doc(db, 'profissionais', id), data)
}

// ── Faturamento AVEC ──────────────────────────────────────────────────────────

export async function getFaturamentoAvec(mes: number, ano: number): Promise<FaturamentoAvec | null> {
  const snap = await getDoc(doc(db, 'faturamento_avec', `${ano}-${String(mes).padStart(2, '0')}`))
  return snap.exists() ? (snap.data() as FaturamentoAvec) : null
}

// ── Faturamento Real (0208) ───────────────────────────────────────────────────

export async function setFaturamentoReal(data: Omit<FaturamentoRealMes, 'uploadEm'>) {
  await setDoc(doc(db, 'faturamento_real', data.id), {
    ...data,
    uploadEm: Timestamp.now(),
  })
}

export async function setFaturamentoAvec(data: Omit<FaturamentoAvec, 'uploadEm'>, usuarioId: string) {
  const id = `${data.ano}-${String(data.mes).padStart(2, '0')}`
  await setDoc(doc(db, 'faturamento_avec', id), { ...data, id, usuarioId, uploadEm: Timestamp.now() })
}

// ── DRE Mensal ────────────────────────────────────────────────────────────────

export async function getDreMensal(mes: number, ano: number): Promise<DreMensal | null> {
  const snap = await getDoc(doc(db, 'dre_mensal', `${ano}-${String(mes).padStart(2, '0')}`))
  return snap.exists() ? (snap.data() as DreMensal) : null
}

export async function setDreMensal(data: Omit<DreMensal, 'geradoEm'>) {
  const id = `${data.ano}-${String(data.mes).padStart(2, '0')}`
  await setDoc(doc(db, 'dre_mensal', id), { ...data, id, geradoEm: Timestamp.now() })
}

export async function getDresHistorico(): Promise<DreMensal[]> {
  const snap = await getDocs(query(col('dre_mensal'), orderBy('ano', 'desc'), orderBy('mes', 'desc')))
  return snap.docs.map(d => d.data() as DreMensal)
}

// ── DRE Config ────────────────────────────────────────────────────────────────

export async function getDreConfig(mes: number, ano: number): Promise<DreConfig | null> {
  const snap = await getDoc(doc(db, 'dre_config', `${ano}-${String(mes).padStart(2, '0')}`))
  return snap.exists() ? (snap.data() as DreConfig) : null
}

export async function setDreConfig(data: Omit<DreConfig, 'geradoEm'>) {
  const id = `${data.ano}-${String(data.mes).padStart(2, '0')}`
  await setDoc(doc(db, 'dre_config', id), { ...data, id, geradoEm: Timestamp.now() })
}

export async function getDresConfigs(): Promise<DreConfig[]> {
  const snap = await getDocs(col('dre_config'))
  return snap.docs
    .map(d => d.data() as DreConfig)
    .sort((a, b) => b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes)
}

// ── Categorias ────────────────────────────────────────────────────────────────

export async function getCategorias(): Promise<Categoria[]> {
  // Filtra apenas por 'ativa' e ordena no cliente — evita índice composto
  const snap = await getDocs(query(col('categorias'), where('ativa', '==', true)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Categoria))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

export async function addCategoria(data: Omit<Categoria, 'id'>): Promise<Categoria> {
  const ref = await addDoc(col('categorias'), data)
  return { id: ref.id, ...data }
}

export async function updateCategoria(id: string, data: Partial<Omit<Categoria, 'id'>>) {
  await updateDoc(doc(db, 'categorias', id), data)
}

export async function getNomesCNPJ(cnpjs: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  await Promise.all(cnpjs.map(async cnpj => {
    const digits = cnpj.replace(/\D/g, '')
    const snap = await getDoc(doc(db, 'cnpj_cache', digits))
    if (snap.exists()) {
      const nome = snap.data()?.nome as string | null
      if (nome) map.set(cnpj, nome)
    }
  }))
  return map
}

// ── Configurações ─────────────────────────────────────────────────────────────

export async function getConfiguracoes(): Promise<Configuracoes | null> {
  const snap = await getDoc(doc(db, 'configuracoes', 'parametros'))
  return snap.exists() ? (snap.data() as Configuracoes) : null
}

// ── Mensagens Templates ───────────────────────────────────────────────────────

export function onTemplatesMensagens(callback: (templates: MensagemTemplate[]) => void): Unsubscribe {
  return onSnapshot(
    query(col('mensagens_templates'), orderBy('criadoEm', 'asc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as MensagemTemplate)))
  )
}

export async function addTemplateMensagem(data: Omit<MensagemTemplate, 'id' | 'criadoEm' | 'atualizadoEm'>) {
  const now = Timestamp.now()
  return addDoc(col('mensagens_templates'), { ...data, criadoEm: now, atualizadoEm: now })
}

export async function updateTemplateMensagem(id: string, data: Partial<Omit<MensagemTemplate, 'id' | 'criadoEm'>>) {
  await updateDoc(doc(db, 'mensagens_templates', id), { ...data, atualizadoEm: Timestamp.now() })
}

// ── Mensagens Enviadas ────────────────────────────────────────────────────────

export function onMensagensEnviadas(callback: (msgs: MensagemEnviada[]) => void): Unsubscribe {
  return onSnapshot(
    query(col('mensagens_enviadas'), orderBy('enviadoEm', 'desc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as MensagemEnviada)))
  )
}

export async function addMensagemEnviada(data: Omit<MensagemEnviada, 'id'>) {
  return addDoc(col('mensagens_enviadas'), data)
}
