'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Scale, Printer, FileSpreadsheet, Plus, FileText, X, Check, Pencil, ArrowLeftRight } from 'lucide-react'

interface Transaction {
  id: string
  date: string
  libelle: string
  montant: number
  type: string
  referenceType: string
  montantSigne: number
  referenceId?: number
}

interface Detail {
  id: number
  code: string
  nom: string
  ncc: string | null
  client: { id: number; nom: string; code: string | null; telephone: string | null } | null
  fournisseur: { id: number; nom: string; code: string | null; telephone: string | null } | null
  transactions: Transaction[]
  solde: number
}

interface MagasinOption { id: number; nom: string }
interface BanqueOption { id: number; libelle: string }

export default function CompteCourantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReglement, setShowReglement] = useState(false)
  const [regMontant, setRegMontant] = useState('')
  const [regMode, setRegMode] = useState('ESPECES')
  const [regCaisse, setRegCaisse] = useState(false)
  const [regBanque, setRegBanque] = useState(false)
  const [regMagasinId, setRegMagasinId] = useState('')
  const [regBanqueId, setRegBanqueId] = useState('')
  const [magasins, setMagasins] = useState<MagasinOption[]>([])
  const [banques, setBanques] = useState<BanqueOption[]>([])
  const [savingReg, setSavingReg] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editNom, setEditNom] = useState('')
  const [editNcc, setEditNcc] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [showFactures, setShowFactures] = useState(false)
  const [ccPage, setCcPage] = useState(1)
  const ccPerPage = 10
  const [factures, setFactures] = useState<any[]>([])
  const [facturesLoading, setFacturesLoading] = useState(false)
  const [facturesPage, setFacturesPage] = useState(1)
  const facturesPerPage = 10
  const [clientsList, setClientsList] = useState<{ id: number; nom: string }[]>([])
  const [fournisseursList, setFournisseursList] = useState<{ id: number; nom: string }[]>([])
  const [editClientId, setEditClientId] = useState('')
  const [editFournisseurId, setEditFournisseurId] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/comptes-courants/${params.id}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
    fetch('/api/magasins?actif=true').then(r => r.ok && r.json()).then(d => setMagasins(d || [])).catch(() => {})
    fetch('/api/banques?actif=true').then(r => r.ok && r.json()).then(d => setBanques(d?.data || d || [])).catch(() => {})
    fetch('/api/clients?limit=10000').then(r => r.ok && r.json()).then(d => setClientsList(d?.data || d || [])).catch(() => {})
    fetch('/api/fournisseurs?limit=10000').then(r => r.ok && r.json()).then(d => setFournisseursList(d?.data || d || [])).catch(() => {})
  }, [params.id])

  useEffect(() => { setCcPage(1) }, [data?.transactions.length])

  const totalDebit = data?.transactions.filter(t => t.montantSigne > 0).reduce((s, t) => s + t.montant, 0) || 0
  const totalCredit = data?.transactions.filter(t => t.montantSigne < 0).reduce((s, t) => s + t.montant, 0) || 0

  const handleReglement = async (e: React.FormEvent) => {
    e.preventDefault()
    const montant = Number(regMontant)
    if (!montant || montant <= 0) return
    setSavingReg(true)
    try {
      const body: any = {
        compteCourantId: data?.id,
        montant,
        modePaiement: regMode,
        clientId: data?.client?.id,
        fournisseurId: data?.fournisseur?.id,
        payeDepuisCaisse: regCaisse,
        payeDepuisBanque: regBanque,
      }
      if (regCaisse) body.magasinId = Number(regMagasinId)
      if (regBanque) body.banqueId = Number(regBanqueId)
      const res = await fetch('/api/comptes-courants/reglement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowReglement(false)
        setRegMontant('')
        setRegCaisse(false)
        setRegBanque(false)
        setRegMagasinId('')
        setRegBanqueId('')
        fetchDetail()
      } else {
        const err = await res.json()
        alert(err.error || 'Erreur lors du règlement')
      }
    } finally {
      setSavingReg(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/comptes-courants/${data?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: editNom,
          ncc: editNcc,
          clientId: editClientId ? Number(editClientId) : null,
          fournisseurId: editFournisseurId ? Number(editFournisseurId) : null,
        }),
      })
      if (res.ok) {
        setShowEdit(false)
        fetchDetail()
      } else {
        const err = await res.json()
        alert(err.error || 'Erreur lors de la modification')
      }
    } finally {
      setSavingEdit(false)
    }
  }

  const handlePrint = () => window.print()

  const handleExportExcel = () => {
    if (!data) return
    let rb = 0
    const rows = data.transactions.map(t => {
      rb += t.montantSigne
      return { ...t, runningBalance: rb }
    })

    const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    const thead = `<tr style="background:#ED6A30;color:#ffffff;text-align:center;font-weight:bold">
      <th style="padding:8px 12px">Date</th>
      <th style="padding:8px 12px;text-align:left">Libellé</th>
      <th style="padding:8px 12px">Débit (+)</th>
      <th style="padding:8px 12px">Crédit (−)</th>
      <th style="padding:8px 12px">Solde</th>
    </tr>`

    const tbody = rows.map((t, i) => {
      const bg = i % 2 === 0 ? '#1a1a2e' : '#16213e'
      const date = new Date(t.date).toLocaleDateString('fr-FR')
      const time = new Date(t.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const debit = t.montantSigne > 0 ? fmt(t.montant) : ''
      const credit = t.montantSigne < 0 ? fmt(t.montant) : ''
      const solde = fmt(Math.abs(t.runningBalance)) + (t.runningBalance >= 0 ? ' D' : ' C')
      const soldeColor = t.runningBalance >= 0 ? '#34d399' : '#f87171'
      return `<tr style="background:${bg}">
        <td style="padding:6px 12px;color:#ccc;white-space:nowrap">${escHtml(date)}<br><span style="font-size:10px;color:#888">${escHtml(time)}</span></td>
        <td style="padding:6px 12px;color:#ddd;max-width:300px">${escHtml(t.libelle)}</td>
        <td style="padding:6px 12px;text-align:right;color:#fb923c;white-space:nowrap">${debit}</td>
        <td style="padding:6px 12px;text-align:right;color:#34d399;white-space:nowrap">${credit}</td>
        <td style="padding:6px 12px;text-align:right;color:${soldeColor};font-weight:bold;white-space:nowrap">${escHtml(solde)}</td>
      </tr>`
    }).join('\n')

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Compte Courant ${escHtml(data.nom)}</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;font-size:13px;margin:0;padding:20px;background:#0f0f23">
<table style="border-collapse:collapse;width:100%">
<thead>${thead}</thead>
<tbody>${tbody}</tbody>
</table>
<p style="color:#888;font-size:11px;margin-top:12px">Compte Courant ${escHtml(data.nom)} (${escHtml(data.code)}) — Solde net : ${fmt(Math.abs(data.solde))} ${data.solde >= 0 ? 'Débiteur' : 'Créditeur'}</p>
</body>
</html>`

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CompteCourant_${data.nom}_${new Date().toISOString().slice(0, 10)}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleShowFactures = async () => {
    setShowFactures(true)
    setFacturesLoading(true)
    setFactures([])
    try {
      if (!data) return

      // Collecter les IDs des ventes et achats qui apparaissent dans le CC
      const achatIds = new Set<number>()
      const venteIds = new Set<number>()
      for (const t of data.transactions) {
        if (t.type === 'ACHAT' && t.referenceId) achatIds.add(t.referenceId)
        if (t.type === 'VENTE' && t.referenceId) venteIds.add(t.referenceId)
      }

      const results: any[] = []
      if (data.client && venteIds.size > 0) {
        const r = await fetch(`/api/ventes?clientId=${data.client.id}&limit=500`)
        if (r.ok) {
          const json = await r.json()
          const items = Array.isArray(json) ? json : json.ventes || json.data || []
          for (const v of items) {
            if (venteIds.has(v.id)) results.push({ ...v, _type: 'VENTE' })
          }
        }
      }
      if (data.fournisseur && achatIds.size > 0) {
        const r = await fetch(`/api/achats?fournisseurId=${data.fournisseur.id}&limit=500`)
        if (r.ok) {
          const json = await r.json()
          const items = Array.isArray(json) ? json : json.achats || json.data || []
          for (const a of items) {
            if (achatIds.has(a.id)) results.push({ ...a, _type: 'ACHAT' })
          }
        }
      }
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setFactures(results)
    } catch { } finally {
      setFacturesLoading(false)
    }
  }

  const handleLettrage = async (transactionId: string) => {
    const res = await fetch('/api/comptes-courants/lettrer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compteCourantId: data?.id, transactionId }),
    })
    const result = await res.json()
    alert(result.message || JSON.stringify(result))
    fetchDetail()
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8" /></div>
  }

  if (!data) {
    return <div className="p-6 text-center text-gray-500">Compte courant introuvable.</div>
  }

  // Pre-calc running balance from chronological order (API returns desc)
  const transactionsWithBalance = (() => {
    const asc = [...data.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    let rb = 0
    const balMap = new Map<string, number>()
    for (const t of asc) { rb += t.montantSigne; balMap.set(t.id, rb) }
    return data.transactions.map(t => ({ ...t, runningBalance: balMap.get(t.id) || 0 }))
  })()

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6" ref={printRef}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Compte Courant</h1>
            <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">{data.nom}{data.ncc ? ` · NCC: ${data.ncc}` : ''}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowReglement(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 shadow-md transition-all">
              <Plus className="h-4 w-4" /> Nouveau Règlement
            </button>
            <button onClick={() => { setEditNom(data.nom); setEditNcc(data.ncc || ''); setEditClientId(data.client?.id ? String(data.client.id) : ''); setEditFournisseurId(data.fournisseur?.id ? String(data.fournisseur.id) : ''); setShowEdit(true) }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 shadow-md transition-all">
              <Pencil className="h-4 w-4" /> Modifier
            </button>
            <button onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 transition-all">
              <Printer className="h-4 w-4" /> Relevé
            </button>
            <button onClick={handleShowFactures}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 transition-all">
              <FileText className="h-4 w-4" /> Détail Factures
            </button>
            <button onClick={() => router.push('/dashboard/comptes-courants')}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 shadow-md transition-all">
              <X className="h-4 w-4" /> Fermer
            </button>
          </div>
        </div>

        {/* Print-only summary */}
        <div className="hidden print:block mb-6">
          <div className="border-b-2 border-black pb-2 mb-4">
            <h2 className="text-lg font-black uppercase">Relevé de Compte Courant</h2>
            <p className="text-xs">{data.nom} — {data.ncc ? `NCC: ${data.ncc}` : data.code}</p>
            <p className="text-[10px]">Édité le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="flex gap-4">
            <div className="flex-1 border-2 border-gray-300 rounded p-3">
              <p className="text-[10px] font-black uppercase">Total Débit</p>
              <p className="text-lg font-black">{fmt(totalDebit)}</p>
              <p className="text-[9px] text-gray-600">Ventes + Encaissements</p>
            </div>
            <div className="flex-1 border-2 border-gray-300 rounded p-3">
              <p className="text-[10px] font-black uppercase">Total Crédit</p>
              <p className="text-lg font-black">{fmt(totalCredit)}</p>
              <p className="text-[9px] text-gray-600">Achats + Paiements</p>
            </div>
            <div className="flex-1 border-2 border-black bg-gray-100 rounded p-3">
              <p className="text-[10px] font-black uppercase">Solde Net</p>
              <p className="text-lg font-black">{fmt(Math.abs(data.solde))}</p>
              <p className="text-[9px] font-bold">{data.solde >= 0 ? `Débiteur (${data.nom} doit au CC)` : `Créditeur (le CC doit à ${data.nom})`}</p>
            </div>
          </div>
        </div>

        {/* Summary Cards - Vente style */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3 no-print">
          {[
            { label: "Total Débit", val: fmt(totalDebit), sub: "Ventes + Encaissements", color: "bg-indigo-600", icon: ArrowLeftRight, tooltip: "Somme des montants en Débit (ce qui est dû au CC). Ventes et encaissements clients augmentent le débit." },
            { label: "Total Crédit", val: fmt(totalCredit), sub: "Achats + Paiements", color: "bg-emerald-600", icon: ArrowLeftRight, tooltip: "Somme des montants en Crédit (ce qui est payé par le CC). Achats et paiements fournisseurs augmentent le crédit." },
            { label: "Solde Net", val: fmt(Math.abs(data.solde)), sub: data.solde >= 0 ? `Débiteur (${data.nom} doit au CC)` : `Créditeur (le CC doit à ${data.nom})`, color: data.solde >= 0 ? "bg-amber-600" : "bg-rose-600" },
          ].map((c, i) => (
            <div key={i} className={`relative overflow-hidden rounded-[2rem] ${c.color} p-6 h-32 shadow-xl group`}>
              <div className="relative z-10 text-white flex flex-col justify-between h-full">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{c.label}</p>
                <div>
                  <h3 className="text-2xl font-black tracking-tighter">{c.val}</h3>
                  <p className="text-[9px] font-bold opacity-60 uppercase">{c.sub}</p>
                </div>
              </div>
              {Math.abs(data.solde) < 1 && i === 2 && <p className="absolute top-3 right-3 text-[10px] font-bold text-white/80 bg-white/20 px-2 py-0.5 rounded">✓ Compte soldé</p>}
            </div>
          ))}
        </div>

        {/* Client / Fournisseur Info */}
        <div className="flex flex-wrap gap-4">
          {data.client && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex-1 min-w-[200px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Client lié</p>
              <p className="font-bold text-gray-900">{data.client.nom}</p>
              <p className="text-xs text-gray-500">{data.client.code} · {data.client.telephone}</p>
            </div>
          )}
          {data.fournisseur && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex-1 min-w-[200px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Fournisseur lié</p>
              <p className="font-bold text-gray-900">{data.fournisseur.nom}</p>
              <p className="text-xs text-gray-500">{data.fournisseur.code} · {data.fournisseur.telephone}</p>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {showEdit && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Modifier le Compte Courant</h3>
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nom</label>
                  <input type="text" value={editNom} onChange={e => setEditNom(e.target.value)} required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">NCC</label>
                  <input type="text" value={editNcc} onChange={e => setEditNcc(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none"
                    placeholder="Numéro de compte" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Client lié</label>
                  <select value={editClientId} onChange={e => setEditClientId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none">
                    <option value="">Aucun client</option>
                    {clientsList.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fournisseur lié</label>
                  <select value={editFournisseurId} onChange={e => setEditFournisseurId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none">
                    <option value="">Aucun fournisseur</option>
                    {fournisseursList.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={savingEdit}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-md">
                    {savingEdit ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />}
                    Enregistrer
                  </button>
                  <button type="button" onClick={() => setShowEdit(false)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Règlement Modal */}
        {showReglement && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Nouveau Règlement</h3>
              <form onSubmit={handleReglement} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Montant</label>
                  <input type="number" value={regMontant} onChange={e => setRegMontant(e.target.value)} required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none"
                    placeholder="0" min="1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mode de paiement</label>
                  <select value={regMode} onChange={e => setRegMode(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none">
                    <option value="ESPECES">Espèces</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="VIREMENT">Virement</option>
                    <option value="CHEQUE">Chèque</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regCaisse} onChange={e => setRegCaisse(e.target.checked)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                    <span className="text-sm text-gray-700">Payer depuis la caisse</span>
                  </label>
                  {regCaisse && (
                    <select value={regMagasinId} onChange={e => setRegMagasinId(e.target.value)} required
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none">
                      <option value="">Choisir un point de vente</option>
                      {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                    </select>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regBanque} onChange={e => setRegBanque(e.target.checked)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                    <span className="text-sm text-gray-700">Payer depuis la banque</span>
                  </label>
                  {regBanque && (
                    <select value={regBanqueId} onChange={e => setRegBanqueId(e.target.value)} required
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none">
                      <option value="">Choisir un compte bancaire</option>
                      {banques.map(b => <option key={b.id} value={b.id}>{b.libelle}</option>)}
                    </select>
                  )}
                  <p className="text-xs text-gray-400">Si ni caisse ni banque coché, le règlement sera enregistré en compte courant d&apos;associé (455).</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={savingReg}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-md">
                    {savingReg ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />}
                    Valider
                  </button>
                  <button type="button" onClick={() => setShowReglement(false)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Compensation + Export */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={async () => {
            const res = await fetch('/api/comptes-courants/compenser', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: data.id }),
            })
            const result = await res.json()
            alert(result.message || JSON.stringify(result))
            fetchDetail()
          }} disabled={Math.abs(data.solde) < 1}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
            <Scale className="h-4 w-4" />
            Compenser (écriture comptable)
          </button>
          <button onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 transition-all">
            <FileSpreadsheet className="h-4 w-4" />
            Exporter Excel
          </button>
        </div>

        {/* Transactions Table */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Détail chronologique des opérations</h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{data.transactions.length} Événements</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Libellé</th>
                  <th className="text-right py-3 px-4 font-semibold">Débit (+)</th>
                  <th className="text-right py-3 px-4 font-semibold">Crédit (−)</th>
                  <th className="text-right py-3 px-4 font-semibold">Solde</th>
                  <th className="text-center py-3 px-4 font-semibold">Lettrage</th>
                </tr>
              </thead>
              <tbody>
                {transactionsWithBalance.slice((ccPage - 1) * ccPerPage, ccPage * ccPerPage).map((t, i) => {
                  const isEven = i % 2 === 0
                  return (
                    <tr key={t.id}
                      className={`border-b border-gray-100 transition-colors ${isEven ? 'bg-gray-50/50' : 'bg-white'} hover:bg-orange-50/50`}>
                      <td className="py-3 px-4 whitespace-nowrap text-gray-700 align-top">
                        <span>{new Date(t.date).toLocaleDateString('fr-FR')}</span>
                        <br /><span className="text-[10px] text-gray-400">
                          {new Date(t.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-800 max-w-[260px]">
                        <span className="block truncate" title={t.libelle}>{t.libelle}</span>
                        <span className={`text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded font-medium ${
                          t.type === 'ACHAT' ? 'bg-orange-100 text-orange-800'
                          : t.type === 'VENTE' ? 'bg-blue-100 text-blue-800'
                          : t.type === 'PAIEMENT_FOURNISSEUR' ? 'bg-purple-100 text-purple-800'
                          : t.type === 'ENCAISSEMENT_CLIENT' ? 'bg-emerald-100 text-emerald-800'
                          : t.type === 'COMPENSATION' ? 'bg-cyan-100 text-cyan-800'
                          : 'bg-gray-100 text-gray-700'
                        }`}>
                          {t.type === 'ACHAT' ? 'Achat'
                          : t.type === 'VENTE' ? 'Vente'
                          : t.type === 'PAIEMENT_FOURNISSEUR' ? 'Paiement'
                          : t.type === 'ENCAISSEMENT_CLIENT' ? 'Encaissement'
                          : t.type === 'COMPENSATION' ? 'Compensation'
                          : t.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-orange-600 font-semibold align-top whitespace-nowrap">
                        {t.montantSigne > 0 ? fmt(t.montant) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-600 font-semibold align-top whitespace-nowrap">
                        {t.montantSigne < 0 ? fmt(t.montant) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold align-top whitespace-nowrap ${t.runningBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fmt(Math.abs(t.runningBalance))}
                        <span className="text-[10px] ml-1 opacity-70">{t.runningBalance >= 0 ? 'D' : 'C'}</span>
                      </td>
                      <td className="py-3 px-4 text-center align-top">
                        {t.referenceType === 'REGLEMENT_VENTE' || t.referenceType === 'REGLEMENT_ACHAT' ? (
                          <button onClick={() => handleLettrage(t.id)}
                            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-sm">
                            Lettrer
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {transactionsWithBalance.length > ccPerPage && (
            <div className="flex justify-center items-center gap-3 py-4 border-t border-gray-100">
              <button onClick={() => setCcPage(p => Math.max(1, p - 1))} disabled={ccPage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                ← Précédent
              </button>
              <span className="text-xs text-gray-500">
                Page {ccPage} / {Math.ceil(transactionsWithBalance.length / ccPerPage)}
              </span>
              <button onClick={() => setCcPage(p => Math.min(Math.ceil(transactionsWithBalance.length / ccPerPage), p + 1))}
                disabled={ccPage >= Math.ceil(transactionsWithBalance.length / ccPerPage)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                Suivant →
              </button>
            </div>
          )}
        </div>

        {/* Comportement du solde */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 leading-relaxed">
          <p className="font-bold text-amber-900 mb-1">Comportement du solde</p>
          Toutes les ventes validées augmentent le Débit (ce que le client doit). Les règlements et acomptes augmentent le Crédit (ce qu'il a payé). Le résultat positif (D) indique une dette restante, le négatif (C) indique un avoir client.
        </div>

        {/* Détail Factures Modal */}
        {showFactures && (
          <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 pt-12 pb-12 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl w-full max-w-3xl border border-white/10 flex flex-col my-auto shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h3 className="text-lg font-bold text-white">Factures liées</h3>
                <button onClick={() => setShowFactures(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-4">
                {facturesLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="animate-spin h-8 w-8 text-white/60" /></div>
                ) : factures.length === 0 ? (
                  <p className="text-center text-gray-500 py-16">Aucune facture trouvée.</p>
                ) : (
                  <>
                    <table className="w-full text-sm mx-auto">
                      <thead>
                        <tr className="text-white text-xs uppercase tracking-wider border-b border-white/10">
                          <th className="text-left py-3 px-4 font-semibold">Date</th>
                          <th className="text-left py-3 px-4 font-semibold">Type</th>
                          <th className="text-left py-3 px-4 font-semibold">Référence</th>
                          <th className="text-right py-3 px-4 font-semibold">Montant</th>
                          <th className="text-center py-3 px-4 font-semibold">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {factures.slice((facturesPage - 1) * facturesPerPage, facturesPage * facturesPerPage).map((f, i) => (
                          <tr key={`${f._type}-${f.id}`}
                            className={`border-b border-white/5 transition-colors ${i % 2 === 0 ? 'bg-white/5' : 'bg-transparent'} hover:bg-white/10`}>
                            <td className="py-3 px-4 whitespace-nowrap text-white/80 text-xs">
                              {new Date(f.date).toLocaleString('fr-FR')}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`text-[11px] px-2.5 py-1 rounded font-black uppercase tracking-wider ${
                                f._type === 'VENTE' ? 'bg-blue-600/80 text-white' : 'bg-orange-600/80 text-white'
                              }`}>
                                {f._type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-white/90 font-medium">{f.numero || f.reference || '-'}</td>
                            <td className="py-3 px-4 text-right text-white font-bold whitespace-nowrap">
                              {fmt(f.montantTotal || f.montant || 0)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`text-[11px] px-2.5 py-1 rounded font-black uppercase tracking-wider ${
                                f.statut === 'VALIDE' || f.statut === 'LIVREE' || f.statut === 'PAYEE' || f.statut === 'PARTIELLE'
                                  ? 'bg-emerald-600/80 text-white'
                                  : f.statut === 'ANNULEE'
                                  ? 'bg-red-600/80 text-white'
                                  : 'bg-gray-600/80 text-white'
                              }`}>
                                {f.statut || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {factures.length > facturesPerPage && (
                      <div className="flex justify-center items-center gap-3 mt-5 pt-4 border-t border-white/10">
                        <button onClick={() => setFacturesPage(p => Math.max(1, p - 1))} disabled={facturesPage === 1}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          ← Précédent
                        </button>
                        <span className="text-xs text-white/50">
                          Page {facturesPage} / {Math.ceil(factures.length / facturesPerPage)}
                        </span>
                        <button onClick={() => setFacturesPage(p => Math.min(Math.ceil(factures.length / facturesPerPage), p + 1))}
                          disabled={facturesPage >= Math.ceil(factures.length / facturesPerPage)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          Suivant →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Print Styles */}
        <style>{`
          @media print {
            body { background: white !important; font-size: 11px; }
            .min-h-screen { background: white !important; }
            button { display: none !important; }
            table { color: black !important; }
            .no-print { display: none !important; }
            .rounded-xl { border-radius: 0 !important; }
            .shadow-sm, .shadow-md, .shadow-xl, .shadow-2xl { box-shadow: none !important; }
            th { color: #000 !important; background: #f3f4f6 !important; }
            td { color: #000 !important; }
            .text-gray-300, .text-gray-400, .text-gray-500 { color: #6b7280 !important; }
            .text-gray-700, .text-gray-800, .text-gray-900 { color: #000 !important; }
            .text-white { color: #000 !important; }
            .bg-gray-50 { background: #f9fafb !important; }
            .bg-white { background: #fff !important; }
            .border-gray-100, .border-gray-200 { border-color: #d1d5db !important; }
            .px-4 { padding-left: 8px !important; padding-right: 8px !important; }
            .py-3 { padding-top: 6px !important; padding-bottom: 6px !important; }
          }
        `}</style>
      </div>
    </>
  )
}
