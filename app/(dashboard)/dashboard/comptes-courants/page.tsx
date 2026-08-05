'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Plus, Trash2, ArrowLeftRight, UserCheck, Printer, FileSpreadsheet, X, Wallet } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { extractList } from '@/lib/api-client'

interface CompteCourant {
  id: number
  code: string
  nom: string
  ncc: string | null
  clientId: number | null
  fournisseurId: number | null
  client: { id: number; nom: string; telephone: string | null } | null
  fournisseur: { id: number; nom: string; telephone: string | null } | null
  solde: number
}

interface Match {
  clientId: number
  clientNom: string
  fournisseurId: number
  fournisseurNom: string
  type: string
}

export default function ComptesCourantsPage() {
  const router = useRouter()
  const { error: showError, success: showSuccess } = useToast()
  const [comptes, setComptes] = useState<CompteCourant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [showDetect, setShowDetect] = useState(false)
  const [associe, setAssocie] = useState<{ solde: number; historique: Array<{ id: number; date: string; libelle: string; debit: number; credit: number }> } | null>(null)
  const [magasins, setMagasins] = useState<Array<{ id: number; nom: string }>>([])
  const [banques, setBanques] = useState<Array<{ id: number; numero: string; nomBanque?: string; nom?: string; libelle: string }>>([])
  const [showRemboursement, setShowRemboursement] = useState(false)
  const [rembForm, setRembForm] = useState({ montant: '', modePaiement: 'ESPECES', magasinId: '', banqueId: '', observation: '' })
  const [savingRemb, setSavingRemb] = useState(false)

  const fetchComptes = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/comptes-courants')
      if (res.ok) setComptes(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const fetchAssocie = async () => {
    const res = await fetch('/api/associes/remboursement')
    if (res.ok) setAssocie(await res.json())
  }

  const handleRembourser = async () => {
    const montant = Number(rembForm.montant) || 0
    if (montant <= 0) {
      showError('Montant invalide.')
      return
    }
    setSavingRemb(true)
    try {
      const res = await fetch('/api/associes/remboursement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montant,
          modePaiement: rembForm.modePaiement,
          magasinId: rembForm.modePaiement === 'ESPECES' ? rembForm.magasinId : undefined,
          banqueId: rembForm.modePaiement !== 'ESPECES' ? rembForm.banqueId : undefined,
          observation: rembForm.observation || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showSuccess('Remboursement enregistré.')
        setShowRemboursement(false)
        setRembForm({ montant: '', modePaiement: 'ESPECES', magasinId: '', banqueId: '', observation: '' })
        fetchAssocie()
      } else {
        showError(data.error || 'Erreur lors du remboursement.')
      }
    } catch {
      showError('Erreur lors du remboursement.')
    } finally {
      setSavingRemb(false)
    }
  }

  const fetchDetect = async () => {
    const res = await fetch('/api/comptes-courants/detect', { method: 'POST', body: '{}' })
    if (res.ok) setMatches(await res.json())
    setShowDetect(true)
  }

  const linkMatch = async (m: Match) => {
    const res = await fetch('/api/comptes-courants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: m.clientId, fournisseurId: m.fournisseurId, nom: m.clientNom }),
    })
    if (res.ok) {
      setMatches(matches.filter(x => x.clientId !== m.clientId || x.fournisseurId !== m.fournisseurId))
      fetchComptes()
    } else {
      try {
        const err = await res.json()
        showError(err.error || 'Erreur lors de la liaison.')
      } catch {
        showError('Erreur lors de la liaison (veuillez réessayer).')
      }
    }
  }

  const deleteCompte = async (id: number) => {
    if (!confirm('Supprimer ce compte courant ?')) return
    await fetch(`/api/comptes-courants/${id}`, { method: 'DELETE' })
    fetchComptes()
  }

  useEffect(() => {
    fetchComptes()
    fetchAssocie()
    fetch('/api/magasins').then((r) => (r.ok ? r.json() : [])).then((d) => setMagasins(extractList(d))).catch(() => setMagasins([]))
    fetch('/api/banques').then((r) => (r.ok ? r.json() : null)).then((d) => setBanques(extractList(d))).catch(() => setBanques([]))
  }, [])

  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

  const filtered = comptes.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.ncc && c.ncc.toLowerCase().includes(search.toLowerCase()))
  )

  const handleExportExcel = () => {
    const csv = [
      ['Code', 'Nom', 'NCC', 'Client', 'Fournisseur', 'Solde'].join(','),
      ...filtered.map(c => [
        c.code,
        `"${c.nom}"`,
        c.ncc || '',
        c.client?.nom || '',
        c.fournisseur?.nom || '',
        c.solde,
      ].join(','))
    ].join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ComptesCourants_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Comptes Courants</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Gestion des comptes clients et fournisseurs</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={fetchDetect}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 transition-all">
            <UserCheck className="h-4 w-4" />
            Détection auto
          </button>
          <button onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 transition-all">
            <FileSpreadsheet className="h-4 w-4" />
            Export
          </button>
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 transition-all">
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button onClick={() => router.push('/dashboard/comptes-courants/nouveau')}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 shadow-md transition-all">
            <Plus className="h-4 w-4" />
            Nouveau
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 no-print">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input placeholder="Rechercher par nom, code ou NCC..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm" />
        </div>
      </div>

      {/* Compte courant associé (455) */}
      {associe && (
        <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 p-3">
                <Wallet className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <h2 className="font-black text-gray-900">Compte courant associé</h2>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Compte 455 — dette envers l'associé</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-amber-700">{fmt(associe.solde)}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Solde remboursable</p>
            </div>
            <button
              onClick={() => setShowRemboursement(true)}
              disabled={associe.solde <= 0}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Rembourser
            </button>
          </div>
          {associe.historique.length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto rounded-lg bg-white/70 border border-amber-100 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Derniers remboursements</p>
              <ul className="space-y-1.5">
                {associe.historique.slice(0, 8).map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                    <span className="truncate">{h.libelle}</span>
                    <span className="shrink-0 text-amber-700 font-bold">
                      {new Date(h.date).toLocaleDateString('fr-FR')} — {fmt(h.debit || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Modal Remboursement associé */}
      {showRemboursement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900">Rembourser l'associé</h3>
              <button onClick={() => setShowRemboursement(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Montant *</label>
                <input
                  type="number"
                  min={1}
                  max={associe?.solde ?? 0}
                  value={rembForm.montant}
                  onChange={(e) => setRembForm((prev) => ({ ...prev, montant: e.target.value }))}
                  placeholder={`Max ${associe?.solde ?? 0}`}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mode de paiement</label>
                <select
                  value={rembForm.modePaiement}
                  onChange={(e) => setRembForm((prev) => ({ ...prev, modePaiement: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-500 focus:outline-none"
                >
                  <option value="ESPECES">Espèces (caisse)</option>
                  <option value="MOBILE_MONEY">Mobile money</option>
                  <option value="VIREMENT">Virement</option>
                  <option value="CHEQUE">Chèque</option>
                </select>
              </div>
              {rembForm.modePaiement === 'ESPECES' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Point de vente (Caisse) *</label>
                  <select
                    required
                    value={rembForm.magasinId}
                    onChange={(e) => setRembForm((prev) => ({ ...prev, magasinId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">— Sélectionner une caisse —</option>
                    {magasins.map((m) => (
                      <option key={m.id} value={m.id}>{m.nom}</option>
                    ))}
                  </select>
                </div>
              )}
              {rembForm.modePaiement !== 'ESPECES' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Compte bancaire *</label>
                  <select
                    required
                    value={rembForm.banqueId}
                    onChange={(e) => setRembForm((prev) => ({ ...prev, banqueId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">— Sélectionner un compte —</option>
                    {banques.map((b) => (
                      <option key={b.id} value={b.id}>{b.libelle} ({b.numero})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Observation</label>
                <input
                  type="text"
                  value={rembForm.observation}
                  onChange={(e) => setRembForm((prev) => ({ ...prev, observation: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowRemboursement(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all">
                Annuler
              </button>
              <button
                onClick={handleRembourser}
                disabled={savingRemb}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-md transition-all disabled:opacity-50"
              >
                {savingRemb && <Loader2 className="animate-spin h-4 w-4" />}
                {savingRemb ? 'Enregistrement...' : 'Rembourser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Matches */}
      {showDetect && matches.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900">Correspondances détectées</h3>
            <button onClick={() => setShowDetect(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all">
              <X className="h-3.5 w-3.5" /> Fermer
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase">
                <th className="text-left py-2 font-semibold">Client</th>
                <th className="text-left py-2 font-semibold">Fournisseur</th>
                <th className="text-left py-2 font-semibold">Type</th>
                <th className="py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={`${m.clientId}-${m.fournisseurId}`} className="border-b border-gray-100">
                  <td className="py-2 text-gray-700">{m.clientNom}</td>
                  <td className="py-2 text-gray-700">{m.fournisseurNom}</td>
                  <td className="py-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">{m.type}</span>
                  </td>
                  <td className="py-2 text-center">
                    <button onClick={() => linkMatch(m)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all">Lier</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDetect && matches.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Aucune nouvelle correspondance détectée.</span>
            <button onClick={() => setShowDetect(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all">
              <X className="h-3.5 w-3.5" /> Fermer
            </button>
          </div>
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin h-8 w-8 text-orange-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500 shadow-sm">
          Aucun compte courant trouvé.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(cc => (
            <div key={cc.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-orange-200 transition-all cursor-pointer group"
              onClick={() => router.push(`/dashboard/comptes-courants/${cc.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 truncate">{cc.nom}</p>
                  <p className="text-xs text-gray-500">{cc.code}</p>
                  {cc.ncc && <p className="text-xs text-gray-400 truncate" title={`NCC: ${cc.ncc}`}>NCC: {cc.ncc}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-lg font-black ${cc.solde >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmt(Math.abs(cc.solde))}
                  </p>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${cc.solde >= 0 ? 'text-emerald-600/70' : 'text-red-500/70'}`}>
                    {cc.solde >= 0 ? 'Débiteur' : 'Créditeur'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {cc.client && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium" title={`Client: ${cc.client.nom}`}>Client: {cc.client.nom}</span>}
                {cc.fournisseur && <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-medium" title={`Fournisseur: ${cc.fournisseur.nom}`}>Fournisseur: {cc.fournisseur.nom}</span>}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                <button onClick={e => { e.stopPropagation(); router.push(`/dashboard/comptes-courants/${cc.id}`) }}
                  className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-sm transition-all">
                  <ArrowLeftRight className="h-3 w-3" /> Détail
                </button>
                <button onClick={e => { e.stopPropagation(); deleteCompte(cc.id) }}
                  className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-lg transition-all">
                  <Trash2 className="h-3 w-3" /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
