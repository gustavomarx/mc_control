'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getUsuario } from '@/lib/firestore'
import type { Usuario, PerfilUsuario } from '@/types'

const ROTAS_ATENDENTE = ['/mensagens', '/tarefas', '/agenda', '/crm']

interface AuthContextValue {
  user: User | null
  usuario: Usuario | null
  loading: boolean
  perfil: PerfilUsuario | null
  nomeUsuario: string | null
  podeAcessar: (rota: string) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken()
        document.cookie = `firebase-token=${token}; path=/; max-age=3600; SameSite=Strict`
        const data = await getUsuario(firebaseUser.uid)
        if (data && data.ativo === false) {
          // Usuário desativado — faz logout
          document.cookie = 'firebase-token=; path=/; max-age=0'
          document.cookie = 'user-perfil=; path=/; max-age=0'
          await signOut(auth)
          setUsuario(null)
          setLoading(false)
          return
        }
        setUsuario(data)
        if (data?.perfil) {
          document.cookie = `user-perfil=${data.perfil}; path=/; max-age=3600; SameSite=Strict`
        }
      } else {
        document.cookie = 'firebase-token=; path=/; max-age=0'
        document.cookie = 'user-perfil=; path=/; max-age=0'
        setUsuario(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  function podeAcessar(rota: string): boolean {
    if (!usuario) return false
    if (usuario.perfil === 'admin') return true
    return ROTAS_ATENDENTE.some(r => rota === r || rota.startsWith(r + '/'))
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{
      user,
      usuario,
      loading,
      perfil: usuario?.perfil ?? null,
      nomeUsuario: usuario?.nome ?? null,
      podeAcessar,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
