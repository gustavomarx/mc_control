import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import type { FacebookAdsConfig } from '@/types'

const FB_API = 'https://graph.facebook.com/v19.0'

async function getConfig(): Promise<FacebookAdsConfig | null> {
  const snap = await adminDb.collection('config').doc('facebook_ads').get()
  return snap.exists ? (snap.data() as FacebookAdsConfig) : null
}

function centsToDecimal(val: string | number | undefined): number {
  const n = parseInt(String(val ?? 0))
  return isNaN(n) ? 0 : n / 100
}

// Extrai título, corpo, descrição e imagem do creative de forma unificada
function parseCreative(c: Record<string, unknown>) {
  const spec = (c.object_story_spec ?? {}) as Record<string, Record<string, unknown>>
  const link  = spec.link_data  ?? {}
  const video = spec.video_data ?? {}
  const photo = spec.photo_data ?? {}

  const title = (c.title ?? link.name ?? video.title ?? '') as string
  const body  = (c.body  ?? link.message ?? video.message ?? photo.caption ?? '') as string
  const description = (c.description ?? link.description ?? video.description ?? '') as string
  const cta = (
    (link.call_to_action as Record<string, string>)?.type ??
    (video.call_to_action as Record<string, string>)?.type ?? ''
  ) as string
  const image_url = (c.image_url ?? video.image_url ?? '') as string
  const thumbnail_url = (c.thumbnail_url ?? '') as string

  return { title, body, description, image_url, thumbnail_url, call_to_action: cta }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type       = searchParams.get('type')
  const accountId  = searchParams.get('accountId')
  const campaignId = searchParams.get('campaignId')
  const adsetId    = searchParams.get('adsetId')
  const period     = searchParams.get('period') ?? 'last_7d'

  const config = await getConfig()
  if (!config?.token) {
    return NextResponse.json({ error: 'Token do Facebook não configurado' }, { status: 503 })
  }
  const token = config.token

  try {
    // ── Conta + insights do período ──────────────────────────────────────────
    if (type === 'account') {
      if (!accountId) return NextResponse.json({ error: 'accountId obrigatório' }, { status: 400 })

      const [accRes, insRes] = await Promise.all([
        fetch(`${FB_API}/${accountId}?fields=name,currency,balance,amount_spent,spend_cap&access_token=${token}`),
        fetch(`${FB_API}/${accountId}/insights?fields=impressions,clicks,spend,ctr,cpc,cpm,reach&date_preset=${period}&access_token=${token}`),
      ])
      const acc = await accRes.json()
      const ins = await insRes.json()
      if (acc.error) return NextResponse.json({ error: acc.error.message }, { status: 400 })

      const d = ins.data?.[0] ?? {}
      return NextResponse.json({
        id: accountId,
        name: acc.name,
        currency: acc.currency,
        balance:      centsToDecimal(acc.balance),
        amount_spent: centsToDecimal(acc.amount_spent),
        spend_cap:    centsToDecimal(acc.spend_cap),
        spend:       d.spend       ?? '0',
        impressions: d.impressions ?? '0',
        clicks:      d.clicks      ?? '0',
        ctr:         d.ctr         ?? '0',
        cpc:         d.cpc         ?? '0',
        cpm:         d.cpm         ?? '0',
        reach:       d.reach       ?? '0',
      })
    }

    // ── Campanhas + insights por campanha ────────────────────────────────────
    if (type === 'campaigns') {
      if (!accountId) return NextResponse.json({ error: 'accountId obrigatório' }, { status: 400 })

      const res = await fetch(
        `${FB_API}/${accountId}/campaigns?fields=name,status,objective,daily_budget,lifetime_budget&limit=100&access_token=${token}`
      )
      const data = await res.json()
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })

      const campaigns = data.data ?? []
      const withInsights = await Promise.all(
        campaigns.map(async (c: Record<string, string>) => {
          try {
            const ir = await fetch(`${FB_API}/${c.id}/insights?fields=spend,impressions,clicks,ctr,cpc&date_preset=${period}&access_token=${token}`)
            const id = (await ir.json()).data?.[0] ?? {}
            return { ...c, spend: id.spend ?? '0', impressions: id.impressions ?? '0', clicks: id.clicks ?? '0', ctr: id.ctr ?? '0', cpc: id.cpc ?? '0' }
          } catch {
            return { ...c, spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0' }
          }
        })
      )
      return NextResponse.json(withInsights)
    }

    // ── Conjuntos de anúncios de uma campanha ────────────────────────────────
    if (type === 'adsets') {
      if (!campaignId) return NextResponse.json({ error: 'campaignId obrigatório' }, { status: 400 })

      const res = await fetch(
        `${FB_API}/${campaignId}/adsets?fields=name,status,daily_budget,lifetime_budget&limit=50&access_token=${token}`
      )
      const data = await res.json()
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })

      const adsets = data.data ?? []
      const withInsights = await Promise.all(
        adsets.map(async (a: Record<string, string>) => {
          try {
            const ir = await fetch(`${FB_API}/${a.id}/insights?fields=spend,impressions,clicks,ctr,cpc&date_preset=${period}&access_token=${token}`)
            const id = (await ir.json()).data?.[0] ?? {}
            return { ...a, spend: id.spend ?? '0', impressions: id.impressions ?? '0', clicks: id.clicks ?? '0', ctr: id.ctr ?? '0', cpc: id.cpc ?? '0' }
          } catch {
            return { ...a, spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0' }
          }
        })
      )
      return NextResponse.json(withInsights)
    }

    // ── Anúncios de um conjunto + criativo ───────────────────────────────────
    if (type === 'ads') {
      if (!adsetId) return NextResponse.json({ error: 'adsetId obrigatório' }, { status: 400 })

      const res = await fetch(
        `${FB_API}/${adsetId}/ads?fields=name,status,creative{title,body,description,image_url,thumbnail_url,object_story_spec}&limit=50&access_token=${token}`
      )
      const data = await res.json()
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })

      const ads = data.data ?? []
      const withInsights = await Promise.all(
        ads.map(async (a: Record<string, unknown>) => {
          const creative = parseCreative((a.creative as Record<string, unknown>) ?? {})
          try {
            const ir = await fetch(`${FB_API}/${a.id}/insights?fields=spend,impressions,clicks,ctr,cpc&date_preset=${period}&access_token=${token}`)
            const id = (await ir.json()).data?.[0] ?? {}
            return { id: a.id, name: a.name, status: a.status, creative, spend: id.spend ?? '0', impressions: id.impressions ?? '0', clicks: id.clicks ?? '0', ctr: id.ctr ?? '0', cpc: id.cpc ?? '0' }
          } catch {
            return { id: a.id, name: a.name, status: a.status, creative, spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0' }
          }
        })
      )
      return NextResponse.json(withInsights)
    }

    return NextResponse.json({ error: 'type inválido' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST — salva configuração (token + contas + padrão)
export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<FacebookAdsConfig>
  if (!body.token || !body.accounts || !body.defaultAccountId) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }
  await adminDb.collection('config').doc('facebook_ads').set(body)
  return NextResponse.json({ ok: true })
}
