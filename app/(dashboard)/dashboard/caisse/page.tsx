'use client'

import { useState, useEffect } from 'react'
import { Wallet, Plus, Loader2, ArrowDownCircle, ArrowUpCircle, Filter, X, Search, FileSpreadsheet, Download, Trash2, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'
import { MESSAGES } from '@/lib/messages'
import Pagination from '@/components/ui/Pagination'
import { extractList } from '@/lib/api-client'
import { paginateForPrint } from '@/lib/print-helpers'

type Magasin = { id: number; code: string; nom: string }
type OperationCaisse = {
  id: number
  date: string
  type: string
  motif: string
  montant: number
  magasin: { id: number; code: string; nom: string }
  utilisateur: { nom: string; login: string }
}

export default function CaissePage() {
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [operations, setOperations] = useState<OperationCaisse[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState<'ENTREE' | 'SORTIE'>('ENTREE')
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    magasinId: '',
    motif: '',
    montant: '',
  })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const { success: showSuccess, error: showError } = useToast()
  const today = new Date().toISOString().split('T')[0]
  const [dateDebut, setDateDebut] = useState(today)
  const [dateFin, setDateFin] = useState(today)
  const [filtreMagasin, setFiltreMagasin] = useState('')
  const [filtreType, setFiltreType] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [stats, setStats] = useState({ 
    stats: { ESPECES: 0, MOBILE_MONEY: 0, VIREMENT: 0, CHEQUE: 0 },
    ouvertures: { ESPECES: 0, MOBILE_MONEY: 0, VIREMENT: 0, CHEQUE: 0 },
    mouvements: { ESPECES: { entrees: 0, sorties: 0 }, MOBILE_MONEY: { entrees: 0, sorties: 0 }, VIREMENT: { entrees: 0, sorties: 0 }, CHEQUE: { entrees: 0, sorties: 0 } },
    credits: {
      client: { total: 0, count: 0 },
      fournisseur: { total: 0, count: 0 }
    }
  })
  const [statsPeriod, setStatsPeriod] = useState({ totalEntrees: 0, totalSorties: 0, solde: 0 })
  const [statsLoading, setStatsLoading] = useState(false)
  const [totalEntries, setTotalEntries] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [caissePhysique, setCaissePhysique] = useState('')
  const [allOperationsForPrint, setAllOperationsForPrint] = useState<OperationCaisse[]>([])

  useEffect(() => {
    setCurrentPage(1)
  }, [dateDebut, dateFin, filtreMagasin, filtreType, searchTerm])

  useEffect(() => {
    fetch('/api/auth/check')
      .then((r) => r.ok && r.json())
      .then((d) => {
        if (d) {
          setUserRole(d.role)
        }
      })
      .catch(() => { })
  }, [])

  const fetchOperations = () => {
    setLoading(true)
    const params = new URLSearchParams({ 
      page: String(currentPage),
      limit: String(itemsPerPage) 
    })
    if (dateDebut) params.set('dateDebut', dateDebut)
    if (dateFin) params.set('dateFin', dateFin)
    if (filtreMagasin) params.set('magasinId', filtreMagasin)
    if (filtreType) params.set('type', filtreType)
    if (searchTerm) params.set('search', searchTerm)

    fetch('/api/caisse?' + params.toString())
      .then((r) => (r.ok ? r.json() : { data: [], total: 0, totalGlobal: 0, stats: { totalEntrees: 0, totalSorties: 0, solde: 0 } }))
      .then((res) => {
        setOperations(extractList(res))
        setTotalEntries(res.total ?? res.totalGlobal ?? 0)
        setTotalPages(Math.ceil((res.total || 0) / itemsPerPage))
        // Utiliser les stats de la page pour la cohérence visuelle, mais garder les stats globales si pas de filtre
        setStatsPeriod(res.stats || { totalEntrees: 0, totalSorties: 0, solde: 0 })
      })
      .catch((e) => {
        console.error('fetchOperations error:', e)
        setOperations([])
        setTotalEntries(0)
        setTotalPages(0)
        setStatsPeriod({ totalEntrees: 0, totalSorties: 0, solde: 0 })
      })
      .finally(() => setLoading(false))

    // Les stats (consolidation) restent globales pour la période filtrée
    setStatsLoading(true)
    const statsParams = new URLSearchParams()
    if (dateDebut) statsParams.set('dateDebut', dateDebut)
    if (dateFin) statsParams.set('dateFin', dateFin)
    if (filtreMagasin) statsParams.set('magasinId', filtreMagasin)

    fetch('/api/caisse/consolidation?' + statsParams.toString())
      .then((r) => (r.ok ? r.json() : { 
        stats: { ESPECES: 0, MOBILE_MONEY: 0, VIREMENT: 0, CHEQUE: 0 },
        ouvertures: { ESPECES: 0, MOBILE_MONEY: 0, VIREMENT: 0, CHEQUE: 0 },
        mouvements: { ESPECES: { entrees: 0, sorties: 0 }, MOBILE_MONEY: { entrees: 0, sorties: 0 }, VIREMENT: { entrees: 0, sorties: 0 }, CHEQUE: { entrees: 0, sorties: 0 } },
        credits: { client: { total: 0, count: 0 }, fournisseur: { total: 0, count: 0 } }
      }))
      .then(setStats)
      .finally(() => setStatsLoading(false))
  }

  useEffect(() => {
    fetch('/api/magasins')
      .then((r) => (r.ok ? r.json() : []))
      .then(setMagasins)
  }, [])

  useEffect(() => {
    fetchOperations()
  }, [dateDebut, dateFin, filtreMagasin, filtreType, currentPage, searchTerm])

  const openForm = (type: 'ENTREE' | 'SORTIE') => {
    setFormType(type)
    setFormData({
      date: new Date().toISOString().split('T')[0],
      magasinId: filtreMagasin || '',
      motif: '',
      montant: '',
    })
    setErr('')
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const montant = Number(formData.montant) || 0
    if (!formData.magasinId) {
      setErr('Sélectionnez un magasin.')
      return
    }
    if (!formData.motif.trim()) {
      setErr('Motif requis.')
      return
    }
    if (montant <= 0) {
      setErr('Montant doit être supérieur à 0.')
      return
    }

    const requestData = {
      date: formData.date,
      magasinId: Number(formData.magasinId),
      type: formType,
      motif: formData.motif.trim(),
      montant,
    }

    // Dans GestiCom Offline, l'enregistrement se fait toujours directement vers le serveur local.

    setSaving(true)
    try {
      const res = await fetch('/api/caisse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })
      const data = await res.json()
      if (res.ok) {
        setFormOpen(false)
        fetchOperations()
        setTimeout(() => fetchOperations(), 500)
        showSuccess(MESSAGES.CAISSE_ENREGISTREE)
      } else {
        const errorMsg = formatApiError(data.error || 'Erreur lors de l\'enregistrement.')
        setErr(errorMsg)
        showError(errorMsg)
      }
    } catch (e) {
      const errorMsg = formatApiError(e)
      setErr(errorMsg)
      showError(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const totalEntrees = statsPeriod.totalEntrees
  const totalSorties = statsPeriod.totalSorties
  const soldeMouvements = statsPeriod.solde

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="h-8 w-8 text-white" />
            Caisse
            <span className="ml-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-bold tracking-widest text-emerald-100 shadow-sm">
              {totalEntries} ÉCRITURES
            </span>
          </h1>
          <p className="mt-1 text-white/90">Mouvements d&apos;entrée et de sortie de caisse par magasin</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            Filtres
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const params = new URLSearchParams({ limit: '10000' })
                if (dateDebut) params.set('dateDebut', dateDebut)
                if (dateFin) params.set('dateFin', dateFin)
                if (filtreMagasin) params.set('magasinId', filtreMagasin)
                if (filtreType) params.set('type', filtreType)
                if (searchTerm) params.set('search', searchTerm)

                const res = await fetch('/api/caisse?' + params.toString())
                if (res.ok) {
                  const data = await res.json()
                  setAllOperationsForPrint(data.data || [])
                  setIsPreviewOpen(true)
                }
              } catch (e) {
                console.error(e)
                showError("Erreur lors de la préparation de l'aperçu.")
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-orange-500 bg-orange-50 px-4 py-2 text-sm font-black text-orange-800 hover:bg-orange-100 shadow-md transition-all active:scale-95"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button
            type="button"
            onClick={() => openForm('ENTREE')}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <ArrowDownCircle className="h-4 w-4" />
            Entrée caisse
          </button>
          <button
            type="button"
            onClick={() => openForm('SORTIE')}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <ArrowUpCircle className="h-4 w-4" />
            Sortie caisse
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date début</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date fin</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Magasin</label>
              <select
                value={filtreMagasin}
                onChange={(e) => setFiltreMagasin(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {magasins.map((m) => (
                  <option key={m.id} value={String(m.id)}>{m.code} – {m.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                value={filtreType}
                onChange={(e) => setFiltreType(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                <option value="ENTREE">Entrée</option>
                <option value="SORTIE">Sortie</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Barre de recherche et exports */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par motif, magasin, utilisateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams()
              if (dateDebut) params.set('dateDebut', dateDebut)
              if (dateFin) params.set('dateFin', dateFin)
              if (filtreMagasin) params.set('magasinId', filtreMagasin)
              if (filtreType) params.set('type', filtreType)
              window.open(`/api/caisse/export-excel?${params.toString()}`, '_blank')
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
            title="Exporter les opérations en Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams()
              if (dateDebut) params.set('dateDebut', dateDebut)
              if (dateFin) params.set('dateFin', dateFin)
              if (filtreMagasin) params.set('magasinId', filtreMagasin)
              if (filtreType) params.set('type', filtreType)
              window.open(`/api/caisse/export-pdf?${params.toString()}`, '_blank')
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            title="Exporter les opérations en PDF"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <p className="text-sm font-medium text-white/90">Total entrées (Période)</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalEntrees.toLocaleString('fr-FR')} FCFA</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-red-500 to-rose-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <p className="text-sm font-medium text-white/90">Total sorties (Période)</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalSorties.toLocaleString('fr-FR')} FCFA</p>
        </div>
        <div className={`rounded-xl bg-gradient-to-br p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105 ${soldeMouvements >= 0
          ? 'from-blue-500 to-cyan-600'
          : 'from-orange-500 to-red-600'
          }`}>
          <p className="text-sm font-medium text-white/90">Solde (E − S Période)</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {soldeMouvements.toLocaleString('fr-FR')} FCFA
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white border-2 border-amber-100 p-5 shadow-sm">
           <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Crédits Clients (À Percevoir)</p>
                <p className="mt-1 text-2xl font-black text-amber-900">{stats.credits?.client?.total?.toLocaleString('fr-FR')} F</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Factures</p>
                <p className="text-xl font-black text-amber-600">{stats.credits?.client?.count ?? 0}</p>
              </div>
           </div>
        </div>
        <div className="rounded-xl bg-white border-2 border-rose-100 p-5 shadow-sm">
           <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Dettes Fournisseurs (À Régler)</p>
                <p className="mt-1 text-2xl font-black text-rose-900">{stats.credits?.fournisseur?.total?.toLocaleString('fr-FR')} F</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Factures</p>
                <p className="text-xl font-black text-rose-600">{stats.credits?.fournisseur?.count ?? 0}</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-1">
        {[
          { label: 'Solde Réel en Espèces (Tiroir-Caisse)', key: 'ESPECES', color: 'from-green-600 to-emerald-700' },
        ].map((s, i) => {
          const ouv = stats.ouvertures[s.key as keyof typeof stats.ouvertures] || 0
          const mvt = stats.stats[s.key as keyof typeof stats.stats] || 0
          const final = ouv + mvt

          return (
            <div key={i} className={`rounded-xl bg-gradient-to-br ${s.color} p-6 shadow-md transition-all hover:scale-[1.02]`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold uppercase tracking-widest text-white/90">{s.label}</p>
                <Wallet className="h-6 w-6 text-white/50" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1 border-r border-white/10 pr-4">
                   <span className="text-[10px] text-white/70 uppercase font-bold">Report (Début de période)</span>
                   <p className="text-xl font-bold text-white">{statsLoading ? '...' : ouv.toLocaleString('fr-FR')} F</p>
                </div>
                <div className="space-y-1 border-r border-white/10 pr-4">
                   <span className="text-[10px] text-white/70 uppercase font-bold">Flux Net (Entrées - Sorties)</span>
                   <p className="text-xl font-bold text-white">{statsLoading ? '...' : (mvt >=0 ? '+' : '') + mvt.toLocaleString('fr-FR')} F</p>
                </div>
                <div className="space-y-1">
                   <span className="text-[10px] text-emerald-200 uppercase font-black">Solde Cash Actuel</span>
                   <p className="text-3xl font-black text-white leading-none">
                     {statsLoading ? '...' : `${final.toLocaleString('fr-FR')} F`}
                   </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Arrêté de Caisse du Jour — comparaison avec caisse physique */}
      <div className="rounded-xl bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 p-6 shadow-xl ring-2 ring-purple-300/30 transition-all hover:shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-200" />
              Arrêté de Caisse du Jour
            </h2>
            <p className="text-[11px] font-medium text-purple-200/80 mt-0.5">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="space-y-1 border-r border-purple-400/30 pr-5">
            <span className="text-[10px] text-purple-200 uppercase font-black tracking-wider">Report (J-1)</span>
            <p className="text-2xl font-black text-white">{statsLoading ? '...' : (stats.ouvertures.ESPECES || 0).toLocaleString('fr-FR')} F</p>
          </div>
          <div className="space-y-1 border-r border-purple-400/30 pr-5">
            <span className="text-[10px] text-purple-200 uppercase font-black tracking-wider">+ Encaissements</span>
            <p className="text-2xl font-black text-emerald-300">+{(stats.mouvements?.ESPECES?.entrees || 0).toLocaleString('fr-FR')} F</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-purple-200 uppercase font-black tracking-wider">− Décaissements</span>
            <p className="text-2xl font-black text-rose-300">−{(stats.mouvements?.ESPECES?.sorties || 0).toLocaleString('fr-FR')} F</p>
          </div>
        </div>

        <div className="mt-6 h-px bg-gradient-to-r from-purple-400/0 via-purple-300/50 to-purple-400/0" />

        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3 items-end">
          <div className="space-y-1">
            <span className="text-[11px] text-purple-200 uppercase font-black tracking-wider">Solde Attendu</span>
            <p className="text-4xl font-black text-white drop-shadow-lg">
              {statsLoading ? '...' : `${((stats.ouvertures.ESPECES || 0) + (stats.stats.ESPECES || 0)).toLocaleString('fr-FR')} F`}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-purple-200 uppercase font-black tracking-wider">Caisse Physique Comptée</span>
            <input
              type="number"
              value={caissePhysique}
              onChange={(e) => setCaissePhysique(e.target.value)}
              placeholder="Saisir le montant compté..."
              className="w-full rounded-xl border-2 border-purple-300/40 bg-white/10 px-4 py-3 text-2xl font-black text-white placeholder-purple-200/50 backdrop-blur-sm transition-all focus:border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-purple-200 uppercase font-black tracking-wider">Écart</span>
            {caissePhysique ? (() => {
              const attendu = (stats.ouvertures.ESPECES || 0) + (stats.stats.ESPECES || 0)
              const physique = Number(caissePhysique) || 0
              const ecart = physique - attendu
              const absEcart = Math.abs(ecart)
              return (
                <p className={`text-4xl font-black drop-shadow-lg ${ecart === 0 ? 'text-emerald-300' : ecart > 0 ? 'text-yellow-300' : 'text-rose-300'}`}>
                  {ecart >= 0 ? '+' : ''}{absEcart.toLocaleString('fr-FR')} F
                </p>
              )
            })() : (
              <p className="text-xl font-bold text-purple-200/60">—</p>
            )}
          </div>
        </div>

        {caissePhysique && (() => {
          const attendu = (stats.ouvertures.ESPECES || 0) + (stats.stats.ESPECES || 0)
          const physique = Number(caissePhysique) || 0
          const ecart = physique - attendu
          const absEcart = Math.abs(ecart)
          if (ecart !== 0) {
            return (
              <div className={`mt-5 rounded-xl px-5 py-3 text-sm font-bold uppercase tracking-wider ${ecart > 0 ? 'bg-yellow-500/20 text-yellow-200' : 'bg-rose-500/20 text-rose-200'}`}>
                ⚠ {ecart > 0
                  ? `Excédent de ${ecart.toLocaleString('fr-FR')} F — la caisse physique est supérieure au solde attendu`
                  : `Déficit de ${absEcart.toLocaleString('fr-FR')} F — la caisse physique est inférieure au solde attendu`
                }
              </div>
            )
          }
          return (
            <div className="mt-5 rounded-xl bg-emerald-500/20 px-5 py-3 text-sm font-bold uppercase tracking-wider text-emerald-200">
              ✓ Écart nul — la caisse physique correspond exactement au solde attendu
            </div>
          )
        })()}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm no-print">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : operations.length === 0 ? (
          <div className="py-12 text-center text-gray-500">Aucun mouvement sur la période.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Magasin</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Motif</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {operations.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {new Date(o.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${o.type === 'ENTREE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                        >
                          {o.type === 'ENTREE' ? 'Entrée' : 'Sortie'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                        {o.magasin.code} – {o.magasin.nom}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {o.motif}
                        {o.motif && !o.motif.toLowerCase().includes('vente') && !o.motif.toLowerCase().includes('achat') && !o.motif.toLowerCase().includes('règlement') && o.utilisateur?.nom !== 'Système' && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10 uppercase tracking-tighter" title="Opération Manuelle">
                            Manuel
                          </span>
                        )}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right text-sm font-medium ${o.type === 'ENTREE' ? 'text-green-600' : 'text-red-600'}`}>
                        {o.type === 'ENTREE' ? '+' : '−'} {o.montant.toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{o.utilisateur.nom}</td>
                      <td className="px-4 py-3">
                        {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('Supprimer cette opération caisse ? Comptabilité mise à jour. Irréversible.')) return
                              setDeletingId(o.id)
                              try {
                                const res = await fetch(`/api/caisse/${o.id}`, { method: 'DELETE' })
                                if (res.ok) {
                                  fetchOperations()
                                  showSuccess(MESSAGES.CAISSE_SUPPRIMEE)
                                } else {
                                  const d = await res.json()
                                  showError(res.status === 403 ? (d.error || MESSAGES.RESERVE_SUPER_ADMIN) : (d.error || 'Erreur suppression.'))
                                }
                              } catch (e) {
                                showError(formatApiError(e))
                              } finally {
                                setDeletingId(null)
                              }
                            }}
                            disabled={deletingId === o.id}
                            className="rounded p-1.5 text-red-700 hover:bg-red-100 disabled:opacity-50 cursor-pointer hover:scale-110 transition-transform"
                            title="Supprimer (Super Admin)"
                          >
                            {deletingId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                ))}
                {totalPages >= 1 && (
                    <tr>
                      <td colSpan={7} className="px-0 py-0 border-t border-gray-200">
                        <div className="bg-white px-4 py-3 flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            Page {currentPage} sur {totalPages} ({totalEntries} opérations)
                          </div>
                          {totalPages > 1 && (
                            <Pagination
                              currentPage={currentPage}
                              totalPages={totalPages}
                              onPageChange={setCurrentPage}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {formType === 'ENTREE' ? 'Entrée caisse' : 'Sortie caisse'}
              </h2>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {err && <p className="text-sm text-red-600">{err}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Magasin</label>
                <select
                  required
                  value={formData.magasinId}
                  onChange={(e) => setFormData((f) => ({ ...f, magasinId: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Sélectionner</option>
                  {magasins.map((m) => (
                    <option key={m.id} value={String(m.id)}>{m.code} – {m.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Motif</label>
                <input
                  type="text"
                  required
                  value={formData.motif}
                  onChange={(e) => setFormData((f) => ({ ...f, motif: e.target.value }))}
                  placeholder="Ex. Apport fonds, Vente, Remboursement…"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Montant (FCFA)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={formData.montant}
                  onChange={(e) => setFormData((f) => ({ ...f, montant: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${formType === 'ENTREE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                    } disabled:opacity-50`}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE D'APERÇU IMPRESSION CAISSE */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
            <div className="flex items-center gap-6">
               <div>
                  <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu — Journal de Caisse</h2>
                  <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                    {filtreMagasin ? `Magasin: ${magasins.find(m => String(m.id) === filtreMagasin)?.nom}` : "Toutes les caisses"}
                    &nbsp;— {new Date(dateDebut).toLocaleDateString('fr-FR')} au {new Date(dateFin).toLocaleDateString('fr-FR')}
                  </p>
               </div>
               <div className="h-10 w-px bg-gray-200" />
               <span className="rounded-full bg-orange-100 px-4 py-2 text-xs font-black text-orange-600 uppercase">
                 {allOperationsForPrint.length} OPÉRATIONS
               </span>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase tracking-widest"
              >
                Fermer
              </button>
              <button
                onClick={async () => {
                  setIsPreviewOpen(false)
                  const data = allOperationsForPrint.length > 0 ? allOperationsForPrint : operations
                  const entite = await fetch('/api/parametres').then(r => r.ok ? r.json() : null).catch(() => null) || {}
                  const chunks = paginateForPrint(data, { firstPageSize: 12, otherPagesSize: 18 })
                  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

                  const headerHtml = (showFull: boolean, pageNum: number, totalPages: number) => {
                    if (showFull) {
                      return `<div style="border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start;">
                        <div>
                          <div style="font-size:16px;font-weight:900;text-transform:uppercase;">${entite.nomEntreprise || 'GESTICOM PRO'}</div>
                          <div style="font-size:12px;font-weight:700;color:#555;">${entite.localisation || ''}</div>
                          <div style="font-size:11px;color:#888;">Contact: ${entite.contact || ''}${entite.email ? ' | Email: ' + entite.email : ''}</div>
                          <div style="font-size:11px;color:#888;">${entite.numNCC ? 'NCC: ' + entite.numNCC : ''}${entite.registreCommerce ? ' | RC: ' + entite.registreCommerce : ''}</div>
                        </div>
                        <div style="text-align:right;">
                          <div style="font-size:16px;font-weight:900;text-transform:uppercase;">Journal de Caisse</div>
                          <div style="font-size:12px;font-weight:700;color:#555;margin-top:2px;">${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}</div>
                          <div style="font-size:11px;font-weight:900;color:#888;margin-top:8px;">Édition: ${today}</div>
                          <div style="font-size:14px;font-weight:900;color:#d46c0a;margin-top:4px;">PAGE ${pageNum} / ${totalPages}</div>
                        </div>
                      </div>`
                    }
                    return `<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
                      <div style="font-size:14px;font-weight:900;color:#d46c0a;">PAGE ${pageNum} / ${totalPages}</div>
                    </div>`
                  }

                  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Caisse</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; }
  .page { page-break-after: always; padding: 0; }
  .page:last-child { page-break-after: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #eee; border: 2px solid #000; padding: 6px 4px; font-size: 12px; font-weight: 900; text-align: center; }
  td { border: 1px solid #000; padding: 4px; font-size: 12px; text-align: center; }
  tfoot td { background: #e0e0e0; font-weight: 900; font-size: 13px; }
  .compteurs { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px; background: #f0f0f0; border: 2px solid #000; font-size: 12px; font-weight: 900; }
</style></head><body>`

                  chunks.forEach((chunk, index, allChunks) => {
                    html += `<div class="page">`
                    html += headerHtml(index === 0, index + 1, allChunks.length)
                    if (index === 0) {
                      html += `<div class="compteurs">
                        <span>ENTRÉES: +${totalEntrees.toLocaleString('fr-FR')} F</span>
                        <span>SORTIES: −${totalSorties.toLocaleString('fr-FR')} F</span>
                        <span style="${soldeMouvements >= 0 ? 'color:#059669;' : 'color:#dc2626;'}">SOLDE: ${soldeMouvements.toLocaleString('fr-FR')} F</span>
                        <span>${allChunks.reduce((s, a) => s + a.length, 0)} OPÉRATIONS</span>
                      </div>`
                    }
                    html += `<table>
                      <thead><tr>
                        <th style="width:14%">N° /<br/>DATE</th>
                        <th style="width:18%">MAGASIN</th>
                        <th style="width:40%">MOTIF /<br/>TYPE</th>
                        <th style="width:18%">MONTANT</th>
                      </tr></thead><tbody>`
                    chunk.forEach((o: any, idx: number) => {
                      const globalNum = allChunks.slice(0, index).reduce((s, a) => s + a.length, 0) + idx + 1
                      html += `<tr>
                        <td><span style="font-weight:900;font-size:11px;">${globalNum}</span><br/><span style="font-size:11px;color:#555;">${new Date(o.date).toLocaleDateString('fr-FR')}</span></td>
                        <td>${o.magasin?.code || o.magasin || '—'}</td>
                        <td>${o.motif || '—'}<br/><span style="font-size:11px;font-weight:900;${o.type === 'SORTIE' ? 'color:#dc2626;' : 'color:#059669;'}">${o.type}</span></td>
                        <td style="font-weight:900;${o.type === 'SORTIE' ? 'color:#dc2626;' : 'color:#059669;'}">${o.type === 'SORTIE' ? '−' : '+'}${(o.montant || 0).toLocaleString('fr-FR')} F</td>
                      </tr>`
                    })
                    if (index === allChunks.length - 1) {
                      html += `<tfoot><tr>
                        <td colspan="3" style="text-align:right;padding-right:8px;text-transform:uppercase;">RÉCAPITULATIF PÉRIODE</td>
                        <td style="font-weight:900;">E: +${totalEntrees.toLocaleString('fr-FR')}<br/>S: −${totalSorties.toLocaleString('fr-FR')}<br/>∆: ${soldeMouvements.toLocaleString('fr-FR')} F</td>
                      </tr></tfoot>`
                    }
                    html += `</tbody></table></div>`
                  })

                  html += `</body></html>`
                  const w = window.open('', '_blank')
                  if (w) {
                    w.document.write(html)
                    w.document.close()
                    setTimeout(() => { w.print(); w.close() }, 500)
                  } else {
                    alert('Veuillez autoriser les popups pour imprimer.')
                  }
                }}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-10 py-2 text-sm font-black text-white hover:bg-violet-700 shadow-xl transition-all active:scale-95 uppercase tracking-widest"
              >
                <Printer className="h-4 w-4" />
                Lancer l'impression
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8">
            <div className="mx-auto bg-white shadow-2xl rounded-xl overflow-hidden" style={{ maxWidth: '900px' }}>
              {/* Compteurs */}
              <div className="grid grid-cols-4 gap-3 p-4 bg-gray-50 border-b border-gray-200">
                <div className="rounded-lg bg-emerald-50 p-3 text-center border border-emerald-200">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Entrées</p>
                  <p className="text-lg font-black text-emerald-700">+{totalEntrees.toLocaleString('fr-FR')} F</p>
                </div>
                <div className="rounded-lg bg-rose-50 p-3 text-center border border-rose-200">
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Sorties</p>
                  <p className="text-lg font-black text-rose-700">−{totalSorties.toLocaleString('fr-FR')} F</p>
                </div>
                <div className={`rounded-lg p-3 text-center border ${soldeMouvements >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${soldeMouvements >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>Solde</p>
                  <p className={`text-lg font-black ${soldeMouvements >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>{soldeMouvements.toLocaleString('fr-FR')} F</p>
                </div>
                <div className="rounded-lg bg-orange-50 p-3 text-center border border-orange-200">
                  <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Opérations</p>
                  <p className="text-lg font-black text-orange-700">{allOperationsForPrint.length}</p>
                </div>
              </div>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-[11px] font-black text-gray-600 uppercase tracking-wider">
                    <th className="p-4 text-center w-24">N° /<br/>DATE</th>
                    <th className="p-4 text-center">MAGASIN</th>
                    <th className="p-4 text-center">MOTIF /<br/>TYPE</th>
                    <th className="p-4 text-center">MONTANT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(allOperationsForPrint.length > 0 ? allOperationsForPrint : operations).map((o, i) => (
                    <tr key={o.id} className="hover:bg-violet-50/30 transition-colors">
                      <td className="p-4 text-center">
                        <span className="font-black text-gray-700">{i + 1}</span>
                        <br/><span className="text-[11px] text-gray-500">{new Date(o.date).toLocaleDateString('fr-FR')}</span>
                      </td>
                      <td className="p-4 text-center font-bold text-gray-800">{o.magasin?.code || '—'}</td>
                      <td className="p-4 text-center">
                        <span>{o.motif || '—'}</span>
                        <br/><span className={`text-[11px] font-black ${o.type === 'SORTIE' ? 'text-rose-600' : 'text-emerald-600'}`}>{o.type}</span>
                      </td>
                      <td className={`p-4 text-center font-black text-sm ${o.type === 'SORTIE' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {o.type === 'SORTIE' ? '−' : '+'}{(o.montant || 0).toLocaleString('fr-FR')} F
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-black text-sm border-t-2 border-gray-300">
                    <td colSpan={3} className="p-4 text-right uppercase tracking-wider italic">Récapitulatif période</td>
                    <td className="p-4 text-center leading-relaxed">
                      E: +{totalEntrees.toLocaleString('fr-FR')} F<br/>
                      S: −{totalSorties.toLocaleString('fr-FR')} F<br/>
                      <span className={`${soldeMouvements >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>∆: {soldeMouvements.toLocaleString('fr-FR')} F</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
