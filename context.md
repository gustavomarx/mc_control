# mc_control — Sistema de Gestão Studio Meus Cílios

## Empresa
G&G Company LTDA — CNPJ 51.307.997/0001-68  
Nome fantasia: Studio Meus Cílios | São José – SC  
Franqueadora: Studio Meus Cílios (royalties 7,5% + fundo mkt 2%)  
Banco PJ: Sicoob | Sistema de agendamento/faturamento: AVEC (admin.avec.beauty)

## Stack
- Next.js 16.2.4 (App Router, Turbopack) + TypeScript
- Firebase Auth + Firestore (client SDK) + Firebase Admin SDK (API routes)
- Tailwind CSS v4
- Vercel (deploy automático via GitHub push para master)
- pdf-parse v2.4.5 (parser Sicoob) | xlsx (parse e exportação Excel)
- GitHub: gustavomarx/mc_finance (branch master)
- Port local: 3010

## Firebase
- Projeto: mc-finance-2b96f
- Auth: email/senha — usuário gustavomarx15@gmail.com
- Firestore: southamerica-east1
- Coleções:
  - `contas_pagar`, `transacoes`, `extratos`, `categorias`, `configuracoes`
  - `cnpj_cache`, `profissionais`, `faturamento_avec`, `dre_mensal`, `dre_config`
  - `tarefas`, `agenda_avec`, `comissoes`, `caixa_formas`
  - `aniversariantes_status`, `recuperacao_status`
  - `mensagem_templates`, `mensagens_enviadas`

## Estrutura de rotas
```
/login                → pública
/(app)/home           → visão geral do dia
/(app)/dashboard      → financeiro semanal
/(app)/extrato        → upload e categorização de extrato bancário
/(app)/contas         → contas a pagar recorrentes
/(app)/dre            → DRE mensal (wizard)
/(app)/comissoes      → upload planilha de comissões AVEC
/(app)/caixa          → formas de pagamento por período
/(app)/tarefas        → gestão de tarefas com recorrência
/(app)/agenda         → relatório semanal de agendamentos AVEC
/(app)/crm            → aniversariantes + recuperação de clientes
/(app)/mensagens      → envio de mensagens em lote e individual
```

## Módulos — status

| Módulo | Rota | Status |
|--------|------|--------|
| Home | `/home` | Concluído |
| Dashboard financeiro | `/dashboard` | Concluído |
| Extrato bancário | `/extrato` | Concluído |
| Contas a pagar | `/contas` | Concluído |
| DRE mensal | `/dre` | Concluído |
| Comissões | `/comissoes` | Concluído |
| Caixa (formas pgto) | `/caixa` | Concluído |
| Tarefas | `/tarefas` | Concluído |
| Agenda AVEC | `/agenda` | Concluído |
| CRM | `/crm` | Concluído |
| Mensagens | `/mensagens` | Concluído |

## Arquivos — estrutura atual
```
src/
├── app/
│   ├── api/extrato/route.ts
│   ├── (auth)/login/page.tsx
│   ├── (app)/layout.tsx
│   ├── (app)/home/page.tsx
│   ├── (app)/dashboard/page.tsx
│   ├── (app)/extrato/page.tsx
│   ├── (app)/contas/page.tsx
│   ├── (app)/dre/page.tsx
│   ├── (app)/comissoes/page.tsx
│   ├── (app)/caixa/page.tsx
│   ├── (app)/tarefas/page.tsx
│   ├── (app)/agenda/page.tsx
│   ├── (app)/crm/page.tsx
│   └── (app)/mensagens/page.tsx
├── contexts/AuthContext.tsx
├── proxy.ts                         ← guard de auth (Next.js 16: era middleware.ts)
├── hooks/
│   ├── useContasPagar.ts
│   ├── useDashboard.ts
│   ├── useAgenda.ts
│   ├── useCrm.ts
│   └── useMensagens.ts
├── lib/
│   ├── firebase.ts
│   ├── firebase-admin.ts
│   ├── firestore.ts
│   ├── utils.ts
│   ├── categorias.ts
│   ├── sicoob-parser.ts
│   ├── crm-messages.ts              ← msgRecuperacao(), linkWhatsApp()
│   ├── parse-agenda.ts              ← parseAgendaAvec(), toLocalKey()
│   ├── parse-agenda-cross.ts        ← parseAgenda0051(), periodoExportacao()
│   ├── parse-aniversariantes.ts
│   └── parse-recuperacao.ts
├── types/index.ts
└── components/
    ├── ui/Sidebar.tsx
    ├── contas/ModalConta.tsx, ModalPagamento.tsx
    ├── crm/CardAniversariante.tsx, CardRecuperacao.tsx
    └── mensagens/MensagensLote.tsx, MensagensIndividual.tsx (se existir)
scripts/seed.ts
```

