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
