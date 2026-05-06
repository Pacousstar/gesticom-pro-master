'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { 
  Users, Search, Calendar, FileText, Download, Printer, 
  ArrowLeft, Loader2, DollarSign, CreditCard, ChevronRight,
  TrendingDown, TrendingUp, Wallet
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/format-date'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import Pagination from '@/components/ui/Pagination'

type Fournisseur = {
  id: number
  nom: string
  code: string | null
  telephone: string | null
  dette: number
}

type Achat = {
  id: number
  numero: string
  date: string
  montantTotal: number
  montantPaye: number
  modePaiement: string
  statut: string
  statutPaiement: string
  lignes: Array<{
    designation: string
    quantite: number
    prixUnitaire: number
  }>
}

export default function FournisseurRelevesPage() {
  const searchParams = useSearchParams()
  const initialFournisseurId = searchParams.get('id')
  const { error: showError } = useToast()

  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [selectedFournisseurId, setSelectedFournisseurId] = useState<string>(initialFournisseurId || '')
  const [dateDebut, setDateDebut] = useState<string>(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [dateFin, setDateFin] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [historyData, setHistoryData] = useState<Achat[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null)

  useEffect(() => {
    fetchFournisseurs()
  }, [])

  useEffect(() => {
    if (initialFournisseurId) {
      fetchHistory(Number(initialFournisseurId))
    }
  }, [initialFournisseurId])

  const fetchFournisseurs = async () => {
    try {
      const res = await fetch('/api/fournisseurs?limit=1000')
      if (res.ok) {
        const data = await res.json()
        setFournisseurs(data.data || [])
      }
    } catch (e) {
      showError("Erreur chargement fournisseurs.")
    }
  }

  const fetchHistory = async (fournisseurId: number) => {
    if (!fournisseurId) return
    setLoadingHistory(true)
    try {
      const params = new URLSearchParams()
      if (dateDebut) params.set('start', dateDebut)
      if (dateFin) params.set('end', dateFin)
      
      const res = await fetch(`/api/rapports/achats/fournisseurs/${fournisseurId}/history?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setHistoryData(data)
        const selected = fournisseurs.find(f => f.id === fournisseurId)
        setSelectedFournisseur(selected || null)
      } else {
        showError("Impossible de charger le relevé.")
      }
    } catch (e) {
      showError("Erreur réseau lors du chargement du relevé.")
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleFournisseurChange = (fId: string) => {
    setSelectedFournisseurId(fId)
    if (fId) {
      fetchHistory(Number(fId))
    } else {
      setHistoryData([])
      setSelectedFournisseur(null)
    }
  }

  const handleDateChange = () => {
    if (selectedFournisseurId) {
      fetchHistory(Number(selectedFournisseurId))
    }
  }

  const totalAchats = useMemo(() => historyData.reduce((acc, a) => acc + (a.montantTotal || 0), 0), [historyData])
  const totalPaye = useMemo(() => historyData.reduce((acc, a) => acc + (a.montantPaye || 0), 0), [historyData])
  const resteAPayer = totalAchats - totalPaye

  const handlePrint = () => window.print()

  const handleExport = async () => {
    if (!selectedFournisseurId || !selectedFournisseur) return
    try {
      const params = new URLSearchParams()
      params.set('fournisseurId', selectedFournisseurId)
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)
      
      const res = await fetch(`/api/fournisseurs/${selectedFournisseurId}/compte-courant/export?${params.toString()}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `releve_compte_${selectedFournisseur.nom}_${dateDebut}_${dateFin}.pdf`
        a.click()
      }
    } catch (e) {
      showError("Erreur lors de l'export.")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relevés de Comptes - Fournisseurs</h1>
          <p className="text-gray-500 text-sm">Générer les relevés de compte fournisseurs par période</p>
        </div>
        <button onClick={() => window.location.href = '/dashboard/fournisseurs'} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
          <select
            value={selectedFournisseurId}
            onChange={(e) => handleFournisseurChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
          >
            <option value="">Sélectionner un fournisseur</option>
            {fournisseurs.map(f => (
              <option key={f.id} value={f.id}>{f.code || ''} - {f.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} onBlur={handleDateChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
          <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} onBlur={handleDateChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none" />
        </div>
      </div>

      {selectedFournisseurId && (
        <div className="flex gap-2 no-print">
          <button onClick={handlePrint} className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
            <Printer className="h-4 w-4" /> Imprimer
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">
            <Download className="h-4 w-4" /> Exporter PDF
          </button>
        </div>
      )}

      {!selectedFournisseurId ? (
        <div className="text-center py-20 text-gray-500">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Sélectionnez un fournisseur pour générer son relevé de compte</p>
        </div>
      ) : loadingHistory ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          <p className="ml-3 text-gray-500">Génération du relevé en cours...</p>
        </div>
      ) : historyData.length === 0 ? (
        <div className="text-center py-20 text-gray-500 no-print">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
          Aucun achat enregistré pour ce fournisseur sur cette période.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="hidden print:block border-b-2 border-gray-900 pb-4 mb-6">
            <h1 className="text-2xl font-bold uppercase">Relevé de Compte Fournisseur</h1>
            <p className="text-lg font-medium">Fournisseur : {selectedFournisseur?.nom}</p>
            <p className="text-sm text-gray-600 italic">Édité le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-600 rounded-xl p-4 text-white shadow-lg border-b-4 border-blue-800">
              <p className="text-[10px] uppercase font-bold text-blue-100">Total Achats</p>
              <p className="text-xl font-black italic tracking-tighter">{totalAchats.toLocaleString()} F</p>
            </div>
            <div className="bg-emerald-600 rounded-xl p-4 text-white shadow-lg border-b-4 border-emerald-800">
              <p className="text-[10px] uppercase font-bold text-emerald-100">Total Payé</p>
              <p className="text-xl font-black italic tracking-tighter">{totalPaye.toLocaleString()} F</p>
            </div>
            <div className="bg-red-600 rounded-xl p-4 text-white shadow-lg border-b-4 border-red-800">
              <p className="text-[10px] uppercase font-bold text-red-100">Reste à Payer</p>
              <p className="text-xl font-black italic tracking-tighter">{resteAPayer.toLocaleString()} F</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest border-l-4 border-blue-600 pl-3">Détail chronologique</h3>
            {historyData.map((a, i) => (
              <div key={i} className="border-2 border-gray-100 rounded-2xl p-5 bg-white hover:border-blue-200 hover:shadow-xl transition-all group relative overflow-hidden">
                <div className="absolute top-2 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <FileText className="h-16 w-16 -rotate-12" />
                </div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div>
                    <p className="font-bold text-gray-900">{a.numero}</p>
                    <p className="text-sm text-gray-500">{new Date(a.date).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg text-gray-900">{Number(a.montantTotal).toLocaleString()} F</p>
                    <p className={`text-xs font-medium ${Number(a.montantPaye) >= Number(a.montantTotal) ? 'text-green-600' : 'text-orange-600'}`}>
                      Payé: {Number(a.montantPaye).toLocaleString()} F
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}