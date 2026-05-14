'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      await login(email, senha)
      router.push('/dashboard')
    } catch {
      setErro('E-mail ou senha incorretos.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(145deg, #4A1228 0%, #2e0b1c 60%, #1a0510 100%)',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Radial ornament */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,149,107,.08) 0%, transparent 70%)',
        top: -100, right: -100,
        pointerEvents: 'none',
      }} />

      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '40px 36px',
        width: 'min(420px, 100%)',
        boxShadow: '0 24px 64px rgba(0,0,0,.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', paddingBottom: 8, borderBottom: '1px solid #F5E8DD' }}>
          <div style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, #C9956B, #b87f56)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(201,149,107,.35)',
          }}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, fontWeight: 600, color: '#4A1228', letterSpacing: '.02em' }}>
              Studio Meus Cílios
            </span>
            <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 400, color: '#8B6E6A', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              ✦ &nbsp;Painel de Gestão
            </span>
          </div>
        </div>

        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: '#4A1228', textAlign: 'center', margin: 0 }}>
          Acesso ao Sistema
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8B6E6A', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              className="input"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8B6E6A', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Senha
            </label>
            <input
              type="password"
              required
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="input"
            />
          </div>

          {erro && (
            <p style={{ fontSize: 13, background: '#fff1f2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', margin: 0 }}>
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="btn-primary"
            style={{ marginTop: 4, width: '100%', padding: '14px', fontSize: 15, letterSpacing: '.06em' }}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#8B6E6A', paddingTop: 4, borderTop: '1px solid #F5E8DD' }}>
          Studio Meus Cílios &mdash; Uso interno
        </div>
      </div>
    </div>
  )
}
