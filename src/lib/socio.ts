// Classificação das retiradas do sócio (regra da contabilidade FMICH, out/2026)
//
// Dentro de cada mês, os Pix da empresa para o CPF do sócio são repartidos nesta ordem:
//   1. Pagamento de empréstimo do sócio — até o total que o sócio emprestou NO MÊS
//      (Pix do sócio para a empresa, categoria "Empréstimo do sócio"); não acumula entre meses
//   2. Pró-labore — até o valor líquido do recibo, a partir do mês de início
//   3. Distribuição de lucro — o que exceder
// Uma retirada que atravessa um limite é dividida em duas partes.
// Pagamento de conta pessoal pela empresa é distribuição de lucro (não entra nesta conta).

export const CAT_EMPRESTIMO = 'Empréstimo do sócio'
export const CAT_PAGAMENTO_EMPRESTIMO = 'Pagamento de empréstimo do sócio'
export const CAT_PROLABORE = 'Pró-labore'
export const CAT_DISTRIBUICAO = 'Distribuição de lucro'
export const TIPO1_SOCIO = 'Investimento/Resgate'

// Trecho do CPF do Gustavo como aparece no extrato Sicoob
export const DOC_SOCIO = '758.610'

const CATS_RETIRADA = [CAT_PAGAMENTO_EMPRESTIMO, CAT_PROLABORE, CAT_DISTRIBUICAO]

export interface MovSocio {
  data: number             // ms, para ordenar
  valor: number            // com sinal: + entrada, − saída
  categoria: string
  descricaoOriginal: string
}

export interface ConfigSocio {
  mes: number
  ano: number
  proLaboreLiquido?: number      // valor líquido do recibo
  proLaboreInicio?: string       // 'YYYY-MM'
}

export interface ParteSocio { categoria: string; valor: number }   // valor positivo

export interface ResultadoSocio {
  // índice da movimentação original → partes em que ela fica (1 ou 2)
  partes: Map<number, ParteSocio[]>
  resumo: {
    emprestado: number
    pagamentoEmprestimo: number
    proLabore: number
    distribuicao: number
    proLaboreAplicavel: boolean
    proLaboreSemValor: boolean   // mês com pró-labore, mas líquido não configurado
  }
}

// Retirada para o sócio: saída para o CPF do sócio, em uma das categorias de retirada
// (se alguém trocou manualmente para outra categoria, respeita)
export function ehRetiradaSocio(m: MovSocio): boolean {
  return m.valor < 0 && m.descricaoOriginal.includes(DOC_SOCIO) && CATS_RETIRADA.includes(m.categoria)
}

const centavos = (n: number) => Math.round(n * 100) / 100

export function alocarSocio(movs: MovSocio[], cfg: ConfigSocio): ResultadoSocio {
  const emprestado = centavos(
    movs.filter(m => m.valor > 0 && m.categoria === CAT_EMPRESTIMO).reduce((s, m) => s + m.valor, 0),
  )
  const mesRef = `${cfg.ano}-${String(cfg.mes).padStart(2, '0')}`
  const proLaboreAplicavel = !!cfg.proLaboreInicio && mesRef >= cfg.proLaboreInicio
  const proLaboreLimite = proLaboreAplicavel ? (cfg.proLaboreLiquido ?? 0) : 0

  // Limites na ordem em que são consumidos
  const faixas = [
    { categoria: CAT_PAGAMENTO_EMPRESTIMO, restante: emprestado },
    { categoria: CAT_PROLABORE, restante: proLaboreLimite },
  ]

  const retiradas = movs
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => ehRetiradaSocio(m))
    .sort((a, b) => a.m.data - b.m.data || a.i - b.i)

  const partes = new Map<number, ParteSocio[]>()
  const total = { [CAT_PAGAMENTO_EMPRESTIMO]: 0, [CAT_PROLABORE]: 0, [CAT_DISTRIBUICAO]: 0 }

  for (const { m, i } of retiradas) {
    let falta = centavos(-m.valor)
    const ps: ParteSocio[] = []
    for (const f of faixas) {
      if (falta <= 0 || f.restante <= 0) continue
      const v = centavos(Math.min(falta, f.restante))
      ps.push({ categoria: f.categoria, valor: v })
      f.restante = centavos(f.restante - v)
      falta = centavos(falta - v)
    }
    if (falta > 0) ps.push({ categoria: CAT_DISTRIBUICAO, valor: falta })
    for (const p of ps) total[p.categoria as keyof typeof total] = centavos(total[p.categoria as keyof typeof total] + p.valor)
    partes.set(i, ps)
  }

  return {
    partes,
    resumo: {
      emprestado,
      pagamentoEmprestimo: total[CAT_PAGAMENTO_EMPRESTIMO],
      proLabore: total[CAT_PROLABORE],
      distribuicao: total[CAT_DISTRIBUICAO],
      proLaboreAplicavel,
      proLaboreSemValor: proLaboreAplicavel && !cfg.proLaboreLiquido,
    },
  }
}