## Módulo Home
- Tarefas pendentes **apenas do dia de hoje** (filtradas por `dataEntrega`)
- Empty state: "Sem tarefas para hoje — ou todas foram concluídas 🎉"

## Módulo Agenda AVEC
- Relatório: `https://admin.avec.beauty/admin/relatorio/0051`
- Semana: **seg a sáb** (domingo excluído)
- `toLocalKey(d)` — converte Date para `YYYY-MM-DD` local (evita bug UTC-3 do `toISOString()`)
- `parseAgendaAvec(file)` → retorna `AgendaAvec[]` (uma por semana do arquivo)
- `agendaAtual` = semana corrente pelo `semanaKey`; fallback = `historico[0]`
- Meta: **clientes únicas** (`clientesUnicas`); agendamentos totais exibidos como secundário
- Label das semanas: "Semana de 11 a 16 de Mai"
- Upload salva todas as semanas do arquivo em paralelo no Firestore (`agenda_avec/{semanaKey}`)
- Tabela por profissional: exibe **clientes únicas por dia** (deduplicadas por nome), excluindo Cancelado e Faltou

## Módulo CRM — Aniversariantes
- Relatório AVEC: `https://admin.avec.beauty/admin/relatorio/0001`
- Sub-abas: Hoje / Esta semana / Este mês
- Filtro: Só não contatadas
- Status: `nao_contatada | mensagem_enviada | agendou`
- Coleção Firestore: `aniversariantes_status`

## Módulo CRM — Recuperação
- Relatório único: **0051** com período `início de 2 meses atrás → fim do próximo mês`
  - `periodoExportacao()` calcula e exibe o período exato ao usuário
- `parseAgenda0051(file)` deriva automaticamente:
  - **Lista de recuperação**: clientes com visita passada que **não têm agendamento futuro**
  - **Modelos**: serviço contém `/modelo/i`
  - **Alerta de cancelamento**: faltou/cancelou após a última visita (`alertaCancelamento`)
  - Clientes com agendamento futuro (até fim do próximo mês) são excluídas
- `getCol(row, ...names)`: lookup case-insensitive + multi-nome para colunas do AVEC (resolve variações de header)
- Sub-abas: Todos / Clientes / Modelos
- Filtro secundário: Todas / Não contatada / Contatada
- Painel de números: Para recuperar / Modelos / Não contatadas
- Gerador de XLSX para mensagens: filtra por mínimo de dias, gera arquivo com colunas `cliente, celular, status`
- Coleção Firestore: `recuperacao_status` | doc info: `configuracoes/agenda_0051_upload`

## Módulo Mensagens
- Sub-módulos: Lote (`MensagensLote.tsx`) e Individual
- `lerXlsx()`: lê arquivo AVEC ou arquivo de recuperação; detecta header por 'cliente'/'hora'
  - Fallback de colunas: cliente/nome, celular/telefone/fone, serviço/servico/servi, etc.
- `filtrarEDeduplicar()`: filtra por status + deduplicação por celular ou nome
- `normStatus(s)`: normaliza status sem acento (evita mismatch 'Recuperação' vs 'Recuperacao')
- `STATUS_OPCOES`: inclui `'Recuperacao'` para arquivos gerados pelo CRM
- Templates salvos no Firestore (`mensagem_templates`), variáveis: `{nome}`, `{data}`, `{hora}`, `{servicos}`, `{profissional}`, `{studio}`
- Envio semi-automático: abre WhatsApp Web numa aba compartilhada, usuário confirma cada envio
- Histórico salvo em `mensagens_enviadas`

## Módulo Tarefas
- Campos: título, descrição, responsável (gabriela/gustavo/equipe), categoria, prioridade, dataEntrega, recorrência, subtarefas
- Recorrências: única, diária, semanal, quinzenal, mensal
- Histórico de conclusões em `historico_conclusoes[]`
- Filtro padrão ao abrir: **"Hoje & Atrasadas"** (tarefas pendentes com dataEntrega ≤ hoje)
- Tag "Atrasada" no card: só aparece quando dataEntrega < hoje (sem hora — não marca tarefas de hoje)

## Módulo DRE — Wizard 3 etapas
1. **Informações** — mês/ano + faturamento AVEC (Pix, Débito, Crédito, Dinheiro)
2. **Extrato** — seleciona extrato salvo
3. **DRE** — grupos por `tipo1`, KPIs, gap AVEC vs extrato, exportação Excel

