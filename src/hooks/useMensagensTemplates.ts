import { useState, useEffect } from 'react'
import { onTemplatesMensagens, addTemplateMensagem, updateTemplateMensagem } from '@/lib/firestore'
import type { MensagemTemplate, TipoTemplate, CategoriaTemplate } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

export function useMensagensTemplates() {
  const { usuario } = useAuth()
  const [templates, setTemplates] = useState<MensagemTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onTemplatesMensagens(data => {
      setTemplates(data)
      setLoading(false)
    })
    return unsub
  }, [])

  async function criar(data: { titulo: string; tipo: TipoTemplate; categoria: CategoriaTemplate; conteudo: string; ativo: boolean }) {
    if (!usuario) return
    await addTemplateMensagem({ ...data, criadoPor: usuario.uid })
  }

  async function atualizar(id: string, data: Partial<Omit<MensagemTemplate, 'id' | 'criadoEm'>>) {
    await updateTemplateMensagem(id, data)
  }

  const ativos = templates.filter(t => t.ativo)

  return { templates, ativos, loading, criar, atualizar }
}
