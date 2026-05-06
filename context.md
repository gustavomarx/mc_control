# mc_finance — Sistema Financeiro Studio Meus Cílios

## Empresa
G&G Company LTDA — CNPJ 51.307.997/0001-68  
Nome fantasia: Studio Meus Cílios | São José – SC  
Franqueadora: Studio Meus Cílios (royalties 7,5% + fundo mkt 2%)  
Banco PJ: Sicoob | Sistema de agendamento/faturamento: AVEC

## Stack
- Next.js 16.2.4 (App Router, Turbopack) + TypeScript
- Firebase Auth + Firestore (client SDK) + Firebase Admin SDK (API routes)
- Tailwind CSS v4
- Vercel (deploy automático via GitHub)
- pdf-parse v2.4.5 (parser Sicoob) | xlsx (exportação Excel)

## Firebase
- Projeto: mc-finance-2b96f
- Auth: habilitado (email/senha), usuário gustavomarx15@gmail.com
- Firestore: southamerica-east1
- Seed: 18 categorias, 15 contas a pagar, 7 profissionais, configurações
- Coleções: `contas_pagar`, `transacoes`, `extratos`, `categorias`, `configuracoes`, `cnpj_cache`, `profissionais`, `faturamento_avec`, `dre_mensal`

## Estrutura de rotas
```
/login              → página pública
/dashboard          → Módulo 1
/extrato            → Módulo 2
/contas             → Módulo 3
/dre                → Módulo 4
```

## Módulos — status
| Módulo | Descrição | Status |
|--------|-----------|--------|
| 1 — Dashboard semanal | Contas 2 semanas + saldo PJ + gap + prioridades | **Concluído** |
| 2 — Extrato bancário | Upload PDF Sicoob, parse, enriquecimento CNPJ, categorização, salvar | **Concluído** |
| 3 — Contas a pagar | CRUD recorrentes, filtro mês/tipo, retroativo, acumulado atrasados | **Concluído** |
| 4 — DRE mensal | Wizard 3 etapas: Informações AVEC + seleção de extrato + DRE por grupos, histórico, pré-visualização + exportação Excel | **Concluído** |

## Arquivos — estrutura atual
```
src/
├── app/
│   ├── api/extrato/route.ts         ← POST PDF → parse + enriquecimento CNPJ → JSON
│   ├── (auth)/login/page.tsx
│   ├── (app)/layout.tsx
│   ├── (app)/dashboard/page.tsx     ← Módulo 1
│   ├── (app)/extrato/page.tsx       ← Módulo 2
│   ├── (app)/contas/page.tsx        ← Módulo 3
│   ├── (app)/dre/page.tsx           ← placeholder
│   └── layout.tsx
├── contexts/AuthContext.tsx
├── proxy.ts                         ← guard de autenticação (era middleware.ts, renomeado no Next.js 16)
├── hooks/
│   ├── useContasPagar.ts
│   └── useDashboard.ts
├── lib/
│   ├── firebase.ts                  ← client SDK
│   ├── firebase-admin.ts            ← admin SDK (API routes); lê service-account.json local ou FIREBASE_SERVICE_ACCOUNT env
│   ├── firestore.ts                 ← helpers Firestore client
│   ├── utils.ts
│   ├── categorias.ts                ← autoCategoria(desc, categorias[])
│   └── sicoob-parser.ts             ← parseSicoob(text) → ResultadoParse + LancamentoParsed (com cnpj?, nomeEmpresa?)
├── types/index.ts
└── components/
    ├── ui/Sidebar.tsx
    └── contas/
        ├── ModalConta.tsx
        └── ModalPagamento.tsx
scripts/seed.ts
```

## Módulo 2 — Extrato Bancário (detalhes)

### Fluxo
1. Upload PDF → POST `/api/extrato` → `PDFParse` extrai texto → `parseSicoob` → enriquecimento CNPJ → JSON
2. Tabela editável: busca por texto, ordenação por qualquer coluna, seleção múltipla para categorização em lote
3. Edição inline: descrição (clique), categoria (select), tipo C/D (toggle), excluir linha
4. Clica "Salvar extrato" → cria doc `Extrato` + N docs `Transacao` no Firestore (débitos com valor negativo)

### pdf-parse v2 — uso
```ts
import { PDFParse } from 'pdf-parse'
const p = new PDFParse({ data: buffer })
const r = await p.getText({ cellSeparator: '  ', pageJoiner: '\n' })
await p.destroy()
// r.text → texto completo
```

