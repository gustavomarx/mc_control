import { Timestamp } from 'firebase/firestore'

// ── Usuário ───────────────────────────────────────────────────────────────────

export type PerfilUsuario = 'admin' | 'atendente'
export type NivelTarefas = 'equipe' | 'todos'

export interface PermissoesUsuario {
  mensagens: boolean
  tarefas: boolean
  tarefasNivel: NivelTarefas
  agenda: boolean
  crm: boolean
  comissoes: boolean
  caixa: boolean
  financeiro: boolean
}

export const PERMISSOES_PADRAO: PermissoesUsuario = {
  mensagens: false,
  tarefas: false,
  tarefasNivel: 'equipe',
  agenda: false,
  crm: false,
  comissoes: false,
  caixa: false,
  financeiro: false,
}

export interface Usuario {
  uid: string
  nome: string
  email: string
  perfil: PerfilUsuario
  ativo: boolean
  permissoes: PermissoesUsuario
  criadoEm: Timestamp
  criadoPor: string
}

// ── Transação ─────────────────────────────────────────────────────────────────

export type StatusTransacao = 'categorizado' | 'pendente'
export type OrigemTransacao = 'Sicoob' | 'Nubank' | 'Manual'

export interface Transacao {
  id: string
  data: Timestamp
  descricao: string
  descricaoOriginal: string
  valor: number
  categoria: string
  tipo1: string
  origem: OrigemTransacao
  mes: number
  ano: number
  extratoId: string
  status: StatusTransacao
  criadoEm: Timestamp
}

// ── Extrato ───────────────────────────────────────────────────────────────────

export type StatusExtrato = 'processado' | 'com_pendencias'
export type BancoExtrato = 'Sicoob' | 'Nubank'

export interface Extrato {
  id: string
  mes: number
  ano: number
  banco: BancoExtrato
  nomeArquivo: string
  dataUpload: Timestamp
  usuarioId: string
  totalLancamentos: number
  totalEntradas: number
  totalSaidas: number
  status: StatusExtrato
  criadoEm: Timestamp
}

// ── Conta a Pagar ─────────────────────────────────────────────────────────────

export type RecorrenciaContaPagar = 'mensal' | 'semanal' | 'unica' | 'anual'
export type TipoContaPagar = 'fixo' | 'variavel'
export type BaseCalculoContaPagar = 'faturamento' | null

export interface HistoricoPagamento {
  data: Timestamp
  valorPago: number
  pagoEm: Timestamp
  mesRef: number   // mês que este pagamento cobre (1–12)
  anoRef: number   // ano que este pagamento cobre
  usuarioId: string
}

export interface ContaPagar {
  id: string
  nome: string
  fornecedor: string
  valor: number | null
  percentual: number | null
  baseCalculo: BaseCalculoContaPagar
  diaVencimento: number
  recorrencia: RecorrenciaContaPagar
  mesAnual?: number
  mesInicio: number
  anoInicio: number
  tipo: TipoContaPagar
  categoria: string
  ativa: boolean
  historicoPagamentos: HistoricoPagamento[]
  criadoEm: Timestamp
}

// ── Profissional ──────────────────────────────────────────────────────────────

export type FuncaoProfissional = 'extensionista' | 'manicure'

export interface HistoricoComissao {
  mes: number
  ano: number
  faturamento: number
  valorComissao: number
  pago: boolean
  pagoEm: Timestamp | null
}

export interface Profissional {
  id: string
  nome: string
  funcao: FuncaoProfissional
  percentualComissao: number
  ativa: boolean
  historicoPagamentos: HistoricoComissao[]
  criadoEm: Timestamp
}

// ── Faturamento AVEC ──────────────────────────────────────────────────────────

export interface FaturamentoAvec {
  id: string
  mes: number
  ano: number
  total: number
  cartaoCredito: number
  cartaoDebito: number
  pix: number
  dinheiro: number
  uploadEm: Timestamp
  usuarioId: string
}

// ── DRE Config ────────────────────────────────────────────────────────────────

export interface DreConfig {
  id: string
  mes: number
  ano: number
  extratoId: string
  faturamentoAvecTotal: number
  faturamentoAvecPix: number
  faturamentoAvecDebito: number
  faturamentoAvecCredito: number
  faturamentoAvecDinheiro: number
  geradoEm: Timestamp
  usuarioId: string
}

// ── DRE Mensal ────────────────────────────────────────────────────────────────

