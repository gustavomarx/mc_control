import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function initAdmin() {
  if (getApps().length > 0) return

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT
  if (serviceAccountEnv) {
    initializeApp({ credential: cert(JSON.parse(serviceAccountEnv)) })
    return
  }

  // Desenvolvimento local: lê o arquivo service-account.json
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('path') as typeof import('path')
    const json = readFileSync(join(process.cwd(), 'service-account.json'), 'utf-8')
    initializeApp({ credential: cert(JSON.parse(json)) })
  } catch {
    // sem credenciais disponíveis (build time) — API routes falharão em runtime se não configurado
  }
}

initAdmin()

export const adminDb = getFirestore()
