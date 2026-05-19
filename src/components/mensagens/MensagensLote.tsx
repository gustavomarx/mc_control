'use client'

import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import type { MensagemTemplate } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgendamentoRaw {
  dataReserva: string
  hora: string
  cliente: string
  celular: string
  profissional: string
  servico: string
  status: string
}

interface RegistroProcessado extends AgendamentoRaw {
  servicos: string[]
  profissionais: string[]
}

// ── Utilities ──────────────────────────────────────────────────────────────────

const STATUS_OPCOES = ['Agendado', 'Confirmado', 'Aguardando', 'Em Atendimento', 'Pago', 'Finalizado', 'Faltou', 'Cancelado', 'Recuperacao']

function normalizarData(v: unknown): string {
  if (!v) return ''
  const s = String(v).trim()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.split('-')
    return `${d.slice(0, 2)}/${m}/${y}`
  }
  const n = parseFloat(s)
  if (!isNaN(n) && n > 1000) {
    const date = new Date(Math.round((n - 25569) * 86400 * 1000))
    return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`
  }
  return s
}

function normalizarHora(v: unknown): string {
  if (!v) return ''
  const s = String(v).trim()
  const match = s.match(/^(\d{1,2}):(\d{2})/)
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`
  const n = parseFloat(s)
  if (!isNaN(n) && n >= 0 && n < 1) {
    const totalMin = Math.round(n * 24 * 60)
    const h = Math.floor(totalMin / 60) % 24
    const m = totalMin % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return s
}

function sanitizarPhone(v: string): string {
  return (v || '').replace(/\D/g, '')
}

function formatTel(t: string): string {
  if (!t || t.length < 10) return t
  if (t.length === 11) return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`
  if (t.length === 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`
  return t
}

function lerXlsx(arrayBuffer: ArrayBuffer): AgendamentoRaw[] {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false, raw: false, dateNF: 'dd/mm/yyyy' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, dateNF: 'dd/mm/yyyy', defval: '' })
  if (rows.length < 2) return []

  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const lower = rows[i].map(c => String(c).toLowerCase())
    if (lower.some(c => c.includes('cliente') || c.includes('hora'))) { headerIdx = i; break }
  }
  if (headerIdx === -1) headerIdx = 0

  const headers = rows[headerIdx].map(c => String(c).toLowerCase().trim())
  function col(nomes: string[]): number {
    for (const n of nomes) { const idx = headers.findIndex(h => h.includes(n)); if (idx >= 0) return idx }
    return -1
  }
  const C = {
    dataReserva:  col(['data reserva', 'data da reserva', 'data']),
    hora:         col(['hora']),
    cliente:      col(['cliente', 'nome']),
    celular:      col(['celular', 'telefone', 'fone', 'whatsapp']),
    profissional: col(['profissional']),
    servico:      col(['serviço', 'servico', 'servi']),
    status:       col(['status']),
  }

  const registros: AgendamentoRaw[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    const cliente = String(r[C.cliente] ?? '').trim()
    if (!cliente) continue
    registros.push({
      dataReserva:  normalizarData(r[C.dataReserva]),
      hora:         normalizarHora(r[C.hora]),
      cliente,
      celular:      sanitizarPhone(String(r[C.celular] ?? '')),
      profissional: String(r[C.profissional] ?? '').trim(),
      servico:      String(r[C.servico] ?? '').trim().replace(/^\d+\.\s*/, ''),
      status:       String(r[C.status] ?? '').trim(),
    })
  }
  return registros
}

