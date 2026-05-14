/**
 * Seed do Firestore — Studio Meus Cílios
 * Uso: npx ts-node -P tsconfig.seed.json scripts/seed.ts
 */

import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
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

// ── Templates de Mensagens ────────────────────────────────────────────────────
// IDs fixos = re-execução do seed é segura (upsert)

const mensagensTemplates = [
  {
    id: 'confirmacao-dia-seguinte',
    titulo: 'Confirmação 24h',
    tipo: 'ambos',
    categoria: 'confirmacao',
    statusPadrao: ['Agendado'],
    conteudo:
`Oiee maravilhosa, tá pertinho de você vir ter o seu momento de autocuidado conosco ❤️
Seu serviço foi agendado com sucesso para dia *{data} às {hora}* no {studio}.

*{nome}*, queremos confirmar sua presença que é muuuuito importante para a profissional que conta com sua presença. *Posso confirmar?*`,
    ativo: true,
  },
  {
    id: 'lembrete-agendamento',
    titulo: 'Lembrete 48h',
    tipo: 'ambos',
    categoria: 'lembrete',
    statusPadrao: ['Agendado'],
    conteudo:
`Olá, *{nome}*, tudo bem? Espero que sim!

Quero te lembrar que você tem um horário agendado conosco no dia *{data} às {hora}* para *{servicos}*

Aguardamos ansiosas pelo seu momento especial de autocuidado! 💕

📍 Nosso endereço: Rua Altamiro Di Bernadi, 51, loja 04, São José - SC
⚠️ Caso precise desmarcar, por gentileza, avise com 24 horas de antecedência.`,
    ativo: true,
  },
  {
    id: 'pos-atendimento',
    titulo: 'Pós-Atendimento',
    tipo: 'lote',
    categoria: 'pos_atendimento',
    statusPadrao: ['Pago'],
    conteudo:
`Oi, *{nome}*! 💖

*Me conta, como você acordou hoje depois do seu atendimento?*

Foi um prazer cuidar de você! Qualquer dúvida ou *se quiser me contar como está se sentindo com o resultado*, me chama aqui.

E quando quiser repetir esse momento ou se ainda não deixou seu retorno garantido, me avise aqui e te ajudo. 🫶`,
    ativo: true,
  },
  {
    id: 'feedback',
    titulo: 'Feedback',
    tipo: 'lote',
    categoria: 'pos_atendimento',
    statusPadrao: ['Pago'],
    conteudo:
`Oi, *{nome}*! 🤍
Que bom ter você aqui no Studio na semana passada!
Esperamos que você tenha saído se sentindo ainda mais linda e especial.

Como foi sua experiência com {profissional}? Adoraríamos ouvir o que você achou do atendimento e do resultado! 🌸

Seu feedback *é muito importante pra gente*, é ele que nos ajuda a continuar melhorando e a garantir que cada visita seja ainda mais especial pra você.
Pode ser curtinho mesmo, uma frase já ajuda muito!`,
    ativo: true,
  },
  {
    id: 'aniversariante',
    titulo: 'Aniversariante',
    tipo: 'ambos',
    categoria: 'aniversario',
    statusPadrao: ['Pago'],
    conteudo:
`Olá *{nome}*, tudo bem?

*Esse é o mês do seu aniversário!*

Que alegria celebrar essa fase tão especial da sua vida 🤍

Desejamos que esse novo ciclo seja repleto de amor, saúde, prosperidade e muitos momentos de autocuidado.

E para deixar esse mês ainda mais especial, *queremos te presentear* com um *voucher de 50% OFF* no nosso Detox Facial 💆‍♀️✨

Um cuidado perfeito para deixar sua pele ainda mais linda, iluminada e radiante

📅 Válido até *{validade}*

Me chama por aqui para agendarmos seu momento, será uma honra cuidar de você 💕`,
    ativo: true,
  },
  {
    id: 'recuperacao',
    titulo: 'Recuperação',
    tipo: 'lote',
    categoria: 'livre',
    statusPadrao: ['Cancelado', 'Faltou'],
    conteudo:
`Oi, *{nome}*!
Sentimos sua falta aqui no Studio essa semana! 🥺

A gente sabe que imprevistos acontecem e tudo bem! Que tal a gente remarcar? Ainda temos horários disponíveis e adoraríamos te receber.

É só me falar qual dia e horário fica melhor pra você. 💕`,
    ativo: true,
  },
  {
    id: 'cobranca',
    titulo: 'Cobrança / Pagamento',
    tipo: 'individual',
    categoria: 'cobranca',
    conteudo: 'Oi {nome}! Tudo bem? Passando para avisar sobre um pagamento pendente referente ao seu atendimento no Studio Meus Cílios. Pode nos chamar para resolver! 😊',
    ativo: true,
  },
  {
    id: 'livre',
    titulo: 'Mensagem Livre',
    tipo: 'ambos',
    categoria: 'livre',
    conteudo: '{mensagem}',
    ativo: true,
  },
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

  // Usuário admin (gustavomarx15@gmail.com)
  try {
    const userRecord = await getAuth().getUserByEmail('gustavomarx15@gmail.com')
    const usuarioRef = db.collection('usuarios').doc(userRecord.uid)
    const usuarioSnap = await usuarioRef.get()
    if (!usuarioSnap.exists) {
      await usuarioRef.set({
        uid: userRecord.uid,
        nome: 'Gustavo',
        email: 'gustavomarx15@gmail.com',
        perfil: 'admin',
        ativo: true,
        criadoEm: Timestamp.now(),
        criadoPor: userRecord.uid,
      })
      console.log('✓ Usuário admin criado')
    } else {
      // Migra campo papel → perfil se necessário
      const data = usuarioSnap.data()!
      if (!data.perfil) {
        await usuarioRef.update({ perfil: 'admin', ativo: true, criadoPor: userRecord.uid })
        console.log('✓ Usuário admin migrado (papel → perfil)')
      } else {
        console.log('✓ Usuário admin já existe')
      }
    }
  } catch (e) {
    console.warn('⚠ Não foi possível criar/verificar usuário admin:', e)
  }

  // Templates de mensagens — upsert por ID fixo (re-run seguro)
  const adminSnap = await db.collection('usuarios').limit(1).get()
  const adminUid = adminSnap.empty ? 'seed' : adminSnap.docs[0].id
  const batchTemplates = db.batch()
  for (const tpl of mensagensTemplates) {
    const { id, ...dados } = tpl
    const ref = db.collection('mensagens_templates').doc(id)
    const snap = await ref.get()
    const now = Timestamp.now()
    if (!snap.exists) {
      batchTemplates.set(ref, { ...dados, criadoPor: adminUid, criadoEm: now, atualizadoEm: now })
    } else {
      batchTemplates.update(ref, { ...dados, atualizadoEm: now })
    }
  }
  await batchTemplates.commit()
  console.log(`✓ ${mensagensTemplates.length} templates de mensagens (upsert)`)

  console.log('\nSeed concluído.')
  process.exit(0)
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})
