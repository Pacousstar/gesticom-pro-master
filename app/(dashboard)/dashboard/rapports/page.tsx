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

  // New Data State Phase 2
  const [mouvementsDetailles, setMouvementsDetailles] = useState<NouveauMouvement[]>([])
  const [soldesClients, setSoldesClients] = useState<SoldeTiers[]>([])
  const [soldesFournisseurs, setSoldesFournisseurs] = useState<SoldeTiers[]>([])
  const [paiementsByMode, setPaiementsByMode] = useState<PaiementDetail[]>([])
  const [mouvementsFinances, setMouvementsFinances] = useState<any[]>([])
  const [valeurStock, setValeurStock] = useState<{ data: ValeurStock[], totalValeur: number } | null>(null)

  // Pagination Tiers States
  const [pageClients, setPageClients] = useState(1)
  const [pageFournisseurs, setPageFournisseurs] = useState(1)
  const itemsPerPageTiers = 10
  const [mouvementTotals, setMouvementTotals] = useState<{ entree: number; sortie: number } | null>(null)
  const [categoriesData, setCategoriesData] = useState<RapportCategorie[]>([])
  const [movPage, setMovPage] = useState(1)
  const [paginationMov, setPaginationMov] = useState<{ totalPages: number; total: number; limit: number } | null>(null)

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

      // --- NEW RAPPORTS PHASE 2 ---
      // 216. Mouvements avec pagination
      try {
        const resMov = await fetch(`/api/rapports/stocks/mouvements?${params.toString()}&page=${movPage}`)
        if (resMov.ok) {
          const dataMov = await resMov.json()
          setMouvementsDetailles(dataMov.mouvements || [])
          setMouvementTotals(dataMov.totals || null)
          setPaginationMov(dataMov.pagination || null)
        }
      } catch (e) { console.error("Erreur mouvements stock:", e) }

      try {
        const resSC = await fetch(`/api/rapports/finances/soldes?type=CLIENT`)
        if (resSC.ok) {
          const dataSC = await resSC.json()
          setSoldesClients(Array.isArray(dataSC) ? dataSC : [])
        }
      } catch (e) { console.error("Erreur soldes clients:", e) }

      try {
        const resSF = await fetch(`/api/rapports/finances/soldes?type=FOURNISSEUR`)
        if (resSF.ok) {
          const dataSF = await resSF.json()
          setSoldesFournisseurs(Array.isArray(dataSF) ? dataSF : [])
        }
      } catch (e) { console.error("Erreur soldes fournisseurs:", e) }

      try {
        const resPM = await fetch(`/api/rapports/finances/paiements?type=CLIENT&dateDebut=${dateDebut}&dateFin=${dateFin}`)
        if (resPM.ok) {
          const dataPM = await resPM.json()
          setPaiementsByMode(dataPM.summary || [])
          setMouvementsFinances(dataPM.transactions || [])
        }
      } catch (e) { console.error("Erreur paiements par mode:", e) }

      try {
        const resVal = await fetch(`/api/rapports/stocks/valeur?dateFin=${dateFin}&magasinId=${filtreMagasin}`)
        if (resVal.ok) {
          const dataVal = await resVal.json()
          setValeurStock(dataVal && typeof dataVal === 'object' && !dataVal.error ? dataVal : { data: [], totalValeur: 0 })
        }
      } catch (e) { console.error("Erreur valeur stock:", e) }

      try {
        const resCat = await fetch(`/api/rapports/categories`)
        if (resCat.ok) {
          const dataCat = await resCat.json()
          setCategoriesData(dataCat.data || [])
        }
      } catch (e) { console.error("Erreur catégories:", e) }

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

  useEffect(() => {
    fetchAllData()
  }, [dateDebut, dateFin, filtreMagasin, facturesPage, movPage])

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4">
        <TabButton id="logistique" label="Stocks & Logistique" icon={Package} color="orange" />
        <TabButton id="categories" label="Arborescence Articles" icon={PieChart} color="indigo" />
        <TabButton id="ventes" label="Intelligence Tiers" icon={Users} color="emerald" />
        <TabButton id="finances" label="Finance & Encaissements" icon={DollarSign} color="amber" />
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
                        <div className="text-4xl font-black text-slate-900 tracking-tighter">{Array.isArray(mouvementsDetailles) ? mouvementsDetailles.length : 0}</div>
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {[1,2,3].map(i => (
                                <div key={i} className="h-6 w-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                                    {String.fromCharCode(64 + i)}
                                </div>
                            ))}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter ml-2 italic">Transactions actives</span>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <LogistiqueAlertes alertes={alertes} searchTerm={searchTerm} />
              <LogistiqueTop top={topProduits} searchTerm={searchTerm} />
            </div>

            {/* Journal des Mouvements Détaillés Bright Pro */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 tracking-tighter uppercase italic">
                        <ArrowRightLeft className="h-5 w-5 text-orange-500" />
                        Registre des Flux de Stock
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border border-gray-100 px-4 py-1.5 rounded-full bg-white shadow-sm">
                            {paginationMov?.total || (Array.isArray(mouvementsDetailles) ? mouvementsDetailles.length : 0)} opérations tracées
                        </span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                        <thead>
                            <tr className="bg-white border-b border-gray-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                                <th className="px-8 py-6">Horodatage</th>
                                <th className="px-8 py-6">Nature du Flux</th>
                                <th className="px-8 py-6">Désignation & Code</th>
                                <th className="px-8 py-6">Emplacement</th>
                                <th className="px-8 py-6 text-right">Volume</th>
                                <th className="px-8 py-6">Opérateur</th>
                                <th className="px-8 py-6">Notes / Réf</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {Array.isArray(mouvementsDetailles) && mouvementsDetailles.filter(m => (m.produit?.designation || '').toLowerCase().includes(searchTerm.toLowerCase())).map(m => (
                                <tr key={m.id} className="hover:bg-orange-50/30 transition-all duration-300 group">
                                    <td className="px-8 py-7">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                            {m.date ? new Date(m.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '---'}
                                        </div>
                                        <div className="text-[10px] text-slate-300 font-mono italic">
                                            {m.date ? new Date(m.date).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '---'}
                                        </div>
                                    </td>
                                    <td className="px-8 py-7">
                                        <span className={`px-4 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest border shadow-sm flex items-center gap-2 w-fit ${
                                            m.type === 'ENTREE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                        }`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${m.type === 'ENTREE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            {m.type === 'ENTREE' ? 'Entrée Stock' : 'Sortie Stock'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-7">
                                        <div className="text-sm font-black text-slate-900 uppercase tracking-tighter truncate max-w-[200px] group-hover:text-orange-600 transition-colors uppercase italic">{m.produit?.designation || 'Produit inconnu'}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60">REF: {m.produit?.code || '---'}</div>
                                    </td>
                                    <td className="px-8 py-7">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{m.magasin?.nom || 'Magasin inconnu'}</span>
                                        </div>
                                    </td>
                                    <td className={`px-8 py-7 text-right font-black tabular-nums text-lg tracking-tighter ${m.type === 'ENTREE' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                        {m.type === 'ENTREE' ? '+' : '-'}{m.quantite}
                                    </td>
                                      <td className="px-8 py-7">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 border border-gray-100 shadow-sm uppercase italic">
                                                {m.utilisateur?.nom?.substring(0, 2) || '??'}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase italic">{m.utilisateur?.nom || 'Inconnu'}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-7">
                                        <div className="text-[10px] text-slate-400 italic max-w-[120px] truncate group-hover:whitespace-normal group-hover:max-w-[250px] transition-all bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                                            {m.observation || 'Aucune observation'}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {mouvementTotals && (
                            <tfoot className="bg-slate-800 text-white font-black border-t-2 border-orange-500 shadow-2xl">
                                <tr>
                                    <td colSpan={4} className="px-8 py-10 uppercase text-[10px] tracking-[0.4em] italic opacity-40">Récapitulatif des Flux Logistiques</td>
                                    <td className="px-8 py-10 text-right tabular-nums">
                                        <div className="text-emerald-400 text-2xl tracking-tighter italic">+{(mouvementTotals.entree || 0).toLocaleString()}</div>
                                        <div className="text-rose-400 text-2xl tracking-tighter italic">-{(mouvementTotals.sortie || 0).toLocaleString()}</div>
                                    </td>
                                    <td colSpan={2} className="px-8 py-10 text-right">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 italic opacity-60">Impact Net Unités</div>
                                        <div className="text-4xl font-black tracking-tighter italic text-orange-500 underline decoration-2 underline-offset-8">
                                            {((mouvementTotals?.entree || 0) - (mouvementTotals?.sortie || 0)).toLocaleString()}
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
                {paginationMov && (
                    <div className="p-8 border-t border-gray-50 bg-gray-50/30 flex justify-center">
                        <Pagination 
                            currentPage={movPage}
                            totalPages={paginationMov.totalPages}
                            totalItems={paginationMov.total}
                            itemsPerPage={paginationMov.limit}
                            onPageChange={(p) => setMovPage(p)}
                        />
                    </div>
                )}
            </div>

            {/* Valorisation du Stock Détaillée */}
            {/* Valorisation du Stock Détaillée (Paginée) */}
            <LogistiqueValorisationTable 
               valeurStock={valeurStock} 
               searchTerm={searchTerm} 
            />
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Filtres spécifiques Catégories/Produits Bright Pro */}
            <div className="flex flex-wrap gap-4 bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl relative overflow-hidden">
                <div className="flex flex-col gap-1 flex-1 min-w-[250px] relative z-10">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtrer par Catégorie</label>
                    <select 
                        value={selectedCatFilter} 
                        onChange={e => { setSelectedCatFilter(e.target.value); setSelectedProdFilter(''); }}
                        className="rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm font-black text-slate-900 shadow-inner focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all"
                    >
                        <option value="">Toutes les catégories</option>
                        {Array.isArray(categoriesData) && Array.from(new Set(categoriesData.map(c => c.nom))).sort().map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[250px] relative z-10">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Filtrer par Produit</label>
                    <select 
                        value={selectedProdFilter} 
                        onChange={e => setSelectedProdFilter(e.target.value)}
                        className="rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm font-black text-slate-900 shadow-inner focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all"
                    >
                        <option value="">Tous les produits</option>
                        {Array.isArray(produits) && produits
                            .filter(p => !selectedCatFilter || p.categorie === selectedCatFilter)
                            .map(p => (
                                <option key={p.id} value={p.designation}>{p.designation}</option>
                            ))
                        }
                    </select>
                </div>
                <button 
                  onClick={() => { setSelectedCatFilter(''); setSelectedProdFilter(''); }}
                  className="mt-6 px-8 py-2.5 rounded-xl bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95 relative z-10 border border-orange-500"
                >
                  Réinitialiser
                </button>
                <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-orange-50/50 to-transparent pointer-events-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
               <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-800 shadow-xl text-slate-900">
                  <p className="text-orange-600 text-[9px] font-black uppercase tracking-widest opacity-80">Rayonnages</p>
                  <div className="mt-2 text-4xl font-black tracking-tighter italic text-slate-900">
                    {selectedCatFilter ? '01' : (categoriesData.length < 10 ? `0${categoriesData.length}` : categoriesData.length)}
                  </div>
               </div>
               {/* 2. Nombre Articles - White */}
               <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl text-slate-900">
                  <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest opacity-80">Articles Uniques</p>
                  <div className="mt-2 text-4xl font-black tracking-tighter">
                    {(Array.isArray(categoriesData) ? categoriesData : [])
                        .filter(c => !selectedCatFilter || c.nom === selectedCatFilter)
                        .reduce((acc, c) => acc + (selectedProdFilter ? 1 : (c?.nbProduits || 0)), 0)}
                  </div>
               </div>
               {/* 3. Quantité Totale - White */}
               <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl text-slate-900">
                  <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest opacity-80">Volume Stocké</p>
                  <div className="mt-2 text-4xl font-black tracking-tighter text-blue-600">
                    {(Array.isArray(categoriesData) ? categoriesData : [])
                        .filter(c => !selectedCatFilter || c.nom === selectedCatFilter)
                        .reduce((acc, c) => acc + (c?.quantiteTotale || 0), 0).toLocaleString()}
                  </div>
               </div>
               {/* 4. Valeur Achat - White */}
               <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl text-slate-900 border-l-orange-500 border-l-4">
                  <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest opacity-80">Investissement</p>
                  <div className="mt-2 text-xl font-black tracking-tight truncate">
                    {(Array.isArray(categoriesData) ? categoriesData : [])
                        .filter(c => !selectedCatFilter || c.nom === selectedCatFilter)
                        .reduce((acc, c) => acc + (c?.valeurAchatStock || 0), 0).toLocaleString()} <span className="text-[10px] opacity-40">F</span>
                  </div>
               </div>
               {/* 5. Valeur Vente - Orange */}
               <div className="bg-orange-600 p-6 rounded-[2rem] border border-orange-500 shadow-xl text-white">
                  <p className="text-orange-100 text-[9px] font-black uppercase tracking-widest opacity-80">Vente Potentielle</p>
                  <div className="mt-2 text-xl font-black tracking-tight truncate italic">
                    {(Array.isArray(categoriesData) ? categoriesData : [])
                        .filter(c => !selectedCatFilter || c.nom === selectedCatFilter)
                        .reduce((acc, c) => acc + (c?.valeurVenteStock || 0), 0).toLocaleString()} <span className="text-[10px] opacity-60">F</span>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {categoriesData
                    .filter(c => (!selectedCatFilter || c.nom === selectedCatFilter))
                    .filter(c => c.nom.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((c, i) => {
                        const totalPV = categoriesData.reduce((acc, cat) => acc + cat.valeurVenteStock, 0) || 1
                        const ratio = (c.valeurVenteStock / totalPV) * 100

                        return (
                            <div key={i} className="group relative bg-white rounded-[2.5rem] border border-gray-100 p-7 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                    <PieChart className="h-32 w-32 text-orange-600" />
                                </div>

                                <div className="flex items-start justify-between mb-8 relative z-10">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none italic group-hover:text-orange-600 transition-colors">{c.nom}</h3>
                                        <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse shadow-sm shadow-orange-500/50" />
                                            Segmentation Stock
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-blue-600 tracking-widest">{ratio.toFixed(1)}%</div>
                                        <div className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Poids Global</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 relative z-10">
                                    {/* Métriques Bright Pro */}
                                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 shadow-inner group/stat">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Package className="h-3 w-3 text-slate-400" />
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Articles</span>
                                        </div>
                                        <div className="text-2xl font-black text-slate-900 tracking-tighter italic">{c.nbProduits}</div>
                                    </div>

                                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 shadow-inner">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className="h-3 w-3 text-slate-400" />
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unités</span>
                                        </div>
                                        <div className="text-2xl font-black text-slate-900 tracking-tighter italic">{c.quantiteTotale.toLocaleString()}</div>
                                    </div>

                                    <div className="bg-orange-50/30 p-4 rounded-2xl border border-orange-100/50 shadow-inner col-span-2 flex justify-between items-center mt-2">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <DollarSign className="h-3 w-3 text-orange-500" />
                                                <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Valeur Inventaire (PV)</span>
                                            </div>
                                            <div className="text-xl font-black text-slate-900 tracking-tight italic">{c.valeurVenteStock.toLocaleString()} <span className="text-[10px] opacity-40">F</span></div>
                                        </div>
                                        <ArrowRightLeft className="h-5 w-5 text-orange-200 group-hover:rotate-180 transition-transform duration-700" />
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-dashed border-gray-100 relative z-10">
                                    <button 
                                        onClick={() => setSelectedCatFilter(c.nom)}
                                        className="w-full py-3.5 rounded-2xl bg-gray-50 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all shadow-sm active:scale-95 border border-gray-100 italic"
                                    >
                                        Consulter l'Inventaire
                                    </button>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 to-transparent group-hover:h-2 transition-all" />
                            </div>
                        )
                    })}
            </div>
          </div>
        )}

        {activeTab === 'ventes' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* Grille de Soldes Tiers Bright Pro */}
             <div className="grid lg:grid-cols-2 gap-8">
                 <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                        <Users className="h-40 w-40 text-rose-500" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center justify-between relative z-10">
                        <span className="flex items-center gap-3 uppercase tracking-tighter italic"><Users className="h-5 w-5 text-rose-500" /> Créances Clients</span>
                        <span className="text-[9px] font-black bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full border border-rose-100 shadow-sm uppercase">{(Array.isArray(soldesClients) ? soldesClients : []).length} comptes</span>
                    </h3>
                    <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar min-h-[500px] relative z-10">
                        {(Array.isArray(soldesClients) ? soldesClients : [])
                            .filter(s => (s.nom || '').toLowerCase().includes(searchTerm.toLowerCase()))
                            .slice((pageClients - 1) * itemsPerPageTiers, pageClients * itemsPerPageTiers)
                            .map(s => (
                            <div key={s.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 ${s.solde > 0 ? 'border-rose-100 bg-rose-50/30 hover:bg-rose-50 shadow-sm' : 'border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50 shadow-sm'} group/item`}>
                                <div>
                                    <div className="text-sm font-black text-slate-900 uppercase tracking-tighter group-hover/item:text-rose-600 transition-colors italic">
                                        {s.nom}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-60">{s.code || 'SANS CODE'}</div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-2xl font-black tabular-nums tracking-tighter ${s.solde > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {Math.abs(s.solde || 0).toLocaleString()}
                                    </div>
                                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                                        {s.solde > 0 ? 'Solde Débiteur' : 'Solde Créditeur'}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(Array.isArray(soldesClients) ? soldesClients : []).length === 0 && <div className="py-24 text-center text-slate-200 font-black uppercase italic tracking-[0.5em] text-xs">Aucune créance enregistrée</div>}
                    </div>
                    {soldesClients.length > itemsPerPageTiers && (
                        <div className="mt-8 flex justify-center pt-8 border-t border-gray-50 relative z-10">
                            <Pagination 
                                currentPage={pageClients} 
                                totalPages={Math.ceil(soldesClients.length / itemsPerPageTiers)} 
                                onPageChange={setPageClients} 
                                totalItems={soldesClients.length}
                                itemsPerPage={itemsPerPageTiers}
                            />
                        </div>
                    )}
                 </div>

                 <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                        <ShoppingBag className="h-40 w-40 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center justify-between relative z-10">
                        <span className="flex items-center gap-3 uppercase tracking-tighter italic"><ShoppingBag className="h-5 w-5 text-orange-500" /> Dettes Fournisseurs</span>
                        <span className="text-[9px] font-black bg-orange-50 text-orange-600 px-4 py-1.5 rounded-full border border-orange-100 shadow-sm uppercase">{(Array.isArray(soldesFournisseurs) ? soldesFournisseurs : []).length} comptes</span>
                    </h3>
                    <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar min-h-[500px] relative z-10">
                        {(Array.isArray(soldesFournisseurs) ? soldesFournisseurs : [])
                            .filter(s => (s.nom || '').toLowerCase().includes(searchTerm.toLowerCase()))
                            .slice((pageFournisseurs - 1) * itemsPerPageTiers, pageFournisseurs * itemsPerPageTiers)
                            .map(s => (
                            <div key={s.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 ${s.solde > 0 ? 'border-orange-100 bg-orange-50/30 hover:bg-orange-50 shadow-sm' : 'border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50 shadow-sm'} group/item`}>
                                <div>
                                    <div className="text-sm font-black text-slate-900 uppercase tracking-tighter group-hover/item:text-orange-600 transition-colors italic">
                                        {s.nom}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-60">REF: {s.code || 'FOURNISSEUR'}</div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-2xl font-black tabular-nums tracking-tighter ${s.solde > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                        {Math.abs(s.solde || 0).toLocaleString()}
                                    </div>
                                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                                        {s.solde > 0 ? 'Reste à payer' : 'Crédit ouvert'}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(Array.isArray(soldesFournisseurs) ? soldesFournisseurs : []).length === 0 && <div className="py-24 text-center text-slate-200 font-black uppercase italic tracking-[0.5em] text-xs">Aucune dette fournisseur</div>}
                    </div>
                    {soldesFournisseurs.length > itemsPerPageTiers && (
                        <div className="mt-8 flex justify-center pt-8 border-t border-gray-50 relative z-10">
                            <Pagination 
                                currentPage={pageFournisseurs} 
                                totalPages={Math.ceil(soldesFournisseurs.length / itemsPerPageTiers)} 
                                onPageChange={setPageFournisseurs} 
                                totalItems={soldesFournisseurs.length}
                                itemsPerPage={itemsPerPageTiers}
                            />
                        </div>
                    )}
                 </div>
             </div>

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
            {/* Tableau de bord Trésorerie Rapide */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                    <DollarSign className="h-40 w-40 text-orange-500" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-8 uppercase tracking-widest border-b border-gray-50 pb-4 italic">
                    Répartition des Flux par Mode
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {paiementsByMode.map((p, i) => (
                        <div key={i} className="group/card relative h-32 rounded-[2rem] border border-gray-100 bg-gray-50/50 p-6 hover:bg-white hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 cursor-pointer overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 opacity-20 group-hover/card:opacity-100 transition-opacity" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest absolute top-6">{p.modePaiement}</p>
                            <div className="mt-8 flex flex-col">
                                <span className="text-2xl font-black text-slate-900 tabular-nums tracking-tighter italic">
                                    {p._sum.montantPaye.toLocaleString()}
                                </span>
                                <span className="text-[9px] font-black text-orange-600 tracking-[0.2em] italic uppercase">{p._count.id} Opérations</span>
                            </div>
                        </div>
                    ))}
                    {paiementsByMode.length === 0 && <div className="col-span-4 py-16 text-center text-slate-200 font-black uppercase tracking-[0.4em] text-sm italic">Aucun flux détecté</div>}
                </div>
            </div>

            <PaiementTable
              title="État de Paiement des Créances Clients (Récapitulatif)"
              data={etatPaiementVentes}
              type="ventes"
              searchTerm={searchTerm}
            />
            
            <PaiementTable
              title="État de Paiement des Dettes Fournisseurs (Récapitulatif)"
              data={etatPaiementAchats}
              type="achats"
              searchTerm={searchTerm}
            />
            
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Grand Journal des Factures Ventes</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Période du {dateDebut} au {dateFin}</p>
                    </div>
                    <div className="flex flex-1 max-w-md relative">
                         <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                         <input 
                            type="text" 
                            placeholder="Filtrer ce journal (N°, Client...)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                         />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase italic">Solde Cumulé Période</p>
                            <p className="text-2xl font-black text-rose-600 tabular-nums">
                                {(Array.isArray(facturesVentes) ? facturesVentes : []).reduce((acc, f) => acc + (f.resteAPayer || 0), 0).toLocaleString()} <span className="text-xs">FCFA</span>
                            </p>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-white">
                            <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-gray-50 italic">
                                <th className="px-6 py-5">Réf. Facture</th>
                                <th className="px-6 py-5">Date</th>
                                <th className="px-6 py-5">Client</th>
                                <th className="px-6 py-5 text-right">Montant TTC</th>
                                <th className="px-6 py-5 text-right text-emerald-600">Réglé</th>
                                <th className="px-6 py-5 text-right text-rose-600">Reste A Recouvrer</th>
                                <th className="px-6 py-5 text-center">Gestion Risque</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {facturesVentes.filter(f => (f.client || '').toLowerCase().includes(searchTerm.toLowerCase()) || (f.numero || '').toLowerCase().includes(searchTerm.toLowerCase())).map(f => (
                                <tr key={f.id} className="hover:bg-rose-50/30 transition-all duration-300 group">
                                    <td className="px-6 py-5 text-sm font-black text-blue-600 font-mono tracking-tighter group-hover:scale-110 origin-left transition-transform italic">{f.numero}</td>
                                    <td className="px-6 py-5 text-[10px] text-slate-400 font-bold uppercase italic">{new Date(f.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</td>
                                    <td className="px-6 py-5">
                                        <div className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase italic">{f.client}</div>
                                        <div className="text-[9px] text-slate-400 font-mono">{f.clientCode || '---'}</div>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-right font-black text-slate-400 tabular-nums italic">{f.montantTotal.toLocaleString()}</td>
                                    <td className="px-6 py-5 text-sm text-right font-black text-emerald-600 tabular-nums italic">{(f.montantPaye || 0).toLocaleString()}</td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="text-lg font-black text-rose-600 tabular-nums italic">{f.resteAPayer.toLocaleString()}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter italic opacity-60">Solde Ouvert</div>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <div className="flex justify-center">
                                            <StatutBadge statut={f.statutPaiement} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50/30">
                            <tr className="font-black text-slate-900 text-sm">
                                <td colSpan={3} className="px-6 py-8 italic tracking-[0.3em] uppercase opacity-40">Bilan Financier du Journal</td>
                                <td className="px-6 py-8 text-right tabular-nums text-xl italic">
                                    {(Array.isArray(facturesVentes) ? facturesVentes : []).reduce((acc, f) => acc + (f.montantTotal || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-8 text-right tabular-nums text-xl italic text-emerald-600">
                                    {(Array.isArray(facturesVentes) ? facturesVentes : []).reduce((acc, f) => acc + (f.montantPaye || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-8 text-right text-4xl tabular-nums text-rose-600 tracking-tighter drop-shadow-[0_0_15px_rgba(244,63,94,0.3)] italic">
                                    {(Array.isArray(facturesVentes) ? facturesVentes : []).reduce((acc, f) => acc + (f.resteAPayer || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-8 text-center text-[10px] text-slate-400 font-black italic">FCFA TOTAL</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                {facturesVentes.length > 20 && (
                    <div className="p-6 border-t border-gray-50 bg-gray-50/30 flex justify-center">
                        <Pagination 
                            currentPage={facturesPage} 
                            totalPages={paginationFactures?.totalPages || 1} 
                            itemsPerPage={10} 
                            totalItems={paginationFactures?.total || facturesVentes.length} 
                            onPageChange={setFacturesPage} 
                        />
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
                {/* En-tête avec métriques de trésorerie (Point 18) */}
                <div className="p-8 border-b border-gray-50 bg-gray-50/30">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 tracking-tighter uppercase italic">
                            <DollarSign className="h-5 w-5 text-orange-500" />
                            Grand Journal de Trésorerie
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border border-gray-100 px-4 py-1.5 rounded-full bg-white shadow-sm">
                                {(mouvementsFinances || []).length} écritures totales
                            </span>
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] border border-emerald-100 px-4 py-1.5 rounded-full bg-emerald-50 shadow-sm">
                                {(mouvementsFinances || []).filter((m: any) => m.type === 'RECETTE').length} encaissements
                            </span>
                            <span className="text-[9px] font-black text-rose-600 uppercase tracking-[0.2em] border border-rose-100 px-4 py-1.5 rounded-full bg-rose-50 shadow-sm">
                                {(mouvementsFinances || []).filter((m: any) => m.type !== 'RECETTE').length} décaissements
                            </span>
                        </div>
                    </div>
                    {/* Métriques Financières (Point 18) */}
                    {(mouvementsFinances || []).length > 0 && (() => {
                        const totalRecettes = (mouvementsFinances || []).filter((m: any) => m.type === 'RECETTE').reduce((s: number, m: any) => s + (m.montant || 0), 0)
                        const totalDepenses = (mouvementsFinances || []).filter((m: any) => m.type !== 'RECETTE').reduce((s: number, m: any) => s + (m.montant || 0), 0)
                        const soldeNet = totalRecettes - totalDepenses
                        return (
                            <div className="grid grid-cols-3 gap-4 mt-6">
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Total Encaissements</p>
                                    <p className="text-2xl font-black text-emerald-700 tracking-tighter mt-1">+{totalRecettes.toLocaleString()} <span className="text-xs font-mono opacity-50">F</span></p>
                                </div>
                                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
                                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Total Décaissements</p>
                                    <p className="text-2xl font-black text-rose-700 tracking-tighter mt-1">-{totalDepenses.toLocaleString()} <span className="text-xs font-mono opacity-50">F</span></p>
                                </div>
                                <div className={`border rounded-2xl p-4 ${soldeNet >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                                    <p className={`text-[9px] font-black uppercase tracking-widest ${soldeNet >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>Solde Net Période</p>
                                    <p className={`text-2xl font-black tracking-tighter mt-1 ${soldeNet >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{soldeNet >= 0 ? '+' : ''}{soldeNet.toLocaleString()} <span className="text-xs font-mono opacity-50">F</span></p>
                                </div>
                            </div>
                        )
                    })()}
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                        <thead>
                            <tr className="bg-white border-b border-gray-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                                <th className="px-8 py-6">Date & Heure</th>
                                <th className="px-8 py-6">Catégorie de Flux</th>
                                <th className="px-8 py-6">Libellé / Opération</th>
                                <th className="px-8 py-6">Mode</th>
                                <th className="px-8 py-6 text-right">Montant</th>
                                <th className="px-8 py-6">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {Array.isArray(mouvementsFinances) && mouvementsFinances.slice((pageTresorerie - 1) * 15, pageTresorerie * 15).map((m: any) => (
                                <tr key={m.id} className="hover:bg-orange-50/30 transition-all duration-300 group">
                                    <td className="px-8 py-7">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                            {m.date ? new Date(m.date).toLocaleDateString('fr-FR') : '---'}
                                        </div>
                                        <div className="text-[10px] text-slate-300 font-mono italic">
                                            {m.date ? new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '---'}
                                        </div>
                                    </td>
                                    <td className="px-8 py-7">
                                        <span className={`px-4 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest border shadow-sm flex items-center gap-2 w-fit ${
                                            m.type === 'RECETTE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                        }`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${m.type === 'RECETTE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            {m.type === 'RECETTE' ? 'Encaissement' : 'Décaissement'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-7">
                                        <div className="text-sm font-black text-slate-900 uppercase tracking-tighter truncate max-w-[250px] italic group-hover:text-blue-600 transition-colors">{m.libelle || 'Opération'}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60 italic">{m.categorie || 'Opération diverse'}</div>
                                    </td>
                                    <td className="px-8 py-7">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-slate-200" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase italic">{m.modePaiement || '---'}</span>
                                        </div>
                                    </td>
                                    <td className={`px-8 py-7 text-right font-black tabular-nums text-lg tracking-tighter ${m.type === 'RECETTE' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                        {m.type === 'RECETTE' ? '+' : '-'}{(m.montant || 0).toLocaleString()}
                                    </td>
                                    <td className="px-8 py-7">
                                        <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[8px] font-black rounded-lg border border-gray-100 uppercase italic">Validé</span>
                                    </td>
                                </tr>
                            ))}
                            {(!Array.isArray(mouvementsFinances) || mouvementsFinances.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center text-slate-200 font-black uppercase italic tracking-[0.5em] text-xs">Aucun mouvement financier</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Trésorerie (Point 17) */}
                {Array.isArray(mouvementsFinances) && mouvementsFinances.length > 15 && (
                    <div className="p-6 border-t border-gray-50 bg-gray-50/30 flex justify-between items-center">
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                            Page {pageTresorerie} / {Math.ceil(mouvementsFinances.length / 15)} — {mouvementsFinances.length} écritures
                        </span>
                        <Pagination
                            currentPage={pageTresorerie}
                            totalPages={Math.ceil(mouvementsFinances.length / 15)}
                            itemsPerPage={15}
                            totalItems={mouvementsFinances.length}
                            onPageChange={setPageTresorerie}
                        />
                    </div>
                )}
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

function LogistiqueValorisationTable({ valeurStock, searchTerm }: any) {
  const [page, setPage] = useState(1)
  const itemsPerPage = 20
  const filteredData = (Array.isArray(valeurStock?.data) ? valeurStock.data : []).filter((v: any) => (v.designation || '').toLowerCase().includes(searchTerm.toLowerCase()))
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden mt-8">
      <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 tracking-tighter uppercase italic">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Valorisation Analytique du Stock
          </h3>
          <div className="text-[9px] font-black bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full border border-gray-200 uppercase italic">
              {filteredData.length} références tracées
          </div>
      </div>
      <div className="overflow-x-auto">
          <table className="min-w-full text-left">
              <thead className="bg-white">
                  <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-gray-50 italic">
                      <th className="px-8 py-6">Désignation & Code</th>
                      <th className="px-8 py-6">Segment</th>
                      <th className="px-8 py-6 text-right">Unités</th>
                      <th className="px-8 py-6 text-right">P.A Moyen</th>
                      <th className="px-8 py-6 text-right text-orange-600">Valeur Inventaire</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                  {paginatedData.map((v: any) => (
                      <tr key={v.id} className="hover:bg-orange-50/30 transition-all duration-300 group">
                          <td className="px-8 py-7">
                              <div className="text-sm font-black text-slate-900 uppercase tracking-tighter italic group-hover:text-blue-600 transition-colors">{v.designation}</div>
                              <div className="text-[10px] text-slate-300 font-mono tracking-tighter uppercase italic opacity-60">REF: {v.code}</div>
                          </td>
                          <td className="px-8 py-7">
                              <span className="text-[9px] font-black bg-blue-50 text-blue-600 border border-blue-100 px-4 py-1.5 rounded-xl uppercase italic shadow-sm">
                                  {v.categorie}
                              </span>
                          </td>
                          <td className="px-8 py-7 text-right font-black text-slate-900 tabular-nums italic text-lg">{(v?.quantite || 0).toLocaleString()}</td>
                          <td className="px-8 py-7 text-right text-slate-400 font-bold tabular-nums italic">{(v?.prixAchat || 0).toLocaleString()}</td>
                          <td className="px-8 py-7 text-right font-black text-orange-600 tabular-nums text-2xl tracking-tighter italic">
                              {(v?.valeur || 0).toLocaleString()}
                          </td>
                      </tr>
                  ))}
              </tbody>
              <tfoot className="bg-slate-900 text-white shadow-2xl border-t-4 border-orange-600">
                  <tr className="font-black">
                      <td colSpan={3} className="px-8 py-10 italic text-[10px] tracking-[0.4em] uppercase opacity-40">Récapitulatif Valorisation Globale</td>
                      <td colSpan={2} className="px-8 py-10 text-right text-5xl tracking-tighter whitespace-nowrap italic text-white">
                          {(valeurStock?.totalValeur || 0).toLocaleString()} <span className="text-xl font-bold opacity-30 uppercase">FCFA</span>
                      </td>
                  </tr>
              </tfoot>
          </table>
      </div>
      {totalPages > 1 && (
        <div className="p-8 flex justify-center border-t border-gray-50 bg-gray-50/30">
          <Pagination 
            currentPage={page} 
            totalPages={totalPages} 
            itemsPerPage={itemsPerPage} 
            totalItems={filteredData.length} 
            onPageChange={setPage} 
          />
        </div>
      )}
    </div>
  )
}

function PaiementTable({ title, data, type, searchTerm }: any) {
  const [page, setPage] = useState(1)
  const itemsPerPage = 10
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
                <tr key={i} className="hover:bg-orange-50/30 transition-all duration-300 group">
                    <td className="px-8 py-7">
                        <div className="text-sm font-black text-slate-900 uppercase tracking-tighter italic group-hover:text-blue-600 transition-colors uppercase italic">{d.client || d.fournisseur || d.nom}</div>
                        <div className="text-[10px] text-slate-300 font-mono tracking-tighter uppercase italic opacity-60">ID: {d.clientId || d.fournisseurId || '---'}</div>
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

