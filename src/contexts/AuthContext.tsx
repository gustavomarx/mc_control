'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getUsuario } from '@/lib/firestore'
import type { Usuario, PerfilUsuario, NivelTarefas } from '@/types'

const ROTAS_FINANCEIRO = ['/home', '/dashboard', '/extrato', '/contas', '/dre']

const REMEMBER_KEY = 'mc_remember_me'

interface AuthContextValue {
  user: User | null
  usuario: Usuario | null
  loading: boolean
  perfil: PerfilUsuario | null
  nomeUsuario: string | null
  nivelTarefas: NivelTarefas
  podeAcessar: (rota: string) => boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
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
        const maxAge = localStorage.getItem(REMEMBER_KEY) === '1' ? 2592000 : 3600
        document.cookie = `firebase-token=${token}; path=/; max-age=${maxAge}; SameSite=Strict`
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
          const maxAge = localStorage.getItem(REMEMBER_KEY) === '1' ? 2592000 : 3600
          document.cookie = `user-perfil=${data.perfil}; path=/; max-age=${maxAge}; SameSite=Strict`
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
    const p = usuario.permissoes
    if (!p) return false
    const match = (r: string) => rota === r || rota.startsWith(r + '/')
    if (match('/mensagens')) return p.mensagens
    if (match('/tarefas')) return p.tarefas
    if (match('/agenda')) return p.agenda
    if (match('/crm')) return p.crm
    if (match('/comissoes')) return p.comissoes
    if (match('/caixa')) return p.caixa
    if (ROTAS_FINANCEIRO.some(r => match(r))) return p.financeiro
    return false
  }

  const nivelTarefas: NivelTarefas =
    usuario?.perfil === 'admin' ? 'todos' : (usuario?.permissoes?.tarefasNivel ?? 'equipe')

  async function login(email: string, password: string, rememberMe = false) {
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, '1')
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    localStorage.removeItem(REMEMBER_KEY)
    await signOut(auth)
    window.location.replace('/login')
  }

  return (
    <AuthContext.Provider value={{
      user,
      usuario,
      loading,
      perfil: usuario?.perfil ?? null,
      nomeUsuario: usuario?.nome ?? null,
      nivelTarefas,
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
