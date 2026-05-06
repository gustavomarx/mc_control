import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { join } from 'path'

function initAdmin() {
  if (getApps().length > 0) return

  // Produção (Vercel): variável de ambiente com o JSON do service account
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT
  if (serviceAccountEnv) {
    initializeApp({ credential: cert(JSON.parse(serviceAccountEnv)) })
    return
  }

  // Desenvolvimento local: lê o arquivo service-account.json na raiz do projeto
  const json = readFileSync(join(process.cwd(), 'service-account.json'), 'utf-8')
  initializeApp({ credential: cert(JSON.parse(json)) })
}

initAdmin()

export const adminDb = getFirestore()
