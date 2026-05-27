'use client'

import { useState } from 'react'
import { useFacebookAds, type FbPeriod } from '@/hooks/useFacebookAds'
import type { FacebookCampaign, FbAdSet, FbAd } from '@/types'

// ── Helpers de formatação ─────────────────────────────────────────────────────

const PERIOD_LABELS: Record<FbPeriod, string> = {
  today:      'Hoje',
  yesterday:  'Ontem',
  last_7d:    '7 dias',
  last_30d:   '30 dias',
  this_month: 'Este mês',
}

function fmtBRL(value: string | number | undefined): string {
  const n = parseFloat(String(value ?? 0))
  if (isNaN(n) || n === 0) return 'R$ —'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtNum(value: string | number | undefined): string {
  const n = parseInt(String(value ?? 0))
  if (isNaN(n) || n === 0) return '—'
  return n.toLocaleString('pt-BR')
}

function fmtPct(value: string | number | undefined): string {
  const n = parseFloat(String(value ?? 0))
  if (isNaN(n) || n === 0) return '—'
  return `${n.toFixed(2)}%`
}

// ── Status config ─────────────────────────────────────────────────────────────

type CampaignStatusTab = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

const STATUS_TABS: { v: CampaignStatusTab; label: string }[] = [
  { v: 'ACTIVE',   label: 'Ativas' },
  { v: 'PAUSED',   label: 'Pausadas' },
  { v: 'ARCHIVED', label: 'Arquivadas' },
]

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:   'bg-emerald-100 text-emerald-700',
  PAUSED:   'bg-yellow-100 text-yellow-700',
  ARCHIVED: 'bg-gray-100 text-gray-500',
  DELETED:  'bg-red-100 text-red-600',
}

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE:      'Saiba mais',
  SHOP_NOW:        'Comprar agora',
  BOOK_TRAVEL:     'Reservar',
  SIGN_UP:         'Cadastrar',
  CONTACT_US:      'Fale conosco',
  GET_QUOTE:       'Solicitar orçamento',
  SUBSCRIBE:       'Assinar',
  WATCH_MORE:      'Ver mais',
  MESSAGE_PAGE:    'Enviar mensagem',
  WHATSAPP_MESSAGE:'Enviar mensagem',
  SEND_MESSAGE:    'Enviar mensagem',
  CALL_NOW:        'Ligar agora',
  GET_DIRECTIONS:  'Como chegar',
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-700">{value}</p>
    </div>
  )
}

