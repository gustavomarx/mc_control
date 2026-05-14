'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useMensagensTemplates } from '@/hooks/useMensagensTemplates'
import MensagensLote from '@/components/mensagens/MensagensLote'
import ModalGerenciarTemplates from '@/components/mensagens/ModalGerenciarTemplates'

export default function MensagensPage() {
  const { perfil } = useAuth()
  const { ativos: templates, templates: todosTemplates, loading, criar, atualizar } = useMensagensTemplates()
  const [modalTemplates, setModalTemplates] = useState(false)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  return (
    <>
      <MensagensLote
        templates={templates}
        isAdmin={perfil === 'admin'}
        onAbrirTemplates={() => setModalTemplates(true)}
      />

      {modalTemplates && (
        <ModalGerenciarTemplates
          templates={todosTemplates}
          onClose={() => setModalTemplates(false)}
          onCriar={criar}
          onAtualizar={atualizar}
        />
      )}
    </>
  )
}
