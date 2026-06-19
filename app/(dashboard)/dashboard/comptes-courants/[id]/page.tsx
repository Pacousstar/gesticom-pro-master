'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, Scale, Printer, FileSpreadsheet, Plus, DollarSign, FileText, X, Check, Pencil, Info, ExternalLink } from 'lucide-react'

interface Transaction {
  id: string
  date: string
  libelle: string
  montant: number
  type: string
  referenceType: string
  montantSigne: number
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
  const [factures, setFactures] = useState<any[]>([])
  const [facturesLoading, setFacturesLoading] = useState(false)
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
    fetch('/api/banques?actif=true').then(r => r.ok && r.json()).then(d => setBanques(d || [])).catch(() => {})
    fetch('/api/clients?limit=10000').then(r => r.ok && r.json()).then(d => setClientsList(d?.data || d || [])).catch(() => {})
    fetch('/api/fournisseurs?limit=10000').then(r => r.ok && r.json()).then(d => setFournisseursList(d?.data || d || [])).catch(() => {})
  }, [params.id])

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
      const results: any[] = []
      if (data?.client) {
        const r = await fetch(`/api/ventes?clientId=${data.client.id}&limit=500`)
        if (r.ok) {
          const json = await r.json()
          const items = Array.isArray(json) ? json : json.ventes || json.data || []
          results.push(...items.map((v: any) => ({ ...v, _type: 'VENTE' })))
        }
      }
      if (data?.fournisseur) {
        const r = await fetch(`/api/achats?fournisseurId=${data.fournisseur.id}&limit=500`)
        if (r.ok) {
          const json = await r.json()
          const items = Array.isArray(json) ? json : json.achats || json.data || []
          results.push(...items.map((a: any) => ({ ...a, _type: 'ACHAT' })))
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="p-6 space-y-6" ref={printRef}>
        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={() => router.push('/dashboard/comptes-courants')}
            className="inline-flex items-center px-3 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm text-white transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Compte Courant {data.nom}</h1>
            <p className="text-sm text-white">{data.code}{data.ncc ? ` · NCC: ${data.ncc}` : ''}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowReglement(true)}
            className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm transition-colors">
            <Plus className="mr-2 h-4 w-4" /> Nouveau Règlement
          </button>
          <button onClick={() => { setEditNom(data.nom); setEditNcc(data.ncc || ''); setEditClientId(data.client?.id ? String(data.client.id) : ''); setEditFournisseurId(data.fournisseur?.id ? String(data.fournisseur.id) : ''); setShowEdit(true) }}
            className="inline-flex items-center px-4 py-2 bg-blue-600/30 hover:bg-blue-600/50 text-white rounded-md text-sm transition-colors">
            <Pencil className="mr-2 h-4 w-4" /> Modifier
          </button>
          <button onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md text-sm transition-colors">
            <Printer className="mr-2 h-4 w-4" /> Relevé
          </button>
          <button onClick={handleShowFactures}
            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md text-sm transition-colors">
            <FileText className="mr-2 h-4 w-4" /> Détail Factures
          </button>
          <button onClick={() => router.push('/dashboard/comptes-courants')}
            className="inline-flex items-center px-4 py-2 bg-red-600/30 hover:bg-red-600/50 text-white rounded-md text-sm transition-colors ml-auto">
            <X className="mr-2 h-4 w-4" /> Fermer
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10 group relative">
            <p className="text-sm font-medium text-white mb-1">Total Débit</p>
            <p className="text-3xl font-bold text-orange-400">{fmt(totalDebit)}</p>
            <p className="text-[11px] text-white mt-1">Ventes + Encaissements</p>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Info className="h-4 w-4 text-gray-500" />
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
              <div className="bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                Somme des montants en Débit (ce qui est dû au CC).
                <br />Ventes et encaissements clients augmentent le débit.
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10 group relative">
            <p className="text-sm font-medium text-white mb-1">Total Crédit</p>
            <p className="text-3xl font-bold text-emerald-400">{fmt(totalCredit)}</p>
            <p className="text-[11px] text-white mt-1">Achats + Paiements</p>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Info className="h-4 w-4 text-gray-500" />
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
              <div className="bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                Somme des montants en Crédit (ce qui est payé par le CC).
                <br />Achats et paiements fournisseurs augmentent le crédit.
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10">
            <p className="text-sm font-medium text-white mb-1">Solde Net</p>
            <p className={`text-3xl font-bold ${data.solde >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(Math.abs(data.solde))}
            </p>
            <p className={`text-xs mt-1 ${data.solde >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
              {data.solde >= 0 ? 'Débit (la personne doit au CC)' : 'Crédit (le CC doit à la personne)'}
            </p>
            {Math.abs(data.solde) < 1 && <p className="text-xs text-emerald-400 mt-2">✓ Compte soldé</p>}
          </div>
        </div>

        {/* Client / Fournisseur Info */}
        <div className="grid gap-4 md:grid-cols-2">
          {data.client && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-sm text-white mb-1">Client lié</p>
              <p className="font-medium">{data.client.nom}</p>
              <p className="text-xs text-white">{data.client.code} · {data.client.telephone}</p>
            </div>
          )}
          {data.fournisseur && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-sm text-white mb-1">Fournisseur lié</p>
              <p className="font-medium">{data.fournisseur.nom}</p>
              <p className="text-xs text-white">{data.fournisseur.code} · {data.fournisseur.telephone}</p>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {showEdit && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-white/10">
              <h3 className="text-lg font-bold mb-4">Modifier le Compte Courant</h3>
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom</label>
                  <input type="text" value={editNom} onChange={e => setEditNom(e.target.value)} required
                    className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">NCC</label>
                  <input type="text" value={editNcc} onChange={e => setEditNcc(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white"
                    placeholder="Numéro de compte" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Client lié</label>
                  <select value={editClientId} onChange={e => setEditClientId(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white">
                    <option value="">Aucun client</option>
                    {clientsList.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fournisseur lié</label>
                  <select value={editFournisseurId} onChange={e => setEditFournisseurId(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white">
                    <option value="">Aucun fournisseur</option>
                    {fournisseursList.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={savingEdit}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                    {savingEdit ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                    Enregistrer
                  </button>
                  <button type="button" onClick={() => setShowEdit(false)}
                    className="inline-flex items-center px-4 py-2 bg-white/10 text-white rounded-md text-sm hover:bg-white/20">
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
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-white/10">
              <h3 className="text-lg font-bold mb-4">Nouveau Règlement</h3>
              <form onSubmit={handleReglement} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Montant</label>
                  <input type="number" value={regMontant} onChange={e => setRegMontant(e.target.value)} required
                    className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white"
                    placeholder="0" min="1" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Mode de paiement</label>
                  <select value={regMode} onChange={e => setRegMode(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white">
                    <option value="ESPECES">Espèces</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="VIREMENT">Virement</option>
                    <option value="CHEQUE">Chèque</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regCaisse} onChange={e => setRegCaisse(e.target.checked)}
                      className="rounded border-white/20 bg-white/10" />
                    <span className="text-sm">Payer depuis la caisse</span>
                  </label>
                  {regCaisse && (
                    <select value={regMagasinId} onChange={e => setRegMagasinId(e.target.value)} required
                      className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white">
                      <option value="">Choisir un point de vente</option>
                      {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                    </select>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regBanque} onChange={e => setRegBanque(e.target.checked)}
                      className="rounded border-white/20 bg-white/10" />
                    <span className="text-sm">Payer depuis la banque</span>
                  </label>
                  {regBanque && (
                    <select value={regBanqueId} onChange={e => setRegBanqueId(e.target.value)} required
                      className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white">
                      <option value="">Choisir un compte bancaire</option>
                      {banques.map(b => <option key={b.id} value={b.id}>{b.libelle}</option>)}
                    </select>
                  )}
                  <p className="text-xs text-gray-400">Si ni caisse ni banque coché, le règlement sera enregistré en compte courant d&apos;associé (455).</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={savingReg}
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:opacity-50">
                    {savingReg ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                    Valider
                  </button>
                  <button type="button" onClick={() => setShowReglement(false)}
                    className="inline-flex items-center px-4 py-2 bg-white/10 text-white rounded-md text-sm hover:bg-white/20">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Compensation */}
        <div className="flex gap-2">
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
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            <Scale className="mr-2 h-4 w-4" />
            Compenser (écriture comptable)
          </button>
          <button onClick={handleExportExcel}
            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md text-sm transition-colors">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exporter Excel
          </button>
        </div>

        {/* Transactions Table */}
        <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-bold text-white">Détail chronologique des opérations</h3>
            <span className="text-xs text-white">{data.transactions.length} Événements</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-medium text-white">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-white">Libellé</th>
                  <th className="text-right py-3 px-4 font-medium text-white">Débit (+)</th>
                  <th className="text-right py-3 px-4 font-medium text-white">Crédit (−)</th>
                  <th className="text-right py-3 px-4 font-medium text-white">Solde</th>
                  <th className="text-center py-3 px-4 font-medium text-white">Lettrage</th>
                </tr>
              </thead>
              <tbody>
                {transactionsWithBalance.map((t, i) => {
                  const isEven = i % 2 === 0
                  return (
                    <tr key={t.id}
                      className={`border-b border-white/5 transition-colors ${isEven ? 'bg-white/5' : 'bg-transparent'} hover:bg-white/10`}>
                      <td className="py-2.5 px-4 whitespace-nowrap text-white/80 align-top">
                        <span>{new Date(t.date).toLocaleDateString('fr-FR')}</span>
                        <br /><span className="text-[10px] text-gray-500">
                          {new Date(t.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-white/90 max-w-[260px]">
                        <span className="block truncate" title={t.libelle}>{t.libelle}</span>
                        <span className={`text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded font-medium ${
                          t.type === 'ACHAT' ? 'bg-orange-600 text-white'
                          : t.type === 'VENTE' ? 'bg-blue-600 text-white'
                          : t.type === 'PAIEMENT_FOURNISSEUR' ? 'bg-purple-600 text-white'
                          : t.type === 'ENCAISSEMENT_CLIENT' ? 'bg-emerald-600 text-white'
                          : t.type === 'COMPENSATION' ? 'bg-cyan-600 text-white'
                          : 'bg-gray-600 text-white'
                        }`}>
                          {t.type === 'ACHAT' ? 'Achat'
                          : t.type === 'VENTE' ? 'Vente'
                          : t.type === 'PAIEMENT_FOURNISSEUR' ? 'Paiement'
                          : t.type === 'ENCAISSEMENT_CLIENT' ? 'Encaissement'
                          : t.type === 'COMPENSATION' ? 'Compensation'
                          : t.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-orange-400 font-medium align-top whitespace-nowrap">
                        {t.montantSigne > 0 ? fmt(t.montant) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-400 font-medium align-top whitespace-nowrap">
                        {t.montantSigne < 0 ? fmt(t.montant) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-bold align-top whitespace-nowrap ${t.runningBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(Math.abs(t.runningBalance))}
                        <span className="text-[10px] ml-1 opacity-70">{t.runningBalance >= 0 ? 'D' : 'C'}</span>
                      </td>
                      <td className="py-2.5 px-4 text-center align-top">
                        {t.referenceType === 'REGLEMENT_VENTE' || t.referenceType === 'REGLEMENT_ACHAT' ? (
                          <button onClick={() => handleLettrage(t.id)}
                            className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded transition-colors whitespace-nowrap border border-blue-400/30">
                            Lettrer
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comportement du solde */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-sm text-white leading-relaxed">
          <p className="font-medium text-white mb-1">Comportement du solde</p>
          Toutes les ventes validées augmentent le Débit (ce que le client doit). Les règlements et acomptes augmentent le Crédit (ce qu'il a payé). Le résultat positif (D) indique une dette restante, le négatif (C) indique un avoir client.
        </div>

        {/* Détail Factures Modal */}
        {showFactures && (
          <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 pt-6 pb-6 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl w-full max-w-3xl border border-white/10 flex flex-col my-auto">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-lg font-bold">Factures liées</h3>
                <button onClick={() => setShowFactures(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
                {facturesLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6" /></div>
                ) : factures.length === 0 ? (
                  <p className="text-center text-gray-500 py-12">Aucune facture trouvée.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-white/10">
                        <th className="text-left py-2 px-3 font-medium">Date</th>
                        <th className="text-left py-2 px-3 font-medium">Type</th>
                        <th className="text-left py-2 px-3 font-medium">Référence</th>
                        <th className="text-right py-2 px-3 font-medium">Montant</th>
                        <th className="text-center py-2 px-3 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {factures.map((f, i) => (
                        <tr key={`${f._type}-${f.id}`}
                          className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}`}>
                          <td className="py-2 px-3 whitespace-nowrap text-white/80">
                            {new Date(f.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              f._type === 'VENTE' ? 'bg-blue-600/20 text-blue-300' : 'bg-orange-600/20 text-orange-300'
                            }`}>
                              {f._type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-white/90">{f.numero || f.reference || '-'}</td>
                          <td className="py-2 px-3 text-right text-white/90 whitespace-nowrap">
                            {fmt(f.montantTotal || f.montant || 0)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              f.statut === 'VALIDE' || f.statut === 'LIVREE' || f.statut === 'PAYEE' || f.statut === 'PARTIELLE'
                                ? 'bg-emerald-600/20 text-emerald-300'
                                : f.statut === 'ANNULEE'
                                ? 'bg-red-600/20 text-red-300'
                                : 'bg-gray-600/20 text-gray-400'
                            }`}>
                              {f.statut || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Print Styles */}
        <style>{`
          @media print {
            body { background: white !important; }
            .min-h-screen { background: white !important; }
            button { display: none !important; }
            table { color: black !important; }
          }
        `}</style>
      </div>
    </div>
  )
}
