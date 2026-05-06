/**
 * Seed do Firestore — Studio Meus Cílios
 * Uso: npx ts-node -P tsconfig.seed.json scripts/seed.ts
 */

import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Init ──────────────────────────────────────────────────────────────────────

const serviceAccountPath = resolve(process.cwd(), 'service-account.json')
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'))

const app = getApps().length
  ? getApp()
  : initializeApp({ credential: cert(serviceAccount) })

const db = getFirestore(app)

// ── Categorias ────────────────────────────────────────────────────────────────

const categorias = [
  {
    palavrasChave: ['EDUARDA MACAGNAN', 'MARIA LUIZA DA ROSA', 'YASMIM VITORIA', 'RAYARA MIETLICKI', 'GIOVANA FERREIRA', 'BRENDA COSTA', 'YASMIN PENELOPE', 'THAYANE CUSTODIO', 'CAMYLLE DA SILVA'],
    tipo1: 'Despesas variáveis', tipo2: 'Comissões', ativa: true, ordem: 1,
  },
  {
    palavrasChave: ['LARISSA TABORDA', 'PJBANK', 'ESTETICA BELEZA E MULHER', '30.332.652'],
    tipo1: 'Descontos da Receita', tipo2: 'Royalties', ativa: true, ordem: 2,
  },
  {
    palavrasChave: ['HELP CILIOS', 'LFB', 'CLICK UNHAS', 'BEAUTY CUSTOMER SUCCESS'],
    tipo1: 'Despesas variáveis', tipo2: 'Material Operacional', ativa: true, ordem: 3,
  },
  {
    palavrasChave: ['MERCADO LIVRE', 'MERCADO PAGO', 'PIX MARKETPLACE', 'MARKETPLACE', 'SHPP BRASIL', 'SHOPEE', 'VICELL', 'ZOOP BRASIL'],
    tipo1: 'Despesas variáveis', tipo2: 'Material Operacional', ativa: true, ordem: 4,
  },
  {
    palavrasChave: ['FMICH', 'MOCARZEL', 'CVR CONTABILIDADE'],
    tipo1: 'Despesas Fixas', tipo2: 'Contabilidade', ativa: true, ordem: 5,
  },
  {
    palavrasChave: ['FACEBOOK', 'GOOGLE', 'NAZIR REGINA', 'CONTRATA SITE', 'IDM MIDIAS'],
    tipo1: 'Despesas variáveis', tipo2: 'Marketing Local', ativa: true, ordem: 6,
  },
  {
    palavrasChave: ['IBAGY'],
    tipo1: 'Despesas Fixas', tipo2: 'Aluguel', ativa: true, ordem: 7,
  },
  {
    palavrasChave: ['ORSEGUPS'],
    tipo1: 'Despesas Fixas', tipo2: 'Sistemas', ativa: true, ordem: 8,
  },
  {
    palavrasChave: ['AVEC', 'CRM', 'CHATCENTER', 'ASAAS', 'MW SOFT'],
    tipo1: 'Despesas Fixas', tipo2: 'Sistemas', ativa: true, ordem: 9,
  },
  {
    palavrasChave: ['INCLUSIVA RH', 'MARIA LUIZA CAMARGO'],
    tipo1: 'Despesas Fixas', tipo2: 'Serviço de Atendimento', ativa: true, ordem: 10,
  },
  {
    palavrasChave: ['HS ADMINISTRADORA', 'CONSORCIO'],
    tipo1: 'Despesas Fixas', tipo2: 'Bancárias e Financeiras', ativa: true, ordem: 11,
  },
  {
    palavrasChave: ['PREFEITURA', 'RECEITA FEDERAL', 'SIMPLES', 'PGDAS', 'DAS'],
    tipo1: 'Descontos da Receita', tipo2: 'Impostos', ativa: true, ordem: 12,
  },
  {
    palavrasChave: ['CELESC'],
    tipo1: 'Despesas Fixas', tipo2: 'Energia, internet, telefone', ativa: true, ordem: 13,
  },
  {
    palavrasChave: ['CLARO', 'ALGAR', 'VIVO', 'TIM'],
    tipo1: 'Despesas Fixas', tipo2: 'Energia, internet, telefone', ativa: true, ordem: 14,
  },
  {
    palavrasChave: ['GUSTAVO PEIXOTO', 'GABRIELA COELHO', 'G&G COMPANY'],
    tipo1: 'Investimento/Resgate', tipo2: 'Investimento/Resgate', ativa: true, ordem: 15,
  },
  {
    palavrasChave: ['ANGELONI', 'GIASSI', 'SUPERMERCADO', 'ATACADAO', 'IFOOD', 'BURGER KING', 'PANVEL', 'FARMACIA'],
    tipo1: 'Alimentação', tipo2: 'Alimentação', ativa: true, ordem: 16,
  },
  {
    palavrasChave: ['UBER', '99 TECNOLOGIA'],
    tipo1: 'Despesas variáveis', tipo2: 'Serviços', ativa: true, ordem: 17,
  },
  {
    palavrasChave: ['ITAU UNIBANCO'],
    tipo1: 'Investimento/Resgate', tipo2: 'Financiamento', ativa: true, ordem: 18,
  },
]

// ── Contas a Pagar ────────────────────────────────────────────────────────────

