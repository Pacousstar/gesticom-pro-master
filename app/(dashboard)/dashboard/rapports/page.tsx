'use client'

import { useState, useEffect } from 'react'
import {
  FileText, Loader2, AlertTriangle, TrendingUp, ArrowRightLeft,
  FileSpreadsheet, Trash2, Search, Filter, X,
  Users, ShoppingBag, CreditCard, PieChart,
  Package, DollarSign, Star
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'

// --- TYPES ---

type Alerte = {
  id: number
  quantite: number
  produit: { code: string; designation: string; seuilMin: number }
  magasin: { code: string; nom: string }
  manquant: number
}

type Top = { produitId: number; code: string; designation: string; quantiteVendue: number }

type Mouvement = {
  id: number
  date: string
  type: string
  quantite: number
  produit: { code: string; designation: string }
  magasin: { code: string; nom: string }
}

type Magasin = { id: number; code: string; nom: string }
type Produit = { id: number; code: string; designation: string; categorie?: string }

type Comparaison = {
  periodeActuelle: { ca: number; caEncaisse: number; achats: number; ventes: number }
  periodePrecedente: { ca: number; caEncaisse: number; achats: number; ventes: number }
  evolution: { ca: number; achats: number; ventes: number }
  evolutionPourcent: { ca: number; achats: number; ventes: number }
}

type RapportClient = {
  clientId: number | null
  client: string
  code: string | null
  chiffreAffaires: number
  frequenceAchat: number
}

type RapportPaiement = {
  clientId?: number | null
  fournisseurId?: number | null
  client?: string
  fournisseur?: string
  code?: string | null
  montantTotal: number
  montantPaye: number
  resteAPayer: number
  nbVentes?: number
  nbAchats?: number
}

type RapportFacture = {
  id: number
  numero: string
  date: string
  client: string
  clientCode: string | null
  montantTotal: number
  montantPaye: number
  resteAPayer: number
  statutPaiement: string
}

type RapportProduitClient = {
  produit: string
  quantiteVendue: number
  chiffreAffaires: number
}

// --- NOUVEAUX TYPES PHASE 2 ---

type NouveauMouvement = {
  id: number
  date: string
  type: string
  produitId: number
  produit: { code: string; designation: string; prixAchat: number }
  magasin: { nom: string }
  utilisateur: { nom: string }
  quantite: number
  observation?: string
}

type SoldeTiers = {
  id: number
  code: string | null
  nom: string
  type?: string
  totalDu: number
  totalPaye: number
  solde: number
}

type PaiementDetail = {
  modePaiement: string
  _sum: { montantPaye: number }
  _count: { id: number }
}

type ValeurStock = {
  id: number
  code: string
  designation: string
  categorie: string
  quantite: number
  prixAchat: number
  valeur: number
}

type RapportCategorie = {
  nom: string
  nbProduits: number
  quantiteTotale: number
  valeurAchatStock: number
  valeurVenteStock: number
}

export default function RapportsPage() {
  const [activeTab, setActiveTab] = useState('logistique')
  const [loading, setLoading] = useState(true)
  const [dateDebut, setDateDebut] = useState('2025-01-01')
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().split('T')[0])
  const [userRole, setUserRole] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const { success: showSuccess, error: showError } = useToast()

  // Data State
  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [topProduits, setTopProduits] = useState<Top[]>([])
  const [comparaison, setComparaison] = useState<Comparaison | null>(null)
  const [caClients, setCaClients] = useState<RapportClient[]>([])
  const [etatPaiementVentes, setEtatPaiementVentes] = useState<RapportPaiement[]>([])
  const [etatPaiementAchats, setEtatPaiementAchats] = useState<RapportPaiement[]>([])
  const [facturesVentes, setFacturesVentes] = useState<RapportFacture[]>([])
  const [produitsParClient, setProduitsParClient] = useState<RapportProduitClient[]>([])
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [selectedFournisseurId, setSelectedFournisseurId] = useState<number | null>(null)
  const [produitsParFournisseur, setProduitsParFournisseur] = useState<any[]>([])

  // Stock & Logistique State
  const [valeurStock, setValeurStock] = useState<{ totalValeur: number; data: any[] } | null>(null)
  const [mouvementsDetailles, setMouvementsDetailles] = useState<any[]>([])
  const [mouvementsTotals, setMouvementsTotals] = useState({ entree: 0, sortie: 0 })
  const [mouvementsPagination, setMouvementsPagination] = useState<any>(null)
  const [mouvementsPage, setMouvementsPage] = useState(1)

  // New Data State Phase 2
  const [enterprise, setEnterprise] = useState<any>(null)

  // Pagination Tiers States
  const [pageClients, setPageClients] = useState(1)
  const [pageFournisseurs, setPageFournisseurs] = useState(1)
  const itemsPerPageTiers = 10

  // Filter Data
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [clients, setClients] = useState<{ id: number; nom: string }[]>([])
  const [filtreMagasin, setFiltreMagasin] = useState('')

  // Pagination
  const [alertesPage, setAlertesPage] = useState(1)
  const [topPage, setTopPage] = useState(1)
  const [facturesPage, setFacturesPage] = useState(1)
  const [pageTresorerie, setPageTresorerie] = useState(1)
  const [paginationFactures, setPaginationFactures] = useState<{ totalPages: number; total: number } | null>(null)
  const [selectedCatFilter, setSelectedCatFilter] = useState('')
  const [selectedProdFilter, setSelectedProdFilter] = useState('')

  // Pagination Valorisation
  const [pageValorisation, setPageValorisation] = useState(1)
  const ITEMS_PER_PAGE_VALORISATION = 20

  useEffect(() => {
    const loadInit = async () => {
      try {
        const resAuth = await fetch('/api/auth/check')
        if (resAuth.ok) {
          const data = await resAuth.json()
          setUserRole(data.role || '')
        }
        
        const resMag = await fetch('/api/magasins')
        if (resMag.ok) setMagasins(await resMag.json())
        
        const resProd = await fetch('/api/produits?complet=1')
        if (resProd.ok) {
          const d = await resProd.json()
          setProduits(Array.isArray(d) ? d : [])
        }
        
        const resCli = await fetch('/api/clients')
        if (resCli.ok) {
          const d = await resCli.json()
          setClients(Array.isArray(d) ? d : [])
        }
      } catch (e) {
        console.error("Erreur chargement initial rapports:", e)
      }
    }
    loadInit()
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    const params = new URLSearchParams({
      dateDebut,
      dateFin,
      magasinId: filtreMagasin,
    })

    try {
      // 1. Rapports Généraux
      try {
        const resG = await fetch(`/api/rapports?dateDebut=${dateDebut}&dateFin=${dateFin}&magasinId=${filtreMagasin}`)
        if (resG.ok) {
          const dataG = await resG.json()
          setAlertes(dataG.alertes || [])
          setTopProduits(dataG.topProduits || [])
          setComparaison(dataG.comparaison || null)
        }
      } catch (e) { console.error("Erreur rapports généraux:", e) }

      // 2. CA par Client
      try {
        const resC = await fetch(`/api/rapports/ventes/clients?start=${dateDebut}&end=${dateFin}`)
        if (resC.ok) setCaClients(await resC.json())
      } catch (e) { console.error("Erreur CA par client:", e) }

      // 3. Etat Paiement Ventes & Achats
      try {
        const resPV = await fetch(`/api/rapports/ventes/etat-paiement?start=${dateDebut}&end=${dateFin}`)
        if (resPV.ok) {
          const dataPV = await resPV.json()
          setEtatPaiementVentes(Array.isArray(dataPV) ? dataPV : [])
        }
      } catch (e) { console.error("Erreur paiement ventes:", e) }

      try {
        const resPA = await fetch(`/api/rapports/achats/fournisseurs?start=${dateDebut}&end=${dateFin}`)
        if (resPA.ok) {
          const dataPA = await resPA.json()
          setEtatPaiementAchats(Array.isArray(dataPA) ? dataPA : [])
        }
      } catch (e) { console.error("Erreur paiement achats:", e) }

      // 4. Factures
      try {
        const resF = await fetch(`/api/rapports/ventes/factures?start=${dateDebut}&end=${dateFin}&page=${facturesPage}`)
        if (resF.ok) {
          const dataF = await resF.json()
          setFacturesVentes(Array.isArray(dataF.data) ? dataF.data : [])
          setPaginationFactures(dataF.pagination)
        }
      } catch (e) { console.error("Erreur factures:", e) }

      // 5. Valorisation Stock
      try {
        const resV = await fetch(`/api/rapports/stocks/valeur?dateDebut=${dateDebut}&dateFin=${dateFin}&magasinId=${filtreMagasin}`)
        if (resV.ok) setValeurStock(await resV.json())
      } catch (e) { console.error("Erreur valorisation stock:", e) }

      // 6. Mouvements Stock
      try {
        const resM = await fetch(`/api/rapports/stocks/mouvements?dateDebut=${dateDebut}&dateFin=${dateFin}&magasinId=${filtreMagasin}&page=${mouvementsPage}`)
        if (resM.ok) {
          const dataM = await resM.json()
          setMouvementsDetailles(dataM.mouvements || [])
          setMouvementsTotals(dataM.totals || { entree: 0, sortie: 0 })
          setMouvementsPagination(dataM.pagination || null)
        }
      } catch (e) { console.error("Erreur mouvements stock:", e) }


    } catch (e) {
      console.error("Erreur globale rapports:", e)
      showError('Erreur lors du chargement des rapports')
    } finally {
      setLoading(false)
    }
  }

  const fetchProduitsClient = async (clientId: number) => {
    setSelectedClientId(clientId)
    try {
      const res = await fetch(`/api/rapports/ventes/clients/produits?clientId=${clientId}&start=${dateDebut}&end=${dateFin}`)
      const data = await res.json()
      setProduitsParClient(Array.isArray(data) ? data : [])
    } catch (e) {
      showError('Erreur chargement produits client')
    }
  }

  const fetchProduitsFournisseur = async (fournisseurId: number) => {
    setSelectedFournisseurId(fournisseurId)
    try {
      const res = await fetch(`/api/rapports/achats/fournisseurs/produits?fournisseurId=${fournisseurId}&start=${dateDebut}&end=${dateFin}`)
      const data = await res.json()
      setProduitsParFournisseur(Array.isArray(data) ? data : [])
    } catch (e) {
      showError('Erreur chargement produits fournisseur')
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [dateDebut, dateFin, filtreMagasin, facturesPage, mouvementsPage])

  const preset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    setDateDebut(start.toISOString().split('T')[0])
    setDateFin(end.toISOString().split('T')[0])
  }

  if (loading && !alertes.length && !caClients.length) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    )
  }

  const TabButton = ({ id, label, icon: Icon, color, sublabel }: { id: string; label: string; icon: any; color: string; sublabel?: string }) => {
    const isActive = activeTab === id
    const colorMap: Record<string, { active: string; bg: string; text: string; ring: string; shadow: string; border: string }> = {
      orange: { active: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-500/20', shadow: 'shadow-orange-200/50', border: 'border-orange-100' },
      indigo: { active: 'bg-indigo-600', bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-500/20', shadow: 'shadow-indigo-200/50', border: 'border-indigo-100' },
      emerald: { active: 'bg-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-500/20', shadow: 'shadow-emerald-200/50', border: 'border-emerald-100' },
      amber: { active: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-500/20', shadow: 'shadow-amber-200/50', border: 'border-amber-100' },
    }
    const c = colorMap[color]
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`relative flex flex-col items-center justify-center gap-3 p-6 transition-all duration-500 rounded-[2.5rem] border-2 group flex-1 min-w-[200px] ${
          isActive
            ? `${c.active} border-white shadow-2xl scale-105 z-10 -translate-y-2`
            : `bg-white ${c.border} hover:border-gray-200 hover:${c.bg} shadow-xl shadow-slate-200/20`
        }`}
      >
        <div className={`p-4 rounded-2xl transition-all duration-500 ${isActive ? 'bg-white/20' : `${c.bg} ${c.text} group-hover:scale-110`}`}>
          <Icon className={`h-8 w-8 ${isActive ? 'text-white' : ''}`} />
        </div>
        <div className="text-center">
            <span className={`block text-[11px] font-black uppercase tracking-[0.25em] italic ${isActive ? 'text-white' : 'text-slate-900'}`}>
                {label}
            </span>
            <span className={`block text-[8px] font-bold uppercase tracking-widest mt-1.5 transition-opacity ${isActive ? 'text-white/60' : 'text-slate-400 opacity-0 group-hover:opacity-100'}`}>
                Consulter Détails
            </span>
        </div>
        {isActive && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45" />
        )}
      </button>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white font-mono tracking-tighter uppercase italic">PILOTAGE & RAPPORTS</h1>
          <p className="mt-1 text-white font-bold uppercase text-[10px] tracking-[0.2em] opacity-80">Analyses approfondies des stocks, flux financiers et tiers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(`/api/rapports/export?start=${dateDebut}&end=${dateFin}`, '_blank')}
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-[10px] font-black text-white hover:bg-orange-600 shadow-xl shadow-slate-900/10 transition-all uppercase tracking-widest active:scale-95 border border-slate-700"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exporter les données
          </button>
        </div>
      </div>

      {/* Filtres Globaux Bright Pro */}
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center gap-6 relative z-10">
          <div className="flex items-center gap-3 bg-gray-50/50 p-2 rounded-2xl border border-gray-100 shadow-inner">
            <div className="flex flex-col px-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date de Début</label>
                <input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className="bg-transparent text-sm font-black focus:outline-none text-slate-900"
                />
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="flex flex-col px-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date de Fin</label>
                <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className="bg-transparent text-sm font-black focus:outline-none text-slate-900"
                />
            </div>
          </div>

          <div className="flex flex-col gap-1">
             <label className="text-[9px] font-black text-slate-400 ml-1 uppercase tracking-widest">Point de Vente</label>
             <select 
                value={filtreMagasin} 
                onChange={e => setFiltreMagasin(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-slate-900 shadow-sm focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all"
             >
                <option value="">Tous les points de vente</option>
                {Array.isArray(magasins) && magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
             </select>
          </div>

          <div className="h-10 w-px bg-gray-100 hidden md:block" />

          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Rechercher produit, client, facture..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-4 py-3 text-sm font-bold text-slate-900 shadow-sm focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-orange-50/30 to-transparent pointer-events-none" />
      </div>

      {/* Tableau de Bord de Performance Globale */}
      {comparaison && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard 
                label="Chiffre d'Affaires Facturé" 
                value={comparaison.periodeActuelle.ca} 
                prev={comparaison.periodePrecedente.ca} 
                evol={comparaison.evolutionPourcent.ca} 
                unit="FCFA" 
                color="blue" 
            />
            <StatCard 
                label="Trésorerie Encaissée" 
                value={comparaison.periodeActuelle.caEncaisse} 
                prev={comparaison.periodePrecedente.caEncaisse} 
                evol={comparaison.periodePrecedente.caEncaisse > 0 ? ((comparaison.periodeActuelle.caEncaisse - comparaison.periodePrecedente.caEncaisse) / comparaison.periodePrecedente.caEncaisse) * 100 : 0} 
                unit="FCFA" 
                color="green" 
            />
            <div className="relative group overflow-hidden rounded-[2.5rem] border border-gray-100 bg-slate-900 p-7 shadow-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Performance Recouvrement</p>
                <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white tracking-tighter italic">
                        {comparaison.periodeActuelle.ca > 0 ? ((comparaison.periodeActuelle.caEncaisse / comparaison.periodeActuelle.ca) * 100).toFixed(1) : '100'}
                    </span>
                    <span className="text-xl font-bold text-slate-500 uppercase italic opacity-60">%</span>
                </div>
                <div className="mt-7 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-emerald-500 transition-all duration-1000" 
                        style={{ width: `${Math.min(100, comparaison.periodeActuelle.ca > 0 ? (comparaison.periodeActuelle.caEncaisse / comparaison.periodeActuelle.ca) * 100 : 100)}%` }} 
                    />
                </div>
            </div>
        </div>
      )}

      {/* Navigation Onglets Premium Bright Pro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
        <TabButton id="logistique" label="Stocks & Logistique" icon={Package} color="orange" />
        <TabButton id="ventes" label="Intelligence Clients" icon={Users} color="emerald" />
        <TabButton id="finances" label="Recouvrement & Finances" icon={DollarSign} color="amber" />
      </div>

      {/* Contenu de l'onglet */}
      <div className="mt-6">
        {activeTab === 'logistique' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="col-span-1 md:col-span-2 bg-white border-2 border-orange-500 p-8 rounded-[2.5rem] text-slate-900 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-125 transition-transform duration-700 pointer-events-none">
                        <Package className="h-40 w-40 text-orange-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-orange-600 text-[10px] font-black uppercase tracking-[0.3em]">Valeur Inventaire Globale</p>
                        <div className="mt-5 flex items-baseline gap-2">
                            <span className="text-5xl font-black tabular-nums tracking-tighter italic">
                                {(valeurStock?.totalValeur || 0).toLocaleString()}
                            </span>
                            <span className="text-xl font-bold text-slate-300 uppercase italic opacity-60">FCFA</span>
                        </div>
                        <p className="mt-5 text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-60 italic">
                            Estimation stock au {dateFin ? new Date(dateFin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'jour-j'}
                        </p>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-600" />
                </div>
                
                <div className="bg-white p-7 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col justify-between transition-all hover:shadow-2xl hover:-translate-y-1">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none">Alertes Rupture</p>
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="text-4xl font-black text-slate-900 tracking-tighter">{Array.isArray(alertes) ? alertes.length : 0}</div>
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                        <div className="h-2 flex-1 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                            <div className="h-full bg-orange-500 transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, ((Array.isArray(alertes) ? alertes.length : 0) / 20) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400">CRITIQUE</span>
                    </div>
                </div>

                <div className="bg-white p-7 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col justify-between transition-all hover:shadow-2xl hover:-translate-y-1">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none">Flux Période</p>
                            <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="text-4xl font-black text-slate-900 tracking-tighter">{mouvementsTotals.entree + mouvementsTotals.sortie}</div>
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                        <div className="flex -space-x-2">
                            <div className="h-6 w-6 rounded-full border-2 border-white bg-emerald-100 flex items-center justify-center text-[8px] font-black text-emerald-600">IN</div>
                            <div className="h-6 w-6 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-[8px] font-black text-blue-600">OUT</div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter ml-2 italic">Transactions actives</span>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <LogistiqueAlertes alertes={alertes} searchTerm={searchTerm} />
              <LogistiqueTop top={topProduits} searchTerm={searchTerm} />
            </div>

            {/* Restauration : Tableaux détaillés de Valorisation et Mouvements */}
            <div className="space-y-8">
                {/* 1. Valorisation détaillée */}
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
                    <div className="px-8 py-8 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter italic flex items-center gap-3">
                            <TrendingUp className="h-6 w-6 text-orange-500" />
                            Valorisation Détaillée par Référence
                        </h3>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest italic">Valeur Totale Calculée</p>
                            <p className="text-2xl font-black text-orange-500 tabular-nums">{(valeurStock?.totalValeur || 0).toLocaleString()} <span className="text-xs">F</span></p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-gray-50/50 border-b border-gray-100 italic">
                                    <th className="px-8 py-5">Article</th>
                                    <th className="px-8 py-5 text-right">Stock</th>
                                    <th className="px-8 py-5 text-right">P.U (Moyen)</th>
                                    <th className="px-8 py-5 text-right">Valeur Totale</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {valeurStock?.data?.filter((p: any) => 
                                    p.designation.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                    p.code?.toLowerCase().includes(searchTerm.toLowerCase())
                                ).slice((pageValorisation - 1) * ITEMS_PER_PAGE_VALORISATION, pageValorisation * ITEMS_PER_PAGE_VALORISATION).map((p: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-all duration-300 group">
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight italic group-hover:text-orange-600 transition-colors">{p.designation}</p>
                                            <p className="text-[9px] font-mono text-slate-400">REF: {p.code}</p>
                                        </td>
                                        <td className="px-8 py-5 text-right font-bold text-slate-900 tabular-nums">{p.quantite.toLocaleString()}</td>
                                        <td className="px-8 py-5 text-right text-slate-400 tabular-nums">{p.prixUnitaire.toLocaleString()} F</td>
                                        <td className="px-8 py-5 text-right font-black text-slate-900 tabular-nums italic">{p.valeur.toLocaleString()} <span className="text-[10px] text-slate-300">F</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Valorisation */}
                    {valeurStock?.data && valeurStock.data.length > ITEMS_PER_PAGE_VALORISATION && (
                        <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100">
                             <Pagination 
                                currentPage={pageValorisation}
                                totalPages={Math.ceil(valeurStock.data.filter((p: any) => 
                                    p.designation.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                    p.code?.toLowerCase().includes(searchTerm.toLowerCase())
                                ).length / ITEMS_PER_PAGE_VALORISATION)}
                                onPageChange={setPageValorisation}
                             />
                        </div>
                    )}
                </div>

                {/* 2. Journal des mouvements détaillé */}
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
                    <div className="px-8 py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                            <ArrowRightLeft className="h-6 w-6 text-blue-600" />
                            Historique des Mouvements de Stock
                        </h3>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100 italic">
                                <span className="text-[10px] font-black text-emerald-600 uppercase">Entrées:</span>
                                <span className="font-black text-emerald-700">{mouvementsTotals.entree}</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100 italic">
                                <span className="text-[10px] font-black text-blue-600 uppercase">Sorties:</span>
                                <span className="font-black text-blue-700">{mouvementsTotals.sortie}</span>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-gray-50/50 border-b border-gray-100 italic">
                                    <th className="px-8 py-5">Date & Heure</th>
                                    <th className="px-8 py-5">Référence Article</th>
                                    <th className="px-8 py-5">Magasin</th>
                                    <th className="px-8 py-5 text-center">Type</th>
                                    <th className="px-8 py-5 text-right">Quantité</th>
                                    <th className="px-8 py-5">Par</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {mouvementsDetailles.map((m: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-all duration-300">
                                        <td className="px-8 py-5 text-xs text-slate-400 italic">
                                            {new Date(m.date).toLocaleDateString('fr-FR')} à {new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-slate-900 uppercase tracking-tighter italic">{m.produit.designation}</p>
                                        </td>
                                        <td className="px-8 py-5 text-xs text-slate-600 font-bold uppercase">{m.magasin.nom}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex justify-center">
                                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest italic ${m.type === 'ENTREE' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                                    {m.type}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right font-black text-slate-900 tabular-nums italic text-base">
                                            {m.type === 'ENTREE' ? '+' : '-'}{m.quantite}
                                        </td>
                                        <td className="px-8 py-5 text-xs text-slate-400 font-bold uppercase tracking-tight">{m.utilisateur?.nom}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {mouvementsPagination && mouvementsPagination.totalPages > 1 && (
                        <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100">
                            <Pagination 
                                currentPage={mouvementsPage}
                                totalPages={mouvementsPagination.totalPages}
                                onPageChange={setMouvementsPage}
                            />
                        </div>
                    )}
                </div>
            </div>


          </div>
        )}


        {activeTab === 'ventes' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 border border-gray-100 bg-white p-8 rounded-[2.5rem] shadow-xl">
                <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-3 uppercase tracking-tighter italic">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Palmarès Achats Clients
                </h3>
                <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                  {(Array.isArray(caClients) ? caClients : []).map((c: any) => (
                    <button
                      key={c.clientId || c.nom}
                      onClick={() => c.clientId && fetchProduitsClient(c.clientId)}
                      className={`w-full text-left p-5 rounded-2xl transition-all border-2 group ${selectedClientId === c.clientId ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-[1.02]' : 'hover:bg-gray-50 border-gray-50 text-slate-900 shadow-sm'}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                            <span className={`font-black text-sm italic uppercase tracking-tighter ${selectedClientId === c.clientId ? 'text-white' : 'text-slate-900 group-hover:text-blue-600'}`}>{c.nom || 'Client Divers'}</span>
                            <div className={`text-[9px] font-mono italic opacity-60 ${selectedClientId === c.clientId ? 'text-blue-100' : 'text-slate-400'}`}>REF: {c.clientId || '---'}</div>
                        </div>
                        <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${selectedClientId === c.clientId ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                            {c.nombreVentes} Actes
                        </span>
                      </div>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className={`text-2xl font-black tabular-nums tracking-tighter ${selectedClientId === c.clientId ? 'text-white' : 'text-blue-600'}`}>{(c.caTotal || 0).toLocaleString()}</span>
                        <span className={`text-[10px] font-bold opacity-40 ${selectedClientId === c.clientId ? 'text-white' : 'text-slate-400'}`}>FCFA</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 border border-gray-100 bg-white p-8 rounded-[2.5rem] shadow-xl">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3 italic">
                        <Package className="h-5 w-5 text-orange-500" />
                        Composition du panier d'achat
                    </h3>
                    {selectedClientId && (
                        <span className="text-[10px] font-black bg-slate-900 text-white px-4 py-1.5 rounded-full uppercase tracking-widest italic shadow-lg">
                            Analyse Détail
                        </span>
                    )}
                </div>
                {selectedClientId ? (
                  <div className="overflow-x-auto rounded-3xl border border-gray-50 shadow-inner bg-gray-50/20">
                    <table className="min-w-full">
                      <thead>
                        <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white border-b border-gray-50 italic">
                          <th className="px-8 py-6">Désignation Article</th>
                          <th className="px-8 py-6 text-right">Unités</th>
                          <th className="px-8 py-6 text-right">CA Engendré</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {produitsParClient.map((p, i) => (
                          <tr key={i} className="hover:bg-orange-50/50 transition-all duration-300 group">
                            <td className="px-8 py-7 text-sm font-black text-slate-900 uppercase tracking-tighter italic group-hover:text-orange-600 transition-colors">{p.produit || 'Article inconnu'}</td>
                            <td className="px-8 py-7 text-sm text-right font-black text-slate-400 tabular-nums">
                                <span className="bg-white border border-gray-100 px-3 py-1 rounded-lg shadow-sm text-slate-900">
                                    {p.quantiteVendue}
                                </span>
                            </td>
                            <td className="px-8 py-7 text-right">
                                <span className="text-xl font-black text-blue-600 tabular-nums">{(p.chiffreAffaires || 0).toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-slate-300 ml-1 opacity-50 italic">FCFA</span>
                            </td>
                          </tr>
                        ))}
                        {produitsParClient.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-8 py-20 text-center text-slate-200 font-black uppercase italic tracking-[0.4em] text-xs">Aucun article enregistré</td>
                            </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-40 text-slate-300">
                    <div className="relative">
                        <PieChart className="h-32 w-32 mb-8 opacity-5 animate-pulse" />
                        <Users className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 text-slate-100" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-200 italic">Veuillez sélectionner un partenaire client</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'finances' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PaiementTable
              title="État de Paiement des Créances Clients (Récapitulatif)"
              data={etatPaiementVentes}
              type="ventes"
              searchTerm={searchTerm}
            />
            
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <PaiementTable
                title="État de Paiement des Dettes Fournisseurs (Récapitulatif)"
                data={etatPaiementAchats}
                type="achats"
                searchTerm={searchTerm}
                onSelect={(id: number) => fetchProduitsFournisseur(id)}
                selectedId={selectedFournisseurId}
              />
            </div>
            
            <div className="lg:col-span-2 border border-blue-100 bg-white p-8 rounded-[2.5rem] shadow-xl h-fit">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3 italic">
                  <ShoppingBag className="h-5 w-5 text-blue-600" />
                  Composition du panier d'achat (Fournisseur)
                </h3>
                {selectedFournisseurId && (
                  <span className="text-[10px] font-black bg-blue-600 text-white px-4 py-1.5 rounded-full uppercase tracking-widest italic">
                    Détail Articles
                  </span>
                )}
              </div>
              
              {selectedFournisseurId ? (
                <div className="overflow-x-auto rounded-3xl border border-gray-50 bg-gray-50/20">
                  <table className="min-w-full">
                    <thead>
                      <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white border-b border-gray-50 italic">
                        <th className="px-8 py-6">Désignation</th>
                        <th className="px-8 py-6 text-right">Unités</th>
                        <th className="px-8 py-6 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {produitsParFournisseur.map((p, i) => (
                        <tr key={i} className="hover:bg-blue-50/50 transition-all duration-300">
                          <td className="px-8 py-7 text-sm font-black text-slate-900 uppercase tracking-tighter italic">{p.produit}</td>
                          <td className="px-8 py-7 text-sm text-right font-black text-slate-400 tabular-nums">
                            <span className="bg-white border border-gray-100 px-3 py-1 rounded-lg shadow-sm text-slate-900">
                              {p.quantiteAchetee}
                            </span>
                          </td>
                          <td className="px-8 py-7 text-right">
                            <span className="text-xl font-black text-emerald-600 tabular-nums">{p.montantAchat.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-slate-300 ml-1 opacity-50 italic">F</span>
                          </td>
                        </tr>
                      ))}
                      {produitsParFournisseur.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-8 py-20 text-center text-slate-200 font-black uppercase italic tracking-[0.4em] text-xs font-mono">Aucun article enregistré pour la période</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-40 text-slate-200">
                  <CreditCard className="h-20 w-20 mb-6 opacity-20 animate-pulse" />
                  <p className="text-xs font-black uppercase tracking-[0.3em] italic">Sélectionnez un fournisseur pour voir sa composition panier</p>
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- SOUS-COMPOSANTS DESIGN FIXES ---

function StatCard({ label, value, prev, evol, unit, color }: any) {
  const isUp = evol >= 0
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100'
  }
  return (
    <div className="relative group overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white p-7 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
      <div className={`absolute top-0 right-0 h-24 w-24 -mr-12 -mt-12 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-1000 ${colors[color].split(' ')[0]}`} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums italic">{value.toLocaleString()}</span>
        <span className="text-[10px] font-bold text-slate-300 uppercase italic opacity-60">{unit}</span>
      </div>
      <div className="mt-7 flex items-center justify-between border-t border-gray-50 pt-5">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter italic opacity-60">Prev: {prev.toLocaleString()}</span>
        <span className={`px-4 py-1 rounded-full text-[10px] font-black tracking-widest border shadow-sm ${isUp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
          {isUp ? '↑' : '↓'} {Math.abs(evol).toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

function StatutBadge({ statut }: { statut: string }) {
  const styles: any = {
    PAYE: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm',
    PARTIEL: 'bg-orange-50 text-orange-600 border-orange-100 shadow-sm',
    CREDIT: 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm',
  }
  return (
    <span className={`px-5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border shadow-inner italic ${styles[statut] || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
      {statut}
    </span>
  )
}

function LogistiqueAlertes({ alertes, searchTerm }: any) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl">
      <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-tight">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
        Articles en Rupture Critique
      </h3>
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {(Array.isArray(alertes) ? alertes : []).filter((a: any) => !searchTerm || a.produit?.designation?.toLowerCase().includes(searchTerm.toLowerCase())).map((a: any) => (
          <div key={a.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-orange-50 transition-all">
            <div>
              <p className="font-black text-slate-900 text-sm uppercase tracking-tighter">{a.produit?.designation || 'Produit inconnu'}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{a?.magasin?.nom || '---'}</p>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-orange-600 tabular-nums">{(a?.quantite || 0)}</span>
              <span className="text-slate-400 text-xs font-black"> / {a?.produit?.seuilMin || 0}</span>
              <p className="text-[10px] text-rose-600 font-black uppercase italic mt-1">− {a.manquant} manquants</p>
            </div>
          </div>
        ))}
        {alertes.length === 0 && <div className="py-10 text-center text-slate-200 font-black uppercase tracking-widest">Aucune alerte de stock</div>}
      </div>
    </div>
  )
}

function LogistiqueTop({ top, searchTerm }: { top: any[], searchTerm: string }) {
    return (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden h-full flex flex-col">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 tracking-tighter uppercase italic">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Rotation de Stock Élevée
                </h3>
                <Star className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1 overflow-y-auto max-h-[400px] p-6 space-y-3 custom-scrollbar">
                {(Array.isArray(top) ? top : []).filter(t => (t.designation || '').toLowerCase().includes(searchTerm.toLowerCase())).map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-gray-50 border border-gray-100 hover:bg-blue-50 transition-all group shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-inner group-hover:scale-110 transition-transform">
                                <div className="text-[10px] font-black text-blue-600">#{i+1}</div>
                            </div>
                            <div>
                                <div className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase italic">{t.designation || 'Produit inconnu'}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60">Référence: {t.code || '---'}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-slate-900 tracking-tighter italic">
                                {(t._sum?.quantite || 0)} <span className="text-[10px] opacity-40 uppercase">Unites</span>
                            </div>
                            <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest italic leading-none">Rotation Optimale</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}


function PaiementTable({ title, data, type, searchTerm, onSelect, selectedId }: any) {
  const [page, setPage] = useState(1)
  const itemsPerPage = 8

  // On remet la page à 1 si on cherche quelque chose
  useEffect(() => {
    setPage(1)
  }, [searchTerm])
  const filteredData = (Array.isArray(data) ? data : []).filter((d: any) => ((d.client || d.fournisseur) || d.nom || '').toLowerCase().includes(searchTerm.toLowerCase()))
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden mb-8">
      <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">{title}</h3>
        <span className="text-[9px] font-black bg-blue-50 text-blue-600 border border-blue-100 px-5 py-1.5 rounded-full uppercase tracking-widest italic shadow-sm">
            {filteredData.length} entités analysées
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="bg-white border-b border-gray-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
              <th className="px-8 py-6">{type === 'achats' ? 'Partenaire Fournisseur' : 'Bénéficiaire Client'}</th>
              <th className="px-8 py-6 text-center">Volume Actes</th>
              <th className="px-8 py-6 text-right">Chiffre Affaire</th>
              <th className="px-8 py-6 text-right">Montant Réglé</th>
              <th className="px-8 py-6 text-right text-rose-600">Balance Ouverte</th>
              <th className="px-8 py-6 text-center">Score Recouvrement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginatedData.map((d: any, i: number) => (
                <tr 
                    key={i} 
                    onClick={() => onSelect && onSelect(d.fournisseurId || d.clientId)}
                    className={`transition-all duration-300 group cursor-pointer ${
                        (d.fournisseurId || d.clientId) === selectedId 
                        ? 'bg-blue-600 shadow-xl scale-[1.01] text-white' 
                        : 'hover:bg-orange-50/30'
                    }`}
                >
                    <td className="px-8 py-7">
                        <div className={`text-sm font-black uppercase tracking-tighter italic transition-colors ${
                            (d.fournisseurId || d.clientId) === selectedId ? 'text-white' : 'text-slate-900 group-hover:text-blue-600'
                        }`}>{d.client || d.fournisseur || d.nom}</div>
                        <div className={`text-[10px] font-mono tracking-tighter uppercase italic opacity-60 ${
                            (d.fournisseurId || d.clientId) === selectedId ? 'text-blue-100' : 'text-slate-300'
                        }`}>ID: {d.clientId || d.fournisseurId || '---'}</div>
                    </td>
                    <td className="px-8 py-7 text-center">
                        <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[10px] font-black tabular-nums shadow-lg">
                            {d.nombreVentes || d.nombreAchats || d.acts || 0}
                        </span>
                    </td>
                    <td className="px-8 py-7 text-right">
                        <div className="text-sm font-black text-slate-900 tabular-nums italic">{(d.montantTotal || d.caTotal || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-8 py-7 text-right">
                        <div className="text-sm font-black text-emerald-600 tabular-nums italic">{(d.montantPaye || d.payeTotal || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-8 py-7 text-right">
                        <div className="text-xl font-black text-rose-600 tabular-nums tracking-tighter italic">{(d.resteAPayer || d.soldeTotal || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-8 py-7">
                        <div className="flex justify-center">
                            <StatutBadge statut={ (d.resteAPayer || d.soldeTotal || 0) <= 0 ? 'PAYE' : ((d.montantPaye || d.payeTotal || 0) > 0 ? 'PARTIEL' : 'CREDIT') } />
                        </div>
                    </td>
                </tr>
            ))}
            {paginatedData.length === 0 && (
                <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-slate-200 font-black uppercase italic tracking-[0.5em] text-xs">Aucune donnée disponible</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="p-8 flex justify-center border-t border-gray-50 bg-gray-50/30">
            <Pagination 
                currentPage={page} 
                totalPages={totalPages} 
                onPageChange={setPage} 
                totalItems={filteredData.length}
                itemsPerPage={itemsPerPage}
            />
        </div>
      )}
    </div>
  )
}