export interface DreMensal {
  id: string
  mes: number
  ano: number
  faturamento: number
  // Custos variáveis
  comissoesPJ: number
  royalties: number
  fundoMarketing: number
  simplesNacional: number
  totalVariaveis: number
  // Custos fixos
  aluguel: number
  marketing: number
  material: number
  atendente: number
  telefoniaBEnergia: number
  contador: number
  sistemas: number
  consorcio: number
  seguranca: number
  totalFixos: number
  // Resultado
  proLabore: number
  lucroLiquido: number
  margem: number
  pontoEquilibrio: number
  geradoEm: Timestamp
}

// ── Categoria ─────────────────────────────────────────────────────────────────

export interface Categoria {
  id: string
  palavrasChave: string[]
  tipo1: string
  tipo2: string
  ativa: boolean
  ordem: number
}

// ── Configurações ─────────────────────────────────────────────────────────────

export interface Configuracoes {
  pontoEquilibrio: number
  metaOperacional: number
  proLaboreGustavo: number
  proLaboreGabriela: number
  totalProLabore: number
  percentualComissao: number
  percentualRoyalties: number
  percentualFundoMarketing: number
  percentualSimplesNacional: number
  totalCustosVariaveis: number
  custoFixoMensal: number
}

// ── Tarefas ───────────────────────────────────────────────────────────────────

export type ResponsavelTarefa = 'gabriela' | 'gustavo' | 'equipe'
export type CategoriaTarefa = 'financeiro' | 'marketing' | 'operacional' | 'atendimento' | 'estoque' | 'outro'
export type PrioridadeTarefa = 'urgente' | 'alta' | 'normal' | 'baixa'
export type RecorrenciaTarefa = 'unica' | 'diaria' | 'semanal' | 'quinzenal' | 'mensal'

export interface SubtarefaTarefa {
  id: string
  titulo: string
  concluida: boolean
}

export interface ConclusaoTarefa {
  concluidaEm: Timestamp
}

export interface Tarefa {
  id: string
  titulo: string
  descricao: string
  responsavel: ResponsavelTarefa
  categoria: CategoriaTarefa
  prioridade: PrioridadeTarefa
  dataEntrega: Timestamp
  recorrencia: RecorrenciaTarefa
  recorrenciaDia?: number
  estimativaTempo?: string
  link?: string
  subtarefas: SubtarefaTarefa[]
  concluida: boolean
  concluidaEm?: Timestamp
  historico_conclusoes: ConclusaoTarefa[]
  criadaEm: Timestamp
  atualizadaEm: Timestamp
}

// ── Agenda AVEC ───────────────────────────────────────────────────────────────

export type StatusAgendamento =
  | 'Agendado'
  | 'Confirmado'
  | 'Aguardando'
  | 'Em Atendimento'
  | 'Pago'
  | 'Finalizado'
  | 'Cancelado'
  | 'Faltou'

export interface AgendamentoAvec {
  dataReserva: string
  hora: string
  cliente: string
  celular: string
  dataCadastroCliente: string
  profissional: string
  servico: string
  status: StatusAgendamento
  observacao: string
  clienteNova: boolean
}

export interface AgendaDia {
  ativos: number
  confirmados: number
  aguardando: number
  agendados: number
  cancelados: number
  faltas: number
}

export interface AgendaAvec {
  id: string
  semanaKey: string
  uploadEm: Timestamp
  totalAtivos: number
  totalCancelados: number
  totalFaltas: number
  clientesUnicas: number
  clientesNovas: number
  porDia: Record<string, AgendaDia>
  porProfissional: Record<string, Record<string, number>>
  porServico: { cilios: number; unhas: number; agregados: number; outros: number }
  agendamentos: AgendamentoAvec[]
}

// ── CRM ───────────────────────────────────────────────────────────────────────

export type StatusAniversariante = 'nao_contatada' | 'mensagem_enviada' | 'agendou'
export type StatusRecuperacao = 'nao_contatada' | 'contatada' | 'agendou' | 'nao_quer_mais'

export interface AniversarianteStatus {
  id: string
  nome: string
  dataNascimento: string
  celular: string
  email?: string
  status: StatusAniversariante
  atualizadoEm: Timestamp
}

export interface RecuperacaoStatus {
  id: string
  nome: string
  ultimaVisita: string
  diasSemRetorno: number
  celular: string
  email?: string
  isModelo: boolean
  alertaCancelamento?: string   // "Cancelou em DD/MM/YYYY" ou "Faltou em DD/MM/YYYY"
  observacao?: string
  status: StatusRecuperacao
  atualizadoEm: Timestamp
}

