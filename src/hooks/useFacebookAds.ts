'use client'

import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { FacebookAdsConfig, FacebookAccountInsights, FacebookCampaign, FbAdSet, FbAd } from '@/types'

export type FbPeriod = 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'this_month'

const ACCOUNTS_DEFAULT = [
  { id: 'act_553766771341805', name: 'Gabriela Coelho da Silva' },
  { id: 'act_328753162290173', name: 'Meus Cilios BC' },
  { id: 'act_566087169010995', name: 'Meus Cílios São José' },
  { id: 'act_397171356620861', name: 'Meus Cílios BC 2' },
  { id: 'act_1183075240210568', name: 'Meus Cílios São José (Novo)' },
]

function sortAccountsDefaultFirst(accounts: { id: string; name: string }[], defaultId: string) {
  return [...accounts].sort((a, b) => {
    if (a.id === defaultId) return -1
    if (b.id === defaultId) return 1
    return 0
  })
}

export function useFacebookAds() {
  const [config, setConfig] = useState<FacebookAdsConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)

  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [period, setPeriod] = useState<FbPeriod>('last_7d')

  const [accountData, setAccountData] = useState<FacebookAccountInsights | null>(null)
  const [campaigns, setCampaigns] = useState<FacebookCampaign[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Árvore: campanha → conjuntos → anúncios
  const [adsets, setAdsets] = useState<Map<string, FbAdSet[]>>(new Map())
  const [ads, setAds] = useState<Map<string, FbAd[]>>(new Map())
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set())
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set())
  const [expandErrors, setExpandErrors] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    getDoc(doc(db, 'config', 'facebook_ads')).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as FacebookAdsConfig
        const sorted = sortAccountsDefaultFirst(data.accounts, data.defaultAccountId)
        setConfig({ ...data, accounts: sorted })
        setSelectedAccountId(data.defaultAccountId)
      } else {
        const sorted = sortAccountsDefaultFirst(ACCOUNTS_DEFAULT, ACCOUNTS_DEFAULT[1].id)
        setConfig({ token: '', accounts: sorted, defaultAccountId: ACCOUNTS_DEFAULT[1].id })
        setSelectedAccountId(ACCOUNTS_DEFAULT[1].id)
      }
      setLoadingConfig(false)
    })
  }, [])

  const fetchData = useCallback(async (accountId: string, p: FbPeriod) => {
    if (!accountId) return
    setLoadingData(true)
    setError(null)
    setAdsets(new Map())
    setAds(new Map())
    setExpandedCampaigns(new Set())
    setExpandedAdsets(new Set())
    try {
      const [accRes, campRes] = await Promise.all([
        fetch(`/api/facebook?type=account&accountId=${accountId}&period=${p}`),
        fetch(`/api/facebook?type=campaigns&accountId=${accountId}&period=${p}`),
      ])
      const [accData, campData] = await Promise.all([accRes.json(), campRes.json()])
      if (accData.error) { setError(accData.error); return }
      setAccountData(accData)
      setCampaigns(Array.isArray(campData) ? campData : [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (selectedAccountId) fetchData(selectedAccountId, period)
  }, [selectedAccountId, period, fetchData])

  async function expandCampaign(campaignId: string) {
    if (expandedCampaigns.has(campaignId)) {
      setExpandedCampaigns(prev => { const s = new Set(prev); s.delete(campaignId); return s })
      return
    }
    setExpandedCampaigns(prev => new Set(prev).add(campaignId))

    if (adsets.has(campaignId)) return

    setLoadingItems(prev => new Set(prev).add(campaignId))
    setExpandErrors(prev => { const m = new Map(prev); m.delete(campaignId); return m })
    try {
      const res = await fetch(`/api/facebook?type=adsets&campaignId=${campaignId}&period=${period}`)
      const data = await res.json()
      if (data?.error) {
        setExpandErrors(prev => new Map(prev).set(campaignId, String(data.error)))
        setAdsets(prev => new Map(prev).set(campaignId, []))
      } else {
        setAdsets(prev => new Map(prev).set(campaignId, Array.isArray(data) ? data : []))
      }
    } catch (e) {
      setExpandErrors(prev => new Map(prev).set(campaignId, String(e)))
      setAdsets(prev => new Map(prev).set(campaignId, []))
    } finally {
      setLoadingItems(prev => { const s = new Set(prev); s.delete(campaignId); return s })
    }
  }

  async function expandAdset(adsetId: string) {
    if (expandedAdsets.has(adsetId)) {
      setExpandedAdsets(prev => { const s = new Set(prev); s.delete(adsetId); return s })
      return
    }
    setExpandedAdsets(prev => new Set(prev).add(adsetId))

    if (ads.has(adsetId)) return

    setLoadingItems(prev => new Set(prev).add(adsetId))
    setExpandErrors(prev => { const m = new Map(prev); m.delete(adsetId); return m })
    try {
      const res = await fetch(`/api/facebook?type=ads&adsetId=${adsetId}&period=${period}`)
      const data = await res.json()
      if (data?.error) {
        setExpandErrors(prev => new Map(prev).set(adsetId, String(data.error)))
        setAds(prev => new Map(prev).set(adsetId, []))
      } else {
        setAds(prev => new Map(prev).set(adsetId, Array.isArray(data) ? data : []))
      }
    } catch (e) {
      setExpandErrors(prev => new Map(prev).set(adsetId, String(e)))
      setAds(prev => new Map(prev).set(adsetId, []))
    } finally {
      setLoadingItems(prev => { const s = new Set(prev); s.delete(adsetId); return s })
    }
  }

  async function salvarConfig(token: string, defaultAccountId: string) {
    const rawAccounts = config?.accounts ?? ACCOUNTS_DEFAULT
    const accounts = sortAccountsDefaultFirst(rawAccounts, defaultAccountId)
    const newConfig: FacebookAdsConfig = { token, accounts, defaultAccountId }
    await fetch('/api/facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    })
    await setDoc(doc(db, 'config', 'facebook_ads'), newConfig)
    setConfig(newConfig)
    setSelectedAccountId(defaultAccountId)
  }

  return {
    config,
    loadingConfig,
    accounts: config?.accounts ?? sortAccountsDefaultFirst(ACCOUNTS_DEFAULT, ACCOUNTS_DEFAULT[1].id),
    selectedAccountId,
    setSelectedAccountId,
    period,
    setPeriod,
    accountData,
    campaigns,
    loadingData,
    error,
    adsets,
    ads,
    expandedCampaigns,
    expandedAdsets,
    loadingItems,
    expandErrors,
    expandCampaign,
    expandAdset,
    salvarConfig,
    refresh: () => fetchData(selectedAccountId, period),
  }
}