## Extrato Bancário (Sicoob)
- Upload PDF **ou XLSX** → POST `/api/extrato` → parser pela extensão → enriquecimento CNPJ (BrasilAPI) → JSON
  - PDF: `parseSicoob` (`src/lib/sicoob-parser.ts`)
  - XLSX do internet banking: `parseSicoobXlsx` (`src/lib/sicoob-xlsx-parser.ts`) — aba `LANÇAMENTOS`
    (DATA | DOCUMENTO | HISTÓRICO | INFORMAÇÕES COMPLEMENTARES | VALOR com sinal)
  - O XLSX traz histórico por extenso; `HISTORICO_PDF` converte para a abreviação do PDF
    (ex.: `PIX EMITIDO OUTRA IF` → `PIX EMIT.OUTRA IF`, `CR COMPRAS MAESTRO` → `CR CMP MST`)
    para que palavras-chave das categorias continuem batendo. `descricaoOriginal` = `HIST INFO DOC.: <documento>`
  - Mês do extrato XLSX = mês com mais lançamentos. Sem mapeamento ainda: `DÉB.TRANSF.CONTAS DIF.TIT. INTERCREDIS`,
    `CRÉDITO DEVOLUÇÃO PIX`, `DÉBITO RECARGA PRÉ-PAGA` (ficam como vêm)
- Cache CNPJ em `cnpj_cache/{digits}`
- Categorização automática: `autoCategoria()` sobre `descricaoOriginal + nomeEmpresa`, por `ordem`, primeira palavra-chave que bate (substring, case-insensitive)
  - Cuidado: palavra-chave curta pega texto demais (ex.: `DAS` em Impostos)

## Módulo Compras (`/compras`)
- Lançador de compras de material (substitui a aba COMPRAS da planilha "Agendamentos")
- Permissão individual `permissoes.compras` (Usuários › Módulos). Aparece no menu Financeiro mesmo sem `financeiro`
- Coleção `compras`: um doc por item — `data, material, quantidade, valorUnitario, valor (qtd×unit), loja, pedido?, loteId, ordem, criadoEm, criadoPor, criadoPorNome, atualizadoEm?`
  - `loteId` agrupa os itens lançados juntos; "Editar" carrega o lançamento inteiro no formulário (`salvarLote` atualiza/cria/apaga em batch)
- Autocomplete: `compras_lojas` e `compras_materiais` (doc id = nome normalizado em maiúsculas), alimentados a cada lançamento/edição
  - Busca por todas as palavras em qualquer posição, sem acento
- Material e loja sempre em MAIÚSCULAS; valor unitário com máscara de moeda (dígitos entram pelos centavos)
- Formulário fixo à esquerda (3 linhas iniciais); tabela à direita ordenada pelo último lançamento, com filtro e ordenação por coluna
- Hook: `src/hooks/useCompras.ts` (`useCompras(mes, ano)`, `useLojasCompras`, `useMateriaisCompras`)

## Contabilidade (FMICH) — export e DE-PARA
- Contador: FMICH Contabilidade (CRC-SC 047480/O-7). Enviamos `Extrato_Contador_StudioMeusCilios_<MES>-<AA>.xlsx`
  gerado em `/dre` etapa 3 (`exportarContabilidade` em `src/app/(app)/dre/page.tsx`)
- Colunas: Data | Lançamento | Origem | Valor | Observação | Tipo1 | Tipo2 | **Conta contábil** (também na aba EntradaSaída e no preview; "—" amarelo = sem conta)
- `Categoria.contaContabil` (Firestore `categorias`), editável em Extrato › Categorias › Editar
- `contaContabilDe(t, categorias)` (`src/lib/categorias.ts`): categorias com mesmo `tipo2` → escolhe pela palavra-chave presente na descrição; senão a primeira com conta
- Plano de contas observado no razão de jun/26:
  | Conta | Uso | Categoria mc_control |
  |---|---|---|
  | 1000 | Recebimento de cliente / Pix recebido (também contrapartida de "troco") | Receita |
  | 1010 | Distribuição de lucro ao sócio Gustavo | Distribuição de lucro, Financiamento |
  | 325 | Comissão | Comissões |
  | 341 | Aluguel sala | Aluguel |
  | 350 | Tarifas bancárias | Bancárias e Financeiras |
  | 354 / 356 | Celesc / Claro | Energia, internet, telefone (por palavra-chave) |
  | 362 | Serviço tomado (99, Simone, Maycon, Cappta) | Serviços |
  | 364 | Royalties | Royalties |
  | 366 | Orsegups monitoramento | Sistemas (doc ORSEGUPS) |
  | 479 | Receita Federal | Impostos |
  | 493 | Doação (Comunidade Evangélica) | — (Pessoais sem conta) |
  | 510 | Honorários FMICH | Contabilidade |
  | 526 | Material consumo/uso/operacional | Material Operacional |
  | 553 | Viagens Uber | Serviços (doc UBER) |
  | 554 | Alimentação | Alimentação |
  | 560 | Publicidade (Facebook e Google) | Marketing Local |
  | sem código | "Empréstimo de sócio" / "Gastos com sistema" (resposta da FMICH, código não informado) | Empréstimo do sócio / Sistemas (AVEC, CRM…) |