### Enriquecimento CNPJ
- Extrai CNPJ da descrição original (formato Sicoob: `11.377.588 0001-13`)
- Busca nome na BrasilAPI com headers de browser (sem User-Agent → Forbidden)
- Cache em Firestore `cnpj_cache/{digits}` → evita chamadas repetidas em produção
- Cache em memória para duração da instância serverless
- Exibido na linha discreta abaixo da descrição: `Nome Empresa · XX.XXX.XXX/XXXX-XX`

### sicoob-parser — formato do PDF
- 3 colunas: DATA | HISTÓRICO | VALOR
- Data: `DD/MM` no início da linha, seguida de `\s+`
- Valor: `\s+([\d.]+,\d{2}[CD])` no final (`C` = crédito, `D` = débito)
- Linhas sem data = continuação da descrição da transação anterior
- Ignoradas: SALDO ANTERIOR, SALDO BLOQ, SALDO DO DIA, etc.
- `LancamentoParsed`: `{ data, descricao, descricaoOriginal, valor, tipo, cnpj?, nomeEmpresa? }`

## Módulo 1 — Dashboard (detalhes)
- Janela: seg semana passada → dom semana atual (14 dias)
- Prioridades por semana: salvas em `configuracoes/planejamento_semana` com `semanaKey` (segunda-feira ISO)
- Gap = saldoPJ − soma dos priorizados pendentes
- Saldo PJ editável inline, salvo em `configuracoes/saldo`

## Módulo 3 — Contas a Pagar (detalhes)
- Recorrência: mensal, semanal, única, anual (anual pede mês)
- Natureza: fixo / variável
- `mesInicio/anoInicio`: "cobrar a partir de"
- Pagamentos retroativos: `HistoricoPagamento.mesRef/anoRef` identifica o mês coberto
- Aba "Atrasados": acumulado de todos os meses não pagos desde `mesInicio`

## next.config.ts
```ts
serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'firebase-admin']
```

## proxy.ts (era middleware.ts)
- Next.js 16 renomeou `middleware.ts` → `proxy.ts` com export `proxy()` em vez de `middleware()`
- Protege rotas autenticadas via cookie `firebase-token`

## Vercel — variáveis de ambiente necessárias
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT   ← JSON completo do service-account.json (uma linha)
```

## Módulo 4 — DRE Mensal (detalhes)

### Fluxo (wizard 3 etapas)
1. **Informações** — mês/ano + faturamento AVEC por forma de pagamento (Pix, Débito, Crédito, Dinheiro)
2. **Extrato** — seleciona extrato salvo no Firestore (lista cards)
3. **DRE** — agrupa transações por `tipo1`, mostra DRE + KPIs + gap AVEC vs extrato

### Coleções Firestore
- `dre_config/{ano}-{mes}` — `DreConfig`: extratoId + valores AVEC + metadados

### DRE — grupos e cálculo
- Todos os valores vêm do extrato (sem cálculo externo)
- Ordem: Receita Bruta → (-) Descontos da Receita → = Receita Líquida → (-) Despesas Fixas → (-) Despesas Variáveis → = Resultado Operacional → Investimento/Resgate
- `tipo1` valores: `'Receita'`, `'Descontos da Receita'`, `'Despesas Fixas'`, `'Despesas variáveis'`, `'Investimento/Resgate'`

### Exportação Excel
- Client-side com `xlsx` (dynamic import)
- Pré-visualização em modal antes de exportar

## Parâmetros financeiros fixos
- Ponto de equilíbrio: R$ 30.352
- Meta operacional: R$ 40.000
- Pró-labore total: R$ 5.500 (Gustavo R$4.500 + Gabriela R$1.000, dia 5)
- Custos variáveis: 45,5% do faturamento (comissões 30% + royalties 7,5% + fundo mkt 2% + Simples 6%)
- Custo fixo mensal base: R$ 11.343

## Regras de negócio críticas
- Royalties vêm de 3 origens: Larissa Taborda (CPF), PJBank (CNPJ 18.191.228), Estética Beleza e Mulher (CNPJ 30.332.652)
- Aluguel R$4.097,61 = base + seguro + IPTU + coleta — tudo categoria Aluguel
- Pró-labore (Gustavo/Gabriela da conta PJ) não é despesa operacional
- Comissões calculadas sobre faturamento AVEC, não sobre extrato
- Simples Nacional calculado apenas sobre faturamento declarado (cartão)
- Dinheiro físico ~R$3.014/mês aparece no AVEC mas pode não aparecer no extrato — alertar gap
- Trocos via Pix para clientes (média R$38) → categoria Receita/despesa / Devolução