const contasPagar = [
  { nome: 'Aluguel estúdio', fornecedor: 'Ibagy Imóveis', valor: 4097.61, percentual: null, baseCalculo: null, diaVencimento: 1, recorrencia: 'mensal', categoria: 'Aluguel' },
  { nome: 'Facebook Ads', fornecedor: 'Meta', valor: 1300.00, percentual: null, baseCalculo: null, diaVencimento: 0, recorrencia: 'mensal', categoria: 'Marketing Local' },
  { nome: 'Google Ads', fornecedor: 'Google', valor: 600.00, percentual: null, baseCalculo: null, diaVencimento: 0, recorrencia: 'mensal', categoria: 'Marketing Local' },
  { nome: 'Analista Google Ads', fornecedor: 'Nazir Regina', valor: 200.00, percentual: null, baseCalculo: null, diaVencimento: 0, recorrencia: 'mensal', categoria: 'Marketing Local' },
  { nome: 'Atendente WhatsApp', fornecedor: '', valor: 800.00, percentual: null, baseCalculo: null, diaVencimento: 0, recorrencia: 'mensal', categoria: 'Serviço de Atendimento' },
  { nome: 'Contador Fmich', fornecedor: 'Fmich Contabilidade', valor: 400.00, percentual: null, baseCalculo: null, diaVencimento: 0, recorrencia: 'mensal', categoria: 'Contabilidade' },
  { nome: 'Contabilidade Mocarzel', fornecedor: 'Mocarzel Assessoria', valor: 71.00, percentual: null, baseCalculo: null, diaVencimento: 0, recorrencia: 'mensal', categoria: 'Contabilidade' },
  { nome: 'AVEC sistema', fornecedor: 'AVEC', valor: 230.00, percentual: null, baseCalculo: null, diaVencimento: 0, recorrencia: 'mensal', categoria: 'Sistemas' },
  { nome: 'CRM WhatsApp', fornecedor: '', valor: 79.90, percentual: null, baseCalculo: null, diaVencimento: 0, recorrencia: 'mensal', categoria: 'Sistemas' },
  { nome: 'ChatCenter', fornecedor: '', valor: 79.90, percentual: null, baseCalculo: null, diaVencimento: 0, recorrencia: 'mensal', categoria: 'Sistemas' },
  { nome: 'Consórcio empresa', fornecedor: 'HS Administradora', valor: 370.00, percentual: null, baseCalculo: null, diaVencimento: 0, recorrencia: 'mensal', categoria: 'Bancárias e Financeiras' },
  { nome: 'Royalties franquia', fornecedor: 'Larissa Taborda / PJBank', valor: null, percentual: 7.5, baseCalculo: 'faturamento', diaVencimento: 20, recorrencia: 'mensal', categoria: 'Royalties' },
  { nome: 'Fundo marketing franquia', fornecedor: 'Larissa Taborda / PJBank', valor: null, percentual: 2.0, baseCalculo: 'faturamento', diaVencimento: 27, recorrencia: 'mensal', categoria: 'Royalties' },
  { nome: 'Comissionamento profissionais', fornecedor: 'Equipe', valor: null, percentual: 30.0, baseCalculo: 'faturamento', diaVencimento: 7, recorrencia: 'mensal', categoria: 'Comissões' },
  { nome: 'Simples Nacional', fornecedor: 'Receita Federal', valor: null, percentual: 6.0, baseCalculo: 'faturamento', diaVencimento: 20, recorrencia: 'mensal', categoria: 'Impostos' },
]

// ── Profissionais ─────────────────────────────────────────────────────────────

const profissionais = [
  { nome: 'Eduarda Macagnan Soares', funcao: 'extensionista', percentualComissao: 0.30, ativa: true },
  { nome: 'Maria Luiza da Rosa', funcao: 'extensionista', percentualComissao: 0.30, ativa: true },
  { nome: 'Yasmim Vitoria Cardoso', funcao: 'extensionista', percentualComissao: 0.30, ativa: true },
  { nome: 'Rayara Mietlicki', funcao: 'extensionista', percentualComissao: 0.30, ativa: true },
  { nome: 'Giovana Ferreira', funcao: 'extensionista', percentualComissao: 0.30, ativa: true },
  { nome: 'Brenda Costa Ribeiro', funcao: 'manicure', percentualComissao: 0.30, ativa: true },
  { nome: 'Yasmin Penelope Machado Portilho', funcao: 'manicure', percentualComissao: 0.30, ativa: true },
]

// ── Configurações ─────────────────────────────────────────────────────────────

const configuracoes = {
  pontoEquilibrio: 30352,
  metaOperacional: 40000,
  proLaboreGustavo: 4500,
  proLaboreGabriela: 1000,
  totalProLabore: 5500,
  percentualComissao: 0.30,
  percentualRoyalties: 0.075,
  percentualFundoMarketing: 0.02,
  percentualSimplesNacional: 0.06,
  totalCustosVariaveis: 0.455,
  custoFixoMensal: 11343,
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('Iniciando seed...')

  // Categorias
  const batch1 = db.batch()
  for (const [i, cat] of categorias.entries()) {
    const ref = db.collection('categorias').doc(`cat_${String(i + 1).padStart(2, '0')}`)
    batch1.set(ref, cat)
  }
  await batch1.commit()
  console.log(`✓ ${categorias.length} categorias`)

  // Contas a pagar
  const batch2 = db.batch()
  for (const conta of contasPagar) {
    const ref = db.collection('contas_pagar').doc()
    batch2.set(ref, { ...conta, historicoPagamentos: [], ativa: true, criadoEm: Timestamp.now() })
  }
  await batch2.commit()
  console.log(`✓ ${contasPagar.length} contas a pagar`)

  // Profissionais
  const batch3 = db.batch()
  for (const prof of profissionais) {
    const ref = db.collection('profissionais').doc()
    batch3.set(ref, { ...prof, historicoPagamentos: [], criadoEm: Timestamp.now() })
  }
  await batch3.commit()
  console.log(`✓ ${profissionais.length} profissionais`)

  // Configurações
  await db.collection('configuracoes').doc('parametros').set(configuracoes)
  console.log('✓ Configurações')

  console.log('\nSeed concluído.')
  process.exit(0)
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})
