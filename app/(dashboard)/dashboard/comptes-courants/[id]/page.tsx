'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, Scale, Printer, FileSpreadsheet, Plus, DollarSign, FileText, X, Check } from 'lucide-react'

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

export default function CompteCourantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReglement, setShowReglement] = useState(false)
  const [regMontant, setRegMontant] = useState('')
  const [regMode, setRegMode] = useState('ESPECES')
  const [savingReg, setSavingReg] = useState(false)
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

  useEffect(() => { fetchDetail() }, [params.id])

  const totalDebit = data?.transactions.filter(t => t.montantSigne > 0).reduce((s, t) => s + t.montant, 0) || 0
  const totalCredit = data?.transactions.filter(t => t.montantSigne < 0).reduce((s, t) => s + t.montant, 0) || 0

  const handleReglement = async (e: React.FormEvent) => {
    e.preventDefault()
    const montant = Number(regMontant)
    if (!montant || montant <= 0) return
    setSavingReg(true)
    try {
      const res = await fetch('/api/comptes-courants/reglement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compteCourantId: data?.id,
          montant,
          modePaiement: regMode,
          clientId: data?.client?.id,
          fournisseurId: data?.fournisseur?.id,
        }),
      })
      if (res.ok) {
        setShowReglement(false)
        setRegMontant('')
        fetchDetail()
      } else {
        const err = await res.json()
        alert(err.error || 'Erreur lors du règlement')
      }
    } finally {
      setSavingReg(false)
    }
  }

  const handlePrint = () => window.print()

  const handleExportCSV = () => {
    if (!data) return
    const csv = [
      ['Date', 'Libellé', 'Débit (+)', 'Crédit (-)', 'Solde'].join(','),
      ...data.transactions.map(t => [
        new Date(t.date).toLocaleDateString('fr-FR'),
        `"${t.libelle}"`,
        t.montantSigne > 0 ? t.montant : '',
        t.montantSigne < 0 ? t.montant : '',
      ].join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CompteCourant_${data.nom}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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

  let runningBalance = 0

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
            <p className="text-sm text-gray-400">{data.code}{data.ncc ? ` · NCC: ${data.ncc}` : ''}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowReglement(true)}
            className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm transition-colors">
            <Plus className="mr-2 h-4 w-4" /> Nouveau Règlement
          </button>
          <button onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md text-sm transition-colors">
            <Printer className="mr-2 h-4 w-4" /> Relevé
          </button>
          <button
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
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10">
            <p className="text-sm font-medium text-gray-400 mb-2">Total Débit (Achats/Ventes)</p>
            <p className="text-3xl font-bold text-orange-400">{fmt(totalDebit)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10">
            <p className="text-sm font-medium text-gray-400 mb-2">Total Crédit (Règlements)</p>
            <p className="text-3xl font-bold text-emerald-400">{fmt(totalCredit)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10">
            <p className="text-sm font-medium text-gray-400 mb-2">Solde Net Final</p>
            <p className={`text-3xl font-bold ${data.solde >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(Math.abs(data.solde))}
            </p>
            {Math.abs(data.solde) < 1 && <p className="text-xs text-emerald-400 mt-2">Le compte est soldé</p>}
          </div>
        </div>

        {/* Client / Fournisseur Info */}
        <div className="grid gap-4 md:grid-cols-2">
          {data.client && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-sm text-gray-400 mb-1">Client lié</p>
              <p className="font-medium">{data.client.nom}</p>
              <p className="text-xs text-gray-500">{data.client.code} · {data.client.telephone}</p>
            </div>
          )}
          {data.fournisseur && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-sm text-gray-400 mb-1">Fournisseur lié</p>
              <p className="font-medium">{data.fournisseur.nom}</p>
              <p className="text-xs text-gray-500">{data.fournisseur.code} · {data.fournisseur.telephone}</p>
            </div>
          )}
        </div>

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
          <button onClick={handleExportCSV}
            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md text-sm transition-colors">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exporter Excel
          </button>
        </div>

        {/* Transactions Table */}
        <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-bold">Détail chronologique des opérations</h3>
            <span className="text-xs text-gray-400">{data.transactions.length} Événements</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Libellé / Réf</th>
                  <th className="text-right py-3 px-4">Débit (+)</th>
                  <th className="text-right py-3 px-4">Crédit (-)</th>
                  <th className="text-right py-3 px-4">Solde Progressif</th>
                  <th className="text-center py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map(t => {
                  runningBalance += t.montantSigne
                  return (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-white/80">
                        {new Date(t.date).toLocaleDateString('fr-FR')}
                        <br /><span className="text-[10px] text-gray-500">
                          {new Date(t.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white/90">{t.libelle}</td>
                      <td className="py-3 px-4 text-right text-orange-400 font-medium">
                        {t.montantSigne > 0 ? fmt(t.montant) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-medium">
                        {t.montantSigne < 0 ? fmt(t.montant) : '—'}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${runningBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(Math.abs(runningBalance))}
                        <span className="text-xs ml-1">{runningBalance >= 0 ? 'D' : 'C'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {t.referenceType === 'REGLEMENT_VENTE' || t.referenceType === 'REGLEMENT_ACHAT' ? (
                          <button onClick={() => handleLettrage(t.id)}
                            className="text-xs px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded transition-colors">
                            Lettrer
                          </button>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
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
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-sm text-gray-400 leading-relaxed">
          <p className="font-medium text-white mb-1">Comportement du solde</p>
          Toutes les ventes validées augmentent le Débit (ce que le client doit). Les règlements et acomptes augmentent le Crédit (ce qu'il a payé). Le résultat positif (D) indique une dette restante, le négatif (C) indique un avoir client.
        </div>

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
