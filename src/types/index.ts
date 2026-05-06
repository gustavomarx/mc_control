import { Timestamp } from 'firebase/firestore'

// ── Usuário ───────────────────────────────────────────────────────────────────

export interface Usuario {
  uid: string
  nome: string
  email: string
  papel: 'admin' | 'usuario'
  criadoEm: Timestamp
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