function normStatus(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function filtrarEDeduplicar(registros: AgendamentoRaw[], statusFiltro: string[]): RegistroProcessado[] {
  const filtroNorm = statusFiltro.map(normStatus)
  const lista = filtroNorm.length === 0
    ? registros
    : registros.filter(r => filtroNorm.includes(normStatus(r.status)))

  const map = new Map<string, RegistroProcessado>()
  for (const r of lista) {
    const chave = r.celular || r.cliente.toLowerCase().trim()
    if (!map.has(chave)) {
      map.set(chave, { ...r, servicos: r.servico ? [r.servico] : [], profissionais: r.profissional ? [r.profissional] : [] })
    } else {
      const merged = map.get(chave)!
      if (r.servico && !merged.servicos.includes(r.servico)) merged.servicos.push(r.servico)
      if (r.profissional && !merged.profissionais.includes(r.profissional)) merged.profissionais.push(r.profissional)
      if (r.hora < merged.hora) merged.hora = r.hora
    }
  }
  return Array.from(map.values()).sort((a, b) => a.hora.localeCompare(b.hora))
}

function gerarMensagem(r: RegistroProcessado, studio: string, templateTxt: string): string {
  const primeiroNome = r.cliente.split(' ')[0]
  const servicosTexto = r.servicos.length ? r.servicos.join(' + ') : r.servico
  const profs = (r.profissionais.length ? r.profissionais : r.profissional ? [r.profissional] : []).map(p => p.split(' ')[0])
  let prof = 'nossa profissional'
  if (profs.length === 1) prof = `a profissional ${profs[0]}`
  else if (profs.length > 1) {
    const ultimas = profs.slice(-2).join(' e ')
    const anteriores = profs.slice(0, -2)
    prof = `as profissionais ${anteriores.length ? anteriores.join(', ') + ', ' + ultimas : ultimas}`
  }
  return templateTxt
    .replace(/{data}/g, r.dataReserva)
    .replace(/{hora}/g, r.hora)
    .replace(/{studio}/g, studio || 'nosso studio')
    .replace(/{nome}/g, primeiroNome)
    .replace(/{servicos}/g, servicosTexto)
    .replace(/{profissional}/g, prof)
}

function buildWaUrl(celular: string, texto: string): string {
  const p = sanitizarPhone(celular)
  const e = encodeURIComponent(texto)
  return p ? `https://web.whatsapp.com/send?phone=55${p}&text=${e}` : `https://web.whatsapp.com/send?text=${e}`
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  templates: MensagemTemplate[]
  isAdmin: boolean
  onAbrirTemplates: () => void
}

export default function MensagensLote({ templates, isAdmin, onAbrirTemplates }: Props) {
  const [templateAtivo, setTemplateAtivo] = useState<MensagemTemplate | null>(templates[0] ?? null)
  const [textoEditado, setTextoEditado] = useState(templates[0]?.conteudo ?? '')

  const [dadosImportados, setDadosImportados] = useState<AgendamentoRaw[]>([])
  const [nomeArquivo, setNomeArquivo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const [statusSelecionados, setStatusSelecionados] = useState<Set<string>>(new Set())
  const [studioNome, setStudioNome] = useState('Studio Meus Cílios - São José')

  const [comTelefone, setComTelefone] = useState<RegistroProcessado[]>([])
  const [semTelefone, setSemTelefone] = useState<RegistroProcessado[]>([])
  const [mostrarResultados, setMostrarResultados] = useState(false)
  const [mensagensOverride, setMensagensOverride] = useState<Record<number, string>>({})
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null)
  const [editBuffer, setEditBuffer] = useState('')
  const [enviadas, setEnviadas] = useState<Set<number>>(new Set())
  const [cardsSelecionados, setCardsSelecionados] = useState<Set<number>>(new Set())

  const [modalAjudaExtensao, setModalAjudaExtensao] = useState(false)
  const [modalConfirm, setModalConfirm] = useState(false)
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [delayMin, setDelayMin] = useState(20)
  const [delayMax, setDelayMax] = useState(45)
  const abortadoRef = useRef(false)
  const skipDelayRef = useRef(false)
  const waTabRef = useRef<Window | null>(null)
  const proximoResolveRef = useRef<(() => void) | null>(null)

  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Sync textoEditado when templates change (e.g. after Firestore update)
  useEffect(() => {
    if (templates.length > 0 && !templateAtivo) {
      setTemplateAtivo(templates[0])
      setTextoEditado(templates[0].conteudo)
    }
  }, [templates, templateAtivo])

  function showToast(msg: string) {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  // ── Templates ────────────────────────────────────────────────────────────────

  const isEditado = templateAtivo ? textoEditado !== templateAtivo.conteudo : false

  function selecionarTemplate(t: MensagemTemplate) {
    setTemplateAtivo(t)
    setTextoEditado(t.conteudo)
    if (t.statusPadrao?.length) setStatusSelecionados(new Set(t.statusPadrao))
  }

  function restaurarTemplate() {
    if (!templateAtivo) return
    if (!isEditado) { showToast('Já está no padrão'); return }
    if (confirm(`Restaurar "${templateAtivo.titulo}" para o texto original?`)) {
      setTextoEditado(templateAtivo.conteudo)
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────────

  function processarArquivo(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls'].includes(ext ?? '')) {
      alert('Selecione um arquivo .xlsx ou .xls exportado do Avec SalãoVIP.'); return
    }
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const dados = lerXlsx(e.target!.result as ArrayBuffer)
        setDadosImportados(dados)
        setNomeArquivo(file.name)
        setMostrarResultados(false)
        setEnviadas(new Set())
      } catch (err) {
        alert('Erro ao ler o arquivo.\n' + (err instanceof Error ? err.message : ''))
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function resetUpload() {
    setDadosImportados([])
    setNomeArquivo('')
    setMostrarResultados(false)
    setEnviadas(new Set())
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── Processar ──────────────────────────────────────────────────────────────────

  function processar() {
    if (!dadosImportados.length) return
    const filtrados = filtrarEDeduplicar(dadosImportados, Array.from(statusSelecionados))
    const comTel = filtrados.filter(r => r.celular)
    const semTel = filtrados.filter(r => !r.celular)
    setComTelefone(comTel)
    setSemTelefone(semTel)
    setMensagensOverride({})
    setEnviadas(new Set())
    setCardsSelecionados(new Set(comTel.map((_, i) => i)))
    setMostrarResultados(true)
    setTimeout(() => document.getElementById('lote-resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  // ── Card helpers ────────────────────────────────────────────────────────────────

  function getMensagem(i: number): string {
    return mensagensOverride[i] ?? gerarMensagem(comTelefone[i], studioNome, textoEditado)
  }

  function copiar(i: number) {
    navigator.clipboard.writeText(getMensagem(i)).then(() => showToast('Mensagem copiada!'))
  }

  function iniciarEdicao(i: number) {
    setEditBuffer(getMensagem(i))
    setEditandoIdx(i)
  }

  function salvarEdicao() {
    if (editandoIdx === null) return
    setMensagensOverride(prev => ({ ...prev, [editandoIdx]: editBuffer }))
    setEditandoIdx(null)
    showToast('Mensagem salva!')
  }

  function marcarEnviada(i: number) {
    setTimeout(() => setEnviadas(prev => new Set([...prev, i])), 300)
  }

  function toggleCard(i: number) {
    setCardsSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  // ── Auto-send ──────────────────────────────────────────────────────────────────

  async function iniciarEnvioAutomatico() {
    const itens = Array.from(cardsSelecionados)
      .filter(i => !enviadas.has(i))
      .map(i => ({ index: i, url: buildWaUrl(comTelefone[i].celular, getMensagem(i)) }))

    if (!itens.length) { showToast('Nenhuma mensagem selecionada.'); return }

    abortadoRef.current = false
    skipDelayRef.current = false

    for (let k = 0; k < itens.length; k++) {
      if (abortadoRef.current) break

      const { index, url } = itens[k]

      // Abre (ou reutiliza) aba nomeada
      waTabRef.current = window.open(url, 'wa-sender-tab')
      waTabRef.current?.focus()

      setProgresso({ atual: k + 1, total: itens.length })
      setCountdown(null)

      // Aguarda a aba fechar (extensão fecha após enviar)
      await new Promise<void>(resolve => {
        const poll = setInterval(() => {
          if (abortadoRef.current || !waTabRef.current || waTabRef.current.closed) {
            clearInterval(poll)
            resolve()
          }
        }, 1000)
        proximoResolveRef.current = () => { clearInterval(poll); resolve() }
      })

      if (abortadoRef.current) break

      marcarEnviada(index)

      // Delay aleatório entre mensagens (exceto após a última)
      if (k < itens.length - 1 && !abortadoRef.current) {
        const secs = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin
        skipDelayRef.current = false
        for (let t = secs; t > 0; t--) {
          if (abortadoRef.current || skipDelayRef.current) break
          setCountdown(t)
          await new Promise<void>(r => setTimeout(r, 1000))
        }
        setCountdown(null)
        if (abortadoRef.current) break
      }
    }

    if (!abortadoRef.current) {
      waTabRef.current = null
      setProgresso(null)
      setCountdown(null)
      showToast(`✦ ${itens.length} mensagem${itens.length !== 1 ? 's' : ''} enviada${itens.length !== 1 ? 's' : ''} com sucesso!`)
    }
  }

  function pularDelay() {
    skipDelayRef.current = true
  }

  function abortar() {
    abortadoRef.current = true
    skipDelayRef.current = true
    proximoResolveRef.current?.()
    proximoResolveRef.current = null
    if (waTabRef.current && !waTabRef.current.closed) waTabRef.current.close()
    waTabRef.current = null
    setProgresso(null)
    setCountdown(null)
    showToast('Envio cancelado.')
  }

  const qtdSelecionadas = Array.from(cardsSelecionados).filter(i => !enviadas.has(i)).length

  // ── Render ────────────────────────────────────────────────────────────────────

  const S: Record<string, React.CSSProperties> = {
    card: {
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 1px 3px rgba(74,18,40,.06), 0 6px 20px rgba(74,18,40,.08)',
      border: '1px solid var(--beige)',
      padding: 24,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.1em',
      textTransform: 'uppercase' as const,
      color: 'var(--warm-gray)',
      fontFamily: "'Jost', sans-serif",
    },
    linkBtn: {
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      fontSize: 12,
      color: 'var(--warm-gray)',
      fontFamily: "'Jost', sans-serif",
      textDecoration: 'underline',
      letterSpacing: '.02em',
    },
    pill: {
      padding: '7px 15px',
      border: '1.5px solid var(--beige)',
      borderRadius: 20,
      background: '#fff',
      fontFamily: "'Jost', sans-serif",
      fontSize: 12,
      fontWeight: 500,
      color: 'var(--warm-gray)',
      cursor: 'pointer',
      transition: 'all .15s',
      whiteSpace: 'nowrap' as const,
      letterSpacing: '.03em',
    },
    pillActive: {
      padding: '7px 15px',
      border: '1.5px solid var(--rose-gold)',
      borderRadius: 20,
      background: 'linear-gradient(135deg, var(--rose-gold) 0%, #b87f56 100%)',
      fontFamily: "'Jost', sans-serif",
      fontSize: 12,
      fontWeight: 600,
      color: '#fff',
      cursor: 'pointer',
      transition: 'all .15s',
      whiteSpace: 'nowrap' as const,
      letterSpacing: '.03em',
      boxShadow: '0 2px 8px rgba(201,149,107,.3)',
    },
    textarea: {
      width: '100%',
      border: '1.5px solid var(--beige)',
      borderRadius: 8,
      padding: '13px',
      fontSize: 13,
      fontFamily: "'Jost', sans-serif",
      lineHeight: 1.7,
      resize: 'vertical' as const,
      color: 'var(--text)',
      background: '#fff',
      transition: 'border-color .18s, box-shadow .18s',
      outline: 'none',
    },
    uploadZone: {
      border: '2px dashed var(--beige)',
      borderRadius: 14,
      padding: '40px 24px',
      textAlign: 'center' as const,
      cursor: 'pointer',
      transition: 'all .2s',
      background: 'var(--cream)',
      userSelect: 'none' as const,
    },
    input: {
      width: '100%',
      border: '1.5px solid var(--beige)',
      borderRadius: 8,
      padding: '10px 13px',
      fontSize: 14,
      fontFamily: "'Jost', sans-serif",
      color: 'var(--text)',
      background: '#fff',
      transition: 'border-color .18s, box-shadow .18s',
      outline: 'none',
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--warm-gray)',
      letterSpacing: '.06em',
      textTransform: 'uppercase' as const,
      display: 'block',
      marginBottom: 5,
      fontFamily: "'Jost', sans-serif",
    },
    actionBtn: {
      background: '#fff',
      border: '1.5px solid var(--beige)',
      borderRadius: 8,
      padding: '5px 12px',
      fontSize: 12,
      fontWeight: 600,
      fontFamily: "'Jost', sans-serif",
      color: 'var(--warm-gray)',
      cursor: 'pointer',
      transition: 'all .15s',
      whiteSpace: 'nowrap' as const,
    },
    resultCard: {
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 1px 3px rgba(74,18,40,.06), 0 6px 20px rgba(74,18,40,.08)',
      border: '1px solid var(--beige)',
      overflow: 'hidden',
      transition: 'border-color .2s, box-shadow .2s',
    },
    metaPill: {
      fontSize: 12,
      color: 'var(--warm-gray)',
      background: 'var(--cream)',
      border: '1px solid var(--beige)',
      padding: '2px 9px',
      borderRadius: 20,
      fontFamily: "'Jost', sans-serif",
      letterSpacing: '.02em',
    },
    cardActionBtn: {
      flex: 1,
      padding: 12,
      border: 'none',
      background: 'none',
      fontFamily: "'Jost', sans-serif",
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      textAlign: 'center' as const,
      transition: 'background .12s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      letterSpacing: '.03em',
      color: 'var(--warm-gray)',
    },
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--cream)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── 1. Template pills + editor ── */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={S.sectionLabel}>Mensagem</p>
              {isAdmin && (
                <button onClick={onAbrirTemplates} style={S.linkBtn}>
                  Gerenciar templates
                </button>
              )}
            </div>

            {/* Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => selecionarTemplate(t)}
                  style={templateAtivo?.id === t.id ? S.pillActive : S.pill}
                >
                  {t.titulo}
                </button>
              ))}
            </div>

            {/* Editor */}
            <textarea
              value={textoEditado}
              onChange={e => setTextoEditado(e.target.value)}
              rows={6}
              style={S.textarea}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--rose-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,149,107,.14)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--beige)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--rose-gold)', fontStyle: 'italic' }}>
                {isEditado ? `Editando: ${templateAtivo?.titulo}` : ''}
              </span>
              <button onClick={restaurarTemplate} style={S.linkBtn}>
                Restaurar padrão
              </button>
            </div>
          </div>

          {/* ── 2. Upload ── */}
          <div style={S.card}>
            <p style={{ ...S.sectionLabel, marginBottom: 14 }}>Relatório AVEC</p>
            {!nomeArquivo ? (
              <div
                style={S.uploadZone}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = 'var(--rose-gold)'; (e.currentTarget as HTMLElement).style.background = '#fef5ee' }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--beige)'; (e.currentTarget as HTMLElement).style.background = 'var(--cream)' }}
                onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = 'var(--beige)'; (e.currentTarget as HTMLElement).style.background = 'var(--cream)'; const f = e.dataTransfer.files[0]; if (f) processarArquivo(f) }}
              >
                <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) processarArquivo(f) }} />
                <div style={{ color: 'var(--beige)', marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width={36} height={36}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>Arraste o arquivo XLSX aqui ou clique para selecionar</p>
                <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Relatório exportado do Avec SalãoVIP</p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef5ee', border: '1.5px solid var(--rose-gold-light)', borderRadius: 8, padding: '11px 14px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--bordeaux-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeArquivo}</p>
                  <p style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{dadosImportados.length} registro{dadosImportados.length !== 1 ? 's' : ''} encontrado{dadosImportados.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => { resetUpload(); setTimeout(() => inputRef.current?.click(), 50) }} style={S.actionBtn}>
                  Trocar
                </button>
              </div>
            )}
          </div>

          {/* ── 3. Filtros ── */}
          <div style={S.card}>
            <p style={{ ...S.sectionLabel, marginBottom: 14 }}>Filtros</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px', border: '1.5px solid var(--beige)', borderRadius: 8, background: '#fff', marginBottom: 14 }}>
              {STATUS_OPCOES.map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: "'Jost', sans-serif", cursor: 'pointer', padding: '4px 10px', borderRadius: 20, border: `1px solid ${statusSelecionados.has(s) ? 'var(--rose-gold)' : 'var(--beige)'}`, background: statusSelecionados.has(s) ? 'linear-gradient(135deg, var(--rose-gold) 0%, #b87f56 100%)' : 'var(--cream)', color: statusSelecionados.has(s) ? '#fff' : 'var(--warm-gray)', transition: 'all .15s', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={statusSelecionados.has(s)}
                    onChange={() => { setStatusSelecionados(prev => { const next = new Set(prev); if (next.has(s)) next.delete(s); else next.add(s); return next }) }}
                    style={{ accentColor: 'var(--rose-gold)', width: 13, height: 13, cursor: 'pointer' }}
                  />
                  {s}
                </label>
              ))}
            </div>
            <div>
              <label style={S.fieldLabel}>Nome do studio</label>
              <input
                value={studioNome}
                onChange={e => setStudioNome(e.target.value)}
                style={S.input}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--rose-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,149,107,.14)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--beige)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
          </div>

          {/* ── Botão Processar ── */}
          <button
            onClick={processar}
            disabled={!dadosImportados.length}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '13px 24px',
              background: !dadosImportados.length ? 'var(--beige)' : 'linear-gradient(135deg, var(--bordeaux-mid) 0%, var(--bordeaux-dark) 100%)',
              color: !dadosImportados.length ? '#c9b8b5' : 'var(--rose-gold-light)',
              border: 'none', borderRadius: 10,
              fontFamily: "'Jost', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: '.04em',
              cursor: !dadosImportados.length ? 'not-allowed' : 'pointer',
              boxShadow: !dadosImportados.length ? 'none' : '0 4px 16px rgba(74,18,40,.35)',
              transition: 'all .18s',
            }}
          >
            Processar
          </button>

          {/* ── 4. Resultados ── */}
          {mostrarResultados && (
            <div id="lote-resultados" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--rose-gold) 0%, #b87f56 100%)', color: '#fff', fontSize: 13, fontWeight: 700, minWidth: 30, height: 30, borderRadius: 20, padding: '0 10px', boxShadow: '0 2px 6px rgba(201,149,107,.35)' }}>
                    {comTelefone.length}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--warm-gray)' }}>mensagem(ns) para enviar</span>
                </div>
                {enviadas.size > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--rose-gold)', fontWeight: 600 }}>
                    {enviadas.size} de {comTelefone.length} enviadas
                  </span>
                )}
              </div>

              {/* Auto-send bar */}
              {comTelefone.length > 0 && !progresso && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingBottom: 4 }}>
                  <button
                    onClick={() => setModalConfirm(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '13px 24px',
                      background: 'linear-gradient(135deg, var(--bordeaux-mid) 0%, var(--bordeaux-dark) 100%)',
                      color: 'var(--rose-gold-light)',
                      border: 'none', borderRadius: 10,
                      fontFamily: "'Jost', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: '.04em',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(74,18,40,.35)',
                      transition: 'all .18s',
                    }}
                  >
                    Enviar {qtdSelecionadas} selecionada{qtdSelecionadas !== 1 ? 's' : ''}
                  </button>
                </div>
              )}

              {/* Progress bar */}
              {progresso && (
                <div style={{ background: 'var(--bordeaux-dark)', borderTop: '2px solid var(--bordeaux-light)', borderRadius: 10, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 4px 16px rgba(74,18,40,.35)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, fontFamily: "'Jost', sans-serif", fontSize: 14, color: 'var(--rose-gold-light)' }}>
                      {countdown !== null ? (
                        <>
                          Próxima em… <strong style={{ color: '#fff', fontSize: 16, minWidth: 22, textAlign: 'right' }}>{countdown}s</strong>
                          <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginLeft: 2 }}>({progresso.atual} de {progresso.total})</span>
                        </>
                      ) : (
                        <>
                          Aguardando WA… <strong style={{ color: '#fff', fontSize: 16 }}>{progresso.atual}</strong> de <strong style={{ color: '#fff', fontSize: 16 }}>{progresso.total}</strong>
                        </>
                      )}
                    </div>
                    <button onClick={abortar} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: 'var(--rose-gold-light)', padding: '6px 14px', borderRadius: 20, fontFamily: "'Jost', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Abortar
                    </button>
                    {countdown !== null && (
                      <button onClick={pularDelay} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', padding: '6px 16px', borderRadius: 20, fontFamily: "'Jost', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Pular espera →
                      </button>
                    )}
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,.12)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--rose-gold) 0%, #e8b08a 100%)', borderRadius: 10, width: `${((progresso.atual - 1) / progresso.total) * 100}%`, transition: 'width .4s ease' }} />
                  </div>
                  {countdown !== null && (
                    <div style={{ height: 3, background: 'rgba(255,255,255,.08)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'rgba(255,255,255,.35)', borderRadius: 10, width: `${(countdown / delayMax) * 100}%`, transition: 'width 1s linear' }} />
                    </div>
                  )}
                </div>
              )}

              {/* Cards */}
              {comTelefone.length === 0 ? (
                <p style={{ fontSize: 14, color: 'var(--warm-gray)', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>
                  Nenhum cliente encontrado com os filtros selecionados.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {comTelefone.map((r, i) => {
                    const msg = getMensagem(i)
                    const waUrl = buildWaUrl(r.celular, msg)
                    const isEnviada = enviadas.has(i)
                    const selecionado = cardsSelecionados.has(i)
                    const servicosTexto = r.servicos.length ? r.servicos.join(' + ') : r.servico
                    const servTruncado = servicosTexto.length > 50 ? servicosTexto.slice(0, 50) + '…' : servicosTexto
                    const primeiroNomeCliente = r.cliente.split(' ')[0]
                    const editando = editandoIdx === i

                    return (
                      <div key={i} style={{ ...S.resultCard, ...(isEnviada ? { borderColor: 'var(--rose-gold-light)', background: 'linear-gradient(to bottom, #fffaf6, #fff)' } : {}) }}>

                        {/* Card header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px 12px', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--beige)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                            {/* Custom checkbox */}
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>
                              <input type="checkbox" checked={selecionado} onChange={() => toggleCard(i)} style={{ display: 'none' }} />
                              <span style={{ width: 18, height: 18, border: `2px solid ${selecionado ? 'var(--rose-gold)' : 'var(--beige)'}`, borderRadius: 5, background: selecionado ? 'linear-gradient(135deg, var(--rose-gold) 0%, #b87f56 100%)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .18s', flexShrink: 0 }}>
                                {selecionado && <svg viewBox="0 0 10 10" width="10" height="10"><polyline points="1.5,5 4,7.5 8.5,2" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </span>
                            </label>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, fontWeight: 600, color: 'var(--bordeaux-dark)', marginBottom: 5 }}>
                                {primeiroNomeCliente}
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {r.hora && <span style={S.metaPill}>{r.hora}</span>}
                                {servTruncado && <span style={S.metaPill}>{servTruncado}</span>}
                                {r.profissional && <span style={S.metaPill}>{r.profissional.split(' ')[0]}</span>}
                                {r.status && <span style={{ ...S.metaPill, background: 'var(--bordeaux-dark)', color: 'var(--rose-gold-light)', borderColor: 'var(--bordeaux-light)', fontWeight: 600 }}>{r.status}</span>}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            {isEnviada ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--bordeaux-light)', background: '#fde8d5', border: '1px solid var(--rose-gold-light)', padding: '3px 10px', borderRadius: 20, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                                ✦ Enviada
                              </span>
                            ) : (
                              <>
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--warm-gray)', fontFamily: 'monospace' }}>{formatTel(r.celular)}</span>
                                <a href={`https://web.whatsapp.com/send?phone=55${r.celular}`} target="_blank" rel="noopener noreferrer" title="Abrir contato" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: 'var(--wa-green-light)', color: 'var(--wa-green-dark)', textDecoration: 'none', flexShrink: 0, transition: 'all .15s' }}>
                                  <WaIcon />
                                </a>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Message */}
                        <div style={{ padding: '14px 20px 0' }}>
                          {editando ? (
                            <textarea
                              value={editBuffer}
                              onChange={e => setEditBuffer(e.target.value)}
                              rows={5}
                              style={{ ...S.textarea, fontSize: 13 }}
                              onFocus={e => { e.currentTarget.style.borderColor = 'var(--rose-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,149,107,.14)' }}
                              onBlur={e => { e.currentTarget.style.borderColor = 'var(--beige)'; e.currentTarget.style.boxShadow = 'none' }}
                            />
                          ) : (
                            <pre style={{ background: 'linear-gradient(135deg, var(--cream) 0%, #faeee2 100%)', border: '1px solid var(--beige)', borderLeft: '3px solid var(--rose-gold)', borderRadius: '0 10px 10px 10px', padding: '13px 15px', fontSize: 13, fontFamily: "'Jost', sans-serif", lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text)', margin: 0 }}>
                              {msg}
                            </pre>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', borderTop: '1px solid var(--beige)', background: 'var(--cream)', marginTop: 14 }}>
                          <button onClick={() => copiar(i)} style={{ ...S.cardActionBtn, borderRight: '1px solid var(--beige)' }}>
                            <CopyIcon /> Copiar
                          </button>
                          {editando ? (
                            <button onClick={salvarEdicao} style={{ ...S.cardActionBtn, color: '#155724', background: '#f0faf4', borderRight: '1px solid var(--beige)' }}>
                              <CheckIcon /> Salvar
                            </button>
                          ) : (
                            <button onClick={() => iniciarEdicao(i)} style={{ ...S.cardActionBtn, borderRight: '1px solid var(--beige)' }}>
                              <EditIcon /> Editar
                            </button>
                          )}
                          <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => marcarEnviada(i)} style={{ ...S.cardActionBtn, color: 'var(--wa-green-dark)', textDecoration: 'none', flex: 1 }}>
                            <WaIcon /> WhatsApp
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Sem telefone */}
              {semTelefone.length > 0 && (
                <div style={{ border: '1.5px solid #fca5a5', borderRadius: 14, padding: '16px 20px', background: '#fff' }}>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 16, fontStyle: 'italic', color: '#b91c1c', marginBottom: 12 }}>
                    Sem telefone cadastrado ({semTelefone.length})
                  </h3>
                  {semTelefone.map((r, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text)', padding: '6px 0', borderBottom: i < semTelefone.length - 1 ? '1px solid var(--beige)' : 'none' }}>
                      <span style={{ fontWeight: 600 }}>{r.cliente}</span>
                      {r.dataReserva && <span style={{ color: 'var(--warm-gray)' }}> — {r.dataReserva} às {r.hora}</span>}
                      {r.profissional && <span style={{ color: 'var(--warm-gray)' }}> — {r.profissional}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Botão fixo extensão ── */}
      <button
        onClick={() => setModalAjudaExtensao(true)}
        title="Extensão WA Auto Sender"
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 90, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: '#fff', border: '1.5px solid var(--beige)', borderRadius: 20, boxShadow: '0 2px 10px rgba(74,18,40,.1)', fontFamily: "'Jost', sans-serif", fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', cursor: 'pointer', transition: 'all .18s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--rose-gold)'; (e.currentTarget as HTMLElement).style.color = 'var(--bordeaux-dark)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--beige)'; (e.currentTarget as HTMLElement).style.color = 'var(--warm-gray)' }}
      >
        <PuzzleIcon /> Extensão
      </button>

      {/* ── Modal ajuda extensão ── */}
      {modalAjudaExtensao && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(74,18,40,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '32px 28px', width: 'min(480px, 94vw)', boxShadow: '0 20px 60px rgba(74,18,40,.3)', display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--bordeaux-mid), var(--bordeaux-dark))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rose-gold-light)', flexShrink: 0 }}>
                  <PuzzleIcon size={20} />
                </div>
                <div>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 700, fontStyle: 'italic', color: 'var(--bordeaux-dark)', margin: 0 }}>Extensão WA Auto Sender</h3>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: 'var(--warm-gray)', margin: 0 }}>Necessária para envio automático</p>
                </div>
              </div>
              <button onClick={() => setModalAjudaExtensao(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Download */}
            <a
              href="/wa_extension.zip"
              download="wa_extension.zip"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '13px 20px', background: 'linear-gradient(135deg, var(--bordeaux-mid) 0%, var(--bordeaux-dark) 100%)', color: 'var(--rose-gold-light)', borderRadius: 10, fontFamily: "'Jost', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '.04em', textDecoration: 'none', boxShadow: '0 4px 14px rgba(74,18,40,.3)', marginBottom: 24 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={17} height={17}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Baixar extensão (.zip)
            </a>

            {/* Steps */}
            <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 12 }}>Como instalar</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {[
                { n: '1', texto: 'Baixe o ZIP acima e extraia em uma pasta permanente (ex: Documentos)' },
                { n: '2', texto: <>No Chrome, acesse <strong style={{ fontFamily: 'monospace', fontSize: 12 }}>chrome://extensions</strong></> },
                { n: '3', texto: 'Ative o "Modo do desenvolvedor" no canto superior direito' },
                { n: '4', texto: 'Clique em "Carregar sem compactação" e selecione a pasta extraída' },
                { n: '5', texto: 'A extensão "WA Auto Sender — mc_control" aparecerá na lista' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ minWidth: 24, height: 24, background: 'linear-gradient(135deg, var(--rose-gold) 0%, #b87f56 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: "'Jost', sans-serif", marginTop: 1 }}>{s.n}</span>
                  <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{s.texto}</span>
                </div>
              ))}
            </div>

            {/* Aviso */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth={2} width={16} height={16} style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: '#92400e', lineHeight: 1.5, margin: 0 }}>
                Antes de usar: confirme que o <strong>WhatsApp Web está logado</strong> neste Chrome. A extensão não abre sessão — só envia.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* ── Modal confirmação ── */}
      {modalConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(74,18,40,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '36px 32px', width: 'min(420px, 90vw)', boxShadow: '0 20px 60px rgba(74,18,40,.3)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, var(--bordeaux-mid), var(--bordeaux-dark))', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rose-gold-light)', marginBottom: 4 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={28} height={28}>
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.02 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 700, fontStyle: 'italic', color: 'var(--bordeaux-dark)' }}>
              Confirmar envio
            </h3>
            <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 15, color: 'var(--text)', lineHeight: 1.6 }}>
              Serão enviadas mensagens para <strong>{qtdSelecionadas} cliente{qtdSelecionadas !== 1 ? 's' : ''}</strong> automaticamente. A extensão WA Auto Sender cuidará do envio.
            </p>
            <div style={{ background: 'var(--cream)', border: '1px solid var(--beige)', borderRadius: 8, padding: '12px 14px', width: '100%' }}>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: 'var(--warm-gray)', marginBottom: 10 }}>
                Após cada confirmação, aguarda um tempo aleatório antes de abrir a próxima — para evitar bloqueio por bot.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Jost', sans-serif", fontSize: 13 }}>
                <span style={{ color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>Espera:</span>
                <input
                  type="number" min={5} max={120} value={delayMin}
                  onChange={e => setDelayMin(Math.max(5, parseInt(e.target.value) || 5))}
                  style={{ width: 54, border: '1.5px solid var(--beige)', borderRadius: 6, padding: '4px 8px', fontSize: 13, fontFamily: "'Jost', sans-serif", textAlign: 'center', color: 'var(--text)', background: '#fff', outline: 'none' }}
                />
                <span style={{ color: 'var(--warm-gray)' }}>a</span>
                <input
                  type="number" min={5} max={120} value={delayMax}
                  onChange={e => setDelayMax(Math.max(delayMin, parseInt(e.target.value) || delayMin))}
                  style={{ width: 54, border: '1.5px solid var(--beige)', borderRadius: 6, padding: '4px 8px', fontSize: 13, fontFamily: "'Jost', sans-serif", textAlign: 'center', color: 'var(--text)', background: '#fff', outline: 'none' }}
                />
                <span style={{ color: 'var(--warm-gray)' }}>segundos</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 6 }}>
              <button onClick={() => setModalConfirm(false)} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1.5px solid var(--beige)', background: 'var(--cream)', color: 'var(--warm-gray)', fontFamily: "'Jost', sans-serif", fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { setModalConfirm(false); iniciarEnvioAutomatico() }} style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--bordeaux-mid) 0%, var(--bordeaux-dark) 100%)', color: 'var(--rose-gold-light)', fontFamily: "'Jost', sans-serif", fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 3px 10px rgba(74,18,40,.3)' }}>
                Iniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, var(--bordeaux-dark) 0%, var(--bordeaux-mid) 100%)', color: 'var(--rose-gold-light)', padding: '11px 26px', borderRadius: 30, fontFamily: "'Jost', sans-serif", fontSize: 14, fontWeight: 500, boxShadow: '0 6px 24px rgba(74,18,40,.4)', zIndex: 100, letterSpacing: '.03em', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function PuzzleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={size} height={size}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  )
}

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="13" height="13">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="13" height="13">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="13" height="13">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
