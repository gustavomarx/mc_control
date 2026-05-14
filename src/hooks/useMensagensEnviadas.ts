import { useState, useEffect } from 'react'
import { onMensagensEnviadas, addMensagemEnviada } from '@/lib/firestore'
import type { MensagemEnviada, DestinatarioMensagem, TipoEnvio } from '@/types'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'

export function useMensagensEnviadas() {
  const { usuario } = useAuth()
  const [mensagens, setMensagens] = useState<MensagemEnviada[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onMensagensEnviadas(data => {
      setMensagens(data)
      setLoading(false)
    })
    return unsub
  }, [])

  async function registrar(params: {
    templateId: string
    templateTitulo: string
    tipo: TipoEnvio
    destinatarios: DestinatarioMensagem[]
    periodoAgenda?: string
  }) {
    if (!usuario) return
    const enviados = params.destinatarios.filter(d => d.status === 'enviado').length
    await addMensagemEnviada({
      ...params,
      totalEnviados: enviados,
      totalPulados: params.destinatarios.length - enviados,
      enviadoPor: usuario.uid,
      enviadoEm: Timestamp.now(),
    })
  }

  return { mensagens, loading, registrar }
}