// ── Comissões ─────────────────────────────────────────────────────────────────

export interface ComissaoProfissional {
  nome: string
  tipoContratacao: string
  faturado: number
  rateioServicos: number
  rateioOutros: number
  descontos: number
  aPagar: number
  valorCasa: number
  percentualTotal: number
}

export interface Comissoes {
  id: string
  periodoKey: string
  periodoInicio: string
  periodoFim: string
  uploadEm: Timestamp
  totalFaturado: number
  totalAPagar: number
  valorCasa: number
  profissionais: ComissaoProfissional[]
}

// ── Caixa por Forma de Pagamento ──────────────────────────────────────────────

export interface FormaPagamento {
  nome: string
  valor: number
  percentual: number
}

export interface CaixaFormas {
  id: string
  periodoKey: string
  periodoInicio: string
  periodoFim: string
  uploadEm: Timestamp
  total: number
  formas: FormaPagamento[]
  dinheiroDepositado: boolean
  dinheiroDepositadoEm?: Timestamp
}

// ── Faturamento Real (relatório 0208) ─────────────────────────────────────────

export interface FaturamentoRealDia {
  faturado: number
  comandas: number
}

export interface FaturamentoRealMes {
  id: string   // "YYYY-MM"
  mes: number
  ano: number
  porDia: Record<string, FaturamentoRealDia>   // YYYY-MM-DD → dados
  uploadEm: Timestamp
}

// ── Mensagens ─────────────────────────────────────────────────────────────────

export type TipoTemplate = 'lote' | 'individual' | 'ambos'
export type CategoriaTemplate = 'confirmacao' | 'lembrete' | 'pos_atendimento' | 'aniversario' | 'cobranca' | 'livre'

export interface MensagemTemplate {
  id: string
  titulo: string
  tipo: TipoTemplate
  categoria: CategoriaTemplate
  conteudo: string
  ativo: boolean
  statusPadrao?: string[]
  criadoEm: Timestamp
  criadoPor: string
  atualizadoEm: Timestamp
}

export interface DestinatarioMensagem {
  nome: string
  celular: string
  mensagemFinal: string
  status: 'enviado' | 'pulado'
}

export type TipoEnvio = 'lote' | 'individual'

export interface MensagemEnviada {
  id: string
  templateId: string
  templateTitulo: string
  tipo: TipoEnvio
  destinatarios: DestinatarioMensagem[]
  totalEnviados: number
  totalPulados: number
  enviadoPor: string
  enviadoEm: Timestamp
  periodoAgenda?: string
}

// ── Utilitários ───────────────────────────────────────────────────────────────

export interface LancamentoSicoob {
  data: string
  descricao: string
  valor: number
}

export interface ResultadoDRE {
  faturamento: number
  comissoesPJ: number
  royalties: number
  fundoMarketing: number
  simplesNacional: number
  totalVariaveis: number
  receitaAposVariaveis: number
  totalFixos: number
  sobraAntesProLabore: number
  proLabore: number
  lucroLiquido: number
  margem: number
  pontoEquilibrio: number
  abaixoPontoEquilibrio: boolean
}

// ── Facebook Ads ──────────────────────────────────────────────────────────────

export interface FacebookAdsAccount {
  id: string    // act_XXXXXXXXX
  name: string
}

export interface FacebookAdsConfig {
  token: string
  accounts: FacebookAdsAccount[]
  defaultAccountId: string
}

export interface FacebookCampaign {
  id: string
  name: string
  status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  spend: string
  impressions: string
  clicks: string
  ctr: string
  cpc: string
}

export interface FbAdSet {
  id: string
  name: string
  status: string
  daily_budget?: string
  lifetime_budget?: string
  spend: string
  impressions: string
  clicks: string
  ctr: string
  cpc: string
}

export interface FbAdCreative {
  title?: string
  body?: string
  description?: string
  image_url?: string   // full-res: link_data.picture > image_url > video thumbnail
  call_to_action?: string
}

export interface FbAd {
  id: string
  name: string
  status: string
  creative: FbAdCreative
  spend: string
  impressions: string
  clicks: string
  ctr: string
  cpc: string
}

export interface FacebookAccountInsights {
  id: string
  name: string
  currency: string
  balance: number        // R$ (já convertido de centavos)
  amount_spent: number   // R$ (já convertido de centavos)
  spend_cap: number      // R$ limite de gasto
  spend: string          // R$ do período (insights)
  impressions: string
  clicks: string
  ctr: string
  cpc: string
  cpm: string
  reach: string
}