function AdCard({ ad }: { ad: FbAd }) {
  const c = ad.creative
  const hasImage = !!c.image_url

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      {/* Preview do criativo */}
      {hasImage && (
        <div className="w-full bg-gray-100 overflow-hidden" style={{ aspectRatio: '4/5' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.image_url}
            alt={c.title || ad.name}
            className="w-full h-full object-contain"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      <div className="p-3">
        {/* Badge status + nome */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[ad.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {ad.status === 'ACTIVE' ? 'Ativo' : ad.status === 'PAUSED' ? 'Pausado' : ad.status}
          </span>
          <span className="text-xs text-gray-400 truncate">{ad.name}</span>
        </div>

        {/* Conteúdo do criativo */}
        {c.title && (
          <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">{c.title}</p>
        )}
        {c.body && (
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-3 mb-1">{c.body}</p>
        )}
        {c.description && (
          <p className="text-xs text-gray-400 leading-snug line-clamp-2 mb-2">{c.description}</p>
        )}
        {c.call_to_action && (
          <span className="inline-block text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
            {CTA_LABELS[c.call_to_action] ?? c.call_to_action}
          </span>
        )}

        {/* Métricas */}
        {parseFloat(ad.spend) > 0 && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-50">
            <MetricPill label="Gasto" value={fmtBRL(ad.spend)} />
            <MetricPill label="Impressões" value={fmtNum(ad.impressions)} />
            <MetricPill label="Cliques" value={fmtNum(ad.clicks)} />
            <MetricPill label="CTR" value={fmtPct(ad.ctr)} />
          </div>
        )}
      </div>
    </div>
  )
}

function AdsetRow({
  adset, expanded, loading, ads, error,
  onExpand,
}: {
  adset: FbAdSet
  expanded: boolean
  loading: boolean
  ads: FbAd[] | undefined
  error?: string
  onExpand: () => void
}) {
  return (
    <div className="ml-6 border-l-2 border-gray-100 pl-4">
      {/* Linha do conjunto */}
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-2 py-2 text-left hover:bg-gray-50 rounded-lg px-2 -ml-2 transition-colors group"
      >
        <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-xs">
          {loading ? '⟳' : expanded ? '▾' : '▸'}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_BADGE[adset.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {adset.status === 'ACTIVE' ? 'Ativo' : adset.status === 'PAUSED' ? 'Pausado' : adset.status}
        </span>
        <span className="text-sm text-gray-700 font-medium truncate flex-1">{adset.name}</span>
        <span className="text-xs text-gray-400 shrink-0 ml-auto">
          {parseFloat(adset.spend) > 0 && fmtBRL(adset.spend)}
        </span>
      </button>

      {/* Anúncios */}
      {expanded && (
        <div className="mt-2 mb-3">
          {loading ? (
            <p className="text-xs text-gray-400 py-2 pl-2">Carregando anúncios...</p>
          ) : error ? (
            <p className="text-xs text-red-500 py-2 pl-2">{error}</p>
          ) : !ads?.length ? (
            <p className="text-xs text-gray-400 py-2 pl-2">Nenhum anúncio encontrado.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ml-4 mt-1">
              {ads.map(ad => <AdCard key={ad.id} ad={ad} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CampaignRow({
  campaign, expanded, loading,
  adsets: campaignAdsets,
  expandedAdsets, loadingItems,
  adsMap, expandErrors,
  onExpand, onExpandAdset,
}: {
  campaign: FacebookCampaign
  expanded: boolean
  loading: boolean
  adsets: FbAdSet[] | undefined
  expandedAdsets: Set<string>
  loadingItems: Set<string>
  adsMap: Map<string, FbAd[]>
  expandErrors: Map<string, string>
  onExpand: () => void
  onExpandAdset: (id: string) => void
}) {
  const campaignError = expandErrors.get(campaign.id)

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      {/* Linha da campanha */}
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors group"
      >
        <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-sm font-mono">
          {loading ? '⟳' : expanded ? '▾' : '▸'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{campaign.name}</p>
          {campaign.objective && (
            <p className="text-xs text-gray-400 mt-0.5">{campaign.objective.replace(/_/g, ' ').toLowerCase()}</p>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {parseFloat(campaign.spend) > 0 && (
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{fmtBRL(campaign.spend)}</p>
              <p className="text-xs text-gray-400">{fmtNum(campaign.impressions)} imp.</p>
            </div>
          )}
          {campaign.daily_budget && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400">Orç. diário</p>
              <p className="text-xs font-medium text-gray-600">{fmtBRL(parseInt(campaign.daily_budget) / 100)}</p>
            </div>
          )}
        </div>
      </button>

      {/* Conjuntos de anúncios */}
      {expanded && (
        <div className="border-t border-gray-50 px-4 pb-3 pt-2">
          {loading ? (
            <p className="text-xs text-gray-400 py-2">Carregando conjuntos...</p>
          ) : campaignError ? (
            <p className="text-xs text-red-500 py-2">{campaignError}</p>
          ) : !campaignAdsets?.length ? (
            <p className="text-xs text-gray-400 py-2">Nenhum conjunto encontrado.</p>
          ) : (
            <div className="space-y-1">
              {campaignAdsets.map(adset => (
                <AdsetRow
                  key={adset.id}
                  adset={adset}
                  expanded={expandedAdsets.has(adset.id)}
                  loading={loadingItems.has(adset.id)}
                  ads={adsMap.get(adset.id)}
                  error={expandErrors.get(adset.id)}
                  onExpand={() => onExpandAdset(adset.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function FacebookAdsPage() {
  const {
    config, accounts, selectedAccountId, setSelectedAccountId,
    period, setPeriod,
    accountData, campaigns,
    loadingConfig, loadingData, error,
    adsets, ads, expandedCampaigns, expandedAdsets, loadingItems, expandErrors,
    expandCampaign, expandAdset,
    salvarConfig, refresh,
  } = useFacebookAds()

  const [statusTab, setStatusTab] = useState<CampaignStatusTab>('ACTIVE')
  const [showConfig, setShowConfig] = useState(false)
  const [configToken, setConfigToken] = useState('')
  const [configDefault, setConfigDefault] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)

  const filteredCampaigns = campaigns.filter(c => c.status === statusTab)
  const countsByStatus = {
    ACTIVE:   campaigns.filter(c => c.status === 'ACTIVE').length,
    PAUSED:   campaigns.filter(c => c.status === 'PAUSED').length,
    ARCHIVED: campaigns.filter(c => c.status === 'ARCHIVED').length,
  }

  async function handleSaveConfig() {
    if (!configToken.trim()) return
    setSavingConfig(true)
    try {
      await salvarConfig(configToken.trim(), configDefault)
      setShowConfig(false)
    } finally {
      setSavingConfig(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-xl font-bold text-gray-900">Facebook Ads</h1>
          <div className="flex items-center gap-2">
            <button onClick={refresh} disabled={loadingData}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition-colors disabled:opacity-40">
              ↻ Atualizar
            </button>
            {selectedAccountId && (
              <a
                href={(() => {
                  const id = selectedAccountId.replace('act_', '')
                  return `https://business.facebook.com/billing_hub/accounts/details/?business_id=113059308505656&asset_id=${id}&payment_account_id=${id}&placement=ads_manager&entrypoint=ads_ecosystem_navigation_ads_billing_tool_plugin&payment_account_id_from_jsmodule=${id}`
                })()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
              >
                + Recarregar conta
              </a>
            )}
            <button onClick={() => { setConfigToken(''); setConfigDefault(config?.defaultAccountId ?? ''); setShowConfig(true) }}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition-colors">
              ⚙ Configurar
            </button>
          </div>
        </div>

        {loadingConfig ? (
          <p className="text-sm text-gray-400 text-center py-16">Carregando...</p>
        ) : (
          <>
            {/* Seletor de conta */}
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 flex-wrap mb-4">
              {accounts.map(acc => (
                <button key={acc.id} onClick={() => setSelectedAccountId(acc.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    selectedAccountId === acc.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}>
                  {acc.id === config?.defaultAccountId ? '★ ' : ''}{acc.name}
                </button>
              ))}
            </div>

            {/* Seletor de período */}
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit mb-6">
              {(Object.keys(PERIOD_LABELS) as FbPeriod[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    period === p ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
                {error.includes('Token') || error.includes('token') || error.includes('configurado')
                  ? 'Token não configurado ou expirado. Clique em ⚙ Configurar.'
                  : error}
              </div>
            )}

            {/* Cards de saldo + métricas */}
            {loadingData ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                    <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" /><div className="h-6 bg-gray-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : accountData ? (
              <>
                {/* Saldo em destaque */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="bg-blue-600 rounded-xl p-5 text-white">
                    <p className="text-xs text-blue-200 mb-1">Saldo atual</p>
                    <p className="text-3xl font-bold">
                      {accountData.balance > 0 ? fmtBRL(accountData.balance) : '—'}
                    </p>
                    {accountData.balance === 0 && (
                      <p className="text-xs text-blue-300 mt-1">Conta pós-paga</p>
                    )}
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <p className="text-xs text-gray-400 mb-1">Gasto no período</p>
                    <p className="text-2xl font-bold text-gray-900">{fmtBRL(accountData.spend)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{PERIOD_LABELS[period]}</p>
                  </div>
                </div>

                {/* Métricas do período */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: 'Impressões',  value: fmtNum(accountData.impressions) },
                    { label: 'Alcance',     value: fmtNum(accountData.reach) },
                    { label: 'Cliques',     value: fmtNum(accountData.clicks) },
                    { label: 'CTR médio',   value: fmtPct(accountData.ctr) },
                    { label: 'CPC médio',   value: fmtBRL(accountData.cpc) },
                  ].map(m => (
                    <div key={m.label} className="bg-white border border-gray-100 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">{m.label}</p>
                      <p className="text-lg font-bold text-gray-900">{m.value}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {/* Abas de status de campanhas */}
            {!loadingData && campaigns.length > 0 && (
              <>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 w-fit">
                  {STATUS_TABS.map(({ v, label }) => (
                    <button key={v} onClick={() => setStatusTab(v)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        statusTab === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      {label}
                      {countsByStatus[v] > 0 && (
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                          statusTab === v ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {countsByStatus[v]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Árvore de campanhas */}
                {filteredCampaigns.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">
                    Nenhuma campanha {statusTab === 'ACTIVE' ? 'ativa' : statusTab === 'PAUSED' ? 'pausada' : 'arquivada'}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredCampaigns.map(campaign => (
                      <CampaignRow
                        key={campaign.id}
                        campaign={campaign}
                        expanded={expandedCampaigns.has(campaign.id)}
                        loading={loadingItems.has(campaign.id)}
                        adsets={adsets.get(campaign.id)}
                        expandedAdsets={expandedAdsets}
                        loadingItems={loadingItems}
                        adsMap={ads}
                        expandErrors={expandErrors}
                        onExpand={() => expandCampaign(campaign.id)}
                        onExpandAdset={expandAdset}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Modal de configuração */}
        {showConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Configurar Facebook Ads</h2>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Access Token</label>
                <input type="password" value={configToken} onChange={e => setConfigToken(e.target.value)}
                  placeholder="EAAxxxxxxxxxxxxxxxx"
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Meta Developers → System User → Generate Token</p>
              </div>
              <div className="mb-6">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Conta padrão</label>
                <select value={configDefault} onChange={e => setConfigDefault(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowConfig(false)} className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors">Cancelar</button>
                <button onClick={handleSaveConfig} disabled={savingConfig || !configToken.trim()}
                  className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                  {savingConfig ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