- Como a FMICH classifica: pelo texto do extrato. Pix para CPF que não reconhecem → "Pagamento de troco" (abate receita);
  Pix para CPF do Gustavo (`***.758.610`) → distribuição de lucro; boleto sem nome (`DÉB.TIT.COMPE`) → aluguel.
  Por isso a conta contábil sugerida vai no relatório.
- Decisões (out/26):
  - CPFs `765.720`, `487.612` e nome `GABRIELA COELHO` = **Comissões** (palavras-chave)
  - Pix do Gustavo para a empresa = **Empréstimo do sócio** (não aporte, não receita) — kw `RECEBIMENTO PIX GUSTAVO PEIXOTO`
  - Pix da empresa para o Gustavo = **Distribuição de lucro** (antiga categoria "Investimento/Resgate" renomeada; meses antigos mantêm o nome antigo e saem sem conta)
  - Financiamento (boletos) → conta 1010 (retirada de lucro)
  - Transferência "MESMA TIT." G&G (maquininha → conta) = Receita
  - Google semanal = publicidade (560)
- **Retiradas do sócio (regra FMICH, out/26)** — `src/lib/socio.ts`, aplicada ao salvar o extrato (`/extrato`):
  - Pix da empresa → CPF `758.610` é repartido, **só dentro do mês** (não acumula entre meses):
    1. "Pagamento de empréstimo do sócio" até o total de "Empréstimo do sócio" (Pix do sócio → empresa) do mês
    2. "Pró-labore" até `configuracoes/parametros.proLaboreLiquidoGustavo` (líquido do recibo), a partir de `proLaboreInicio` ('2026-10')
    3. "Distribuição de lucro" o que exceder. Pix que cruza um limite vira 2 transações "(parte 1/2)"
  - Resumo "Sócio no mês" aparece na revisão do extrato
  - Conta pessoal paga pela empresa = Distribuição de lucro (categoria "Pessoais" desativada; CNPJ 21.545.674 Comunidade Evangélica → Distribuição)
  - Vale de jul/26 em diante; fev–jun ficam como estão. Gabriela (765.720) = Comissões, decisão do Gustavo
  - Jul/26: removido extrato PDF duplicado (ficou o XLSX) e reclassificado: emprestou 3.050 → pagamento 3.050, distribuição 5.239
- Jun/26 recategorizado no Firestore (48 lançamentos) conforme acima; razão de jun/26 conferido 366/366 por data+valor
- Pendências: CPF `402.280` (comissão em jun) ainda não é palavra-chave; Pix para clientes marcados como Receita
  (deveriam ser troco/devolução); próximo passo = conferir o razão de jul/26 do mesmo jeito

## proxy.ts (era middleware.ts)
- Next.js 16 renomeou `middleware.ts` → `proxy.ts` com export `proxy()` em vez de `middleware()`
- Protege rotas autenticadas via cookie `firebase-token`

## Vercel — variáveis de ambiente
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT   ← JSON completo do service-account.json (uma linha)
```

## Parâmetros financeiros fixos
- Ponto de equilíbrio: R$ 30.352
- Meta operacional: R$ 40.000
- Pró-labore total: R$ 5.500 (Gustavo R$ 4.500 + Gabriela R$ 1.000, dia 5)
- Custos variáveis: 45,5% do faturamento (comissões 30% + royalties 7,5% + fundo mkt 2% + Simples 6%)
- Custo fixo mensal base: R$ 11.343

## Regras de negócio críticas
- Royalties: Larissa Taborda (CPF), PJBank (CNPJ 18.191.228), Estética Beleza e Mulher (CNPJ 30.332.652)
- Aluguel R$ 4.097,61 = base + seguro + IPTU + coleta — categoria Aluguel
- Pró-labore não é despesa operacional no DRE
- Comissões calculadas sobre faturamento AVEC, não sobre extrato
- Simples Nacional calculado apenas sobre faturamento declarado (cartão)
- Dinheiro físico ~R$ 3.014/mês aparece no AVEC mas pode não aparecer no extrato — alertar gap
- Trocos via Pix para clientes (média R$ 38) → categoria Receita/Devolução
- Mandar à contabilidade sempre com conta contábil preenchida — sem isso eles chutam (ver seção Contabilidade)
