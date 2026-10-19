import type { Categoria } from '@/types'

// Busca a melhor categoria para uma descrição de extrato.
// Retorna null se nenhuma palavra-chave bater.
export function autoCategoria(
  descricao: string,
  categorias: Categoria[],
): { categoria: string; tipo1: string } | null {
  const lower = descricao.toLowerCase()
  const sorted = [...categorias].sort((a, b) => a.ordem - b.ordem)
  for (const cat of sorted) {
    for (const kw of cat.palavrasChave ?? []) {
      if (kw && lower.includes(kw.toLowerCase())) {
        return { categoria: cat.tipo2, tipo1: cat.tipo1 }
      }
    }
  }
  return null
}

// Conta contábil sugerida para a transação. Quando várias categorias têm o
// mesmo nome (ex.: Energia → CELESC / CLARO), usa a que tiver a palavra-chave
// presente na descrição; senão a primeira com conta preenchida.
export function contaContabilDe(
  t: { categoria: string; descricaoOriginal: string },
  categorias: Categoria[],
): string {
  const candidatas = categorias.filter(c => c.tipo2 === t.categoria)
  const lower = (t.descricaoOriginal || '').toLowerCase()
  const porKw = candidatas.find(c =>
    (c.palavrasChave ?? []).some(kw => kw && lower.includes(kw.toLowerCase())),
  )
  if (porKw) return porKw.contaContabil ?? ''
  return candidatas.find(c => c.contaContabil)?.contaContabil ?? ''
}
