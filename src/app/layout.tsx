import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Studio Meus Cílios — Financeiro',
  description: 'Sistema financeiro interno — G&G Company LTDA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 text-gray-900 antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
