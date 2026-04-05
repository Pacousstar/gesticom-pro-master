'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, Download, Filter, Package, Warehouse, User, ArrowUpRight, ArrowDownLeft, RefreshCcw, AlertTriangle, Printer, TrendingUp } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'

interface Mouvement {
  id: number
  date: string
  dateOperation: string
  type: string
  produit: string
  code: string | null
  unite: string
  magasin: string
  quantite: number
  utilisateur: string
  observation: string | null
}

export default function MouvementsStockPage() {
  const [data, setData] = useState<Mouvement[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [magasins, setMagasins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('TOUT')
  const [selectedMagasin, setSelectedMagasin] = useState('TOUT')
  const [selectedType, setSelectedType] = useState('TOUT')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const [selectedMouvement, setSelectedMouvement] = useState<Mouvement | null>(null)
  const { error: showError } = useToast()
  const [isPrinting, setIsPrinting] = useState(false)
  const [entreprise, setEntreprise] = useState<any>(null)

  useEffect(() => {
    const now = new Date()
    // Par défaut, derniers 30 jours (au lieu du mois calendaire pour éviter le vide le 1er du mois)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)
    
    const start = thirtyDaysAgo.toISOString().split('T')[0]
    const end = now.toISOString().split('T')[0]
    setStartDate(start)
    setEndDate(end)
    
    loadFilters()
    fetchData(start, end, 'TOUT', 'TOUT', 'TOUT')
    fetch('/api/parametres').then(r => r.ok && r.json()).then(d => { if (d) setEntreprise(d) }).catch(() => { })
  }, [])

  const loadFilters = async () => {
    try {
      const [prodRes, magRes] = await Promise.all([
        fetch('/api/produits?limit=1000'),
        fetch('/api/magasins')
      ])
      if (prodRes.ok) {
        const prodData = await prodRes.json()
        // L'API produits retourne { data: [...], pagination: {...} } (paginé)
        setProducts(Array.isArray(prodData) ? prodData : (prodData.data || []))
      }
      if (magRes.ok) {
        const magData = await magRes.json()
        setMagasins(Array.isArray(magData) ? magData : (magData.data || []))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchData = async (start: string, end: string, prod: string, mag: string, type: string) => {
    setLoading(true)
    try {
      let url = `/api/rapports/inventaire/mouvements?dateDebut=${start}&dateFin=${end}`
      if (prod !== 'TOUT') url += `&produitId=${prod}`
      if (mag !== 'TOUT') url += `&magasinId=${mag}`
      if (type !== 'TOUT') url += `&type=${type}`
      
      const res = await fetch(url)
      if (res.ok) {
        const d = await res.json()
        setData(Array.isArray(d) ? d : [])
      } else {
        showError('Impossible de charger les mouvements.')
      }
    } catch (err) {
      console.error(err)
      showError('Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchData(startDate, endDate, selectedProduct, selectedMagasin, selectedType)
  }

  const filteredData = Array.isArray(data) ? data.filter(m => {
    if (!m) return false;
    const prodName = (m.produit || '').toLowerCase();
    const prodCode = (m.code || '').toLowerCase();
    const searchLow = search.toLowerCase();
    return prodName.includes(searchLow) || prodCode.includes(searchLow);
  }) : []

  // MODIF POINT 10 : Calcul des totaux sécurisé
  const totalEntrees = filteredData
    .filter(m => m && m.type === 'ENTREE')
    .reduce((acc, m) => acc + (Number(m.quantite) || 0), 0)
    
  const totalSorties = filteredData
    .filter(m => m && m.type === 'SORTIE')
    .reduce((acc, m) => acc + (Number(m.quantite) || 0), 0)
    
  const netFlux = totalEntrees - totalSorties

  const paginatedData = Array.isArray(filteredData) ? filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : []
  const totalPages = Math.ceil((Array.isArray(filteredData) ? filteredData.length : 0) / itemsPerPage)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ENTREE': return <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
      case 'SORTIE': return <ArrowUpRight className="h-4 w-4 text-red-500" />
      case 'TRANSFERT': return <RefreshCcw className="h-4 w-4 text-blue-500" />
      case 'AJUSTEMENT': return <AlertTriangle className="h-4 w-4 text-amber-500" />
      default: return <Package className="h-4 w-4 text-gray-500" />
    }
  }

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'ENTREE': return 'bg-emerald-50 text-emerald-700 border-emerald-100'
      case 'SORTIE': return 'bg-red-50 text-red-700 border-red-100'
      case 'TRANSFERT': return 'bg-blue-50 text-blue-700 border-blue-100'
      case 'AJUSTEMENT': return 'bg-amber-50 text-amber-700 border-amber-100'
      default: return 'bg-gray-50 text-gray-700 border-gray-100'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Mouvements de Stock</h1>
          <p className="text-sm text-white/90 font-medium">Historique détaillé des flux de produits</p>
        </div>
        <div className="flex gap-2 no-print">
          <button 
            onClick={() => { setIsPrinting(true); setTimeout(() => { window.print(); setIsPrinting(false); }, 1000); }}
            disabled={isPrinting}
            className="flex items-center gap-2 rounded-lg border-2 border-orange-500 bg-orange-50 px-4 py-2 text-sm font-black text-orange-800 hover:bg-orange-100 shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} 
            IMPRIMER LA LISTE
          </button>
          <button 
            onClick={() => {/* Logique export excel si besoin */}}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      {/* COMPTEURS (Point 10) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
        <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/20 shadow-2xl flex items-center gap-6 group hover:bg-white/20 transition-all duration-300">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 shadow-inner group-hover:scale-110 transition-transform">
             <ArrowDownLeft className="h-8 w-8" />
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-100/60 uppercase tracking-widest mb-1">Total Entrées (Période)</p>
            <p className="text-3xl font-black text-white tabular-nums drop-shadow-md">
                +{totalEntrees.toLocaleString()} <span className="text-xs font-bold text-emerald-400">UNITÉS</span>
            </p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/20 shadow-2xl flex items-center gap-6 group hover:bg-white/20 transition-all duration-300">
          <div className="h-16 w-16 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-300 shadow-inner group-hover:scale-110 transition-transform">
             <ArrowUpRight className="h-8 w-8" />
          </div>
          <div>
            <p className="text-[10px] font-black text-red-100/60 uppercase tracking-widest mb-1">Total Sorties (Période)</p>
            <p className="text-3xl font-black text-white tabular-nums drop-shadow-md">
                -{totalSorties.toLocaleString()} <span className="text-xs font-bold text-red-400">UNITÉS</span>
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-400 to-orange-600 p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(249,115,22,0.3)] flex items-center gap-6 group hover:scale-[1.02] transition-all duration-300 ring-2 ring-white/30">
          <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center text-white shadow-inner">
             <TrendingUp className="h-8 w-8" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Flux Net de Stock</p>
            <p className="text-3xl font-black text-white tabular-nums drop-shadow-lg">
                {netFlux > 0 ? '+' : ''}{netFlux.toLocaleString()} <span className="text-xs font-bold text-white/70">UNITÉS</span>
            </p>
          </div>
        </div>
      </div>

      {/* Zone d'impression professionnelle standardisée */}
      <ListPrintWrapper
        title="Journal des Mouvements de Stock"
        subtitle="Rapport technique des flux"
        dateRange={{ start: startDate, end: endDate }}
      >
        <table className="w-full text-[10px] border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 uppercase font-black text-gray-700">
              <th className="border border-gray-300 px-3 py-3 text-left">Date Opération</th>
              <th className="border border-gray-300 px-3 py-3 text-left">Produit / Magasin</th>
              <th className="border border-gray-300 px-3 py-3 text-center">Type</th>
              <th className="border border-gray-300 px-3 py-3 text-right">Quantité</th>
              <th className="border border-gray-300 px-3 py-3 text-left">Obs / Utilisateur</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((m, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="border border-gray-300 px-3 py-2">
                  {new Date(m.dateOperation).toLocaleString('fr-FR')}
                </td>
                <td className="border border-gray-300 px-3 py-2 font-bold uppercase">
                  {m.produit}<br/>
                  <small className="font-normal italic text-gray-500">{m.magasin}</small>
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center font-black uppercase italic text-[9px]">
                  {m.type}
                </td>
                <td className={`border border-gray-300 px-3 py-2 text-right font-black ${m.type === 'SORTIE' ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {m.type === 'SORTIE' ? '-' : '+'}{m.quantite.toLocaleString()} {m.unite}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-[8px]">
                  <p className="font-bold uppercase tracking-tighter">{m.utilisateur}</p>
                  <p className="italic text-gray-500">{m.observation || '-'}</p>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
             <tr className="bg-gray-50 font-black text-sm">
                <td colSpan={3} className="border border-gray-300 px-3 py-4 text-right uppercase italic">Bilan des Flux (Période)</td>
                <td className="border border-gray-300 px-3 py-4 text-right text-orange-700">
                   {netFlux > 0 ? '+' : ''}{netFlux.toLocaleString()} UNITÉS
                </td>
                <td className="border border-gray-300 px-3 py-4 text-[9px] text-gray-500 font-normal">
                   E: {totalEntrees.toLocaleString()} / S: {totalSorties.toLocaleString()}
                </td>
             </tr>
          </tfoot>
        </table>
      </ListPrintWrapper>

      <div className="grid grid-cols-1 gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Période du</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">au</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Produit</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="TOUT">Tous les produits</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.designation}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Magasin</label>
            <select
              value={selectedMagasin}
              onChange={(e) => setSelectedMagasin(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="TOUT">Tous les magasins</option>
              {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="TOUT">Tous types</option>
              <option value="ENTREE">Entrées</option>
              <option value="SORTIE">Sorties</option>
              <option value="TRANSFERT">Transferts</option>
              <option value="AJUSTEMENT">Ajustements</option>
            </select>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md font-bold hover:bg-blue-700 flex items-center gap-2 transition-all">
            <Filter className="h-4 w-4" /> Filtrer
          </button>
        </form>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par désignation ou code..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 focus:border-blue-500 focus:outline-none shadow-sm"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : filteredData.length === 0 ? (
          <p className="py-12 text-center text-gray-500 italic">Aucun mouvement ne correspond aux critères.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400 italic">Enregistré le</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Date Opération</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Code</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Désignation</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Magasin</th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Quantité</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Utilisateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {paginatedData.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="whitespace-nowrap px-6 py-4 text-[10px] text-gray-400 italic font-medium">
                      {m.date ? new Date(m.date).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Date inconnue'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-slate-800">
                      {m.dateOperation ? new Date(m.dateOperation).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Non spécifiée'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400 uppercase">{m.code || 'SANS CODE'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{m.produit || 'Produit inconnu'}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-3 w-3 text-gray-400" /> {m.magasin || 'Magasin inconnu'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${getTypeStyle(m.type || '')}`}>
                        {getTypeIcon(m.type || '')}
                        {m.type || 'INCONNU'}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-black ${m.type === 'SORTIE' ? 'text-red-600' : 'text-emerald-600'}`}>
                      <div className="flex flex-col items-end">
                        <button 
                          onClick={() => setSelectedMouvement(m)}
                          className="hover:scale-110 transition-transform cursor-pointer flex flex-col items-end bg-gray-50 px-2 py-1 rounded border border-gray-100 hover:border-blue-200"
                          title="Cliquez pour voir le détail complet"
                        >
                          <span>{m.type === 'SORTIE' ? '-' : '+'}{(m.quantite || 0).toLocaleString()} {m.unite || 'u'}</span>
                          {m.observation && (
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                              {m.observation.substring(0, 15)}...
                            </span>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" /> {m.utilisateur || 'Système'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredData.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* MODAL DÉTAIL MOUVEMENT (Point 3) */}
      {selectedMouvement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="w-full max-w-lg rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 border border-gray-100">
              <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                 <div>
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic">Détail du Flux</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Identification du mouvement #{selectedMouvement.id}</p>
                 </div>
                 <button 
                   onClick={() => setSelectedMouvement(null)}
                   className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-100 transition-all"
                 >
                    <RefreshCcw className="h-5 w-5" />
                 </button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${getTypeStyle(selectedMouvement.type)}`}>
                       {getTypeIcon(selectedMouvement.type)}
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type d'opération</p>
                       <p className="text-lg font-black text-gray-900">{selectedMouvement.type}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Produit concerné</p>
                       <p className="text-sm font-black text-gray-800">{selectedMouvement.produit}</p>
                       <p className="text-[10px] font-bold text-gray-500">{selectedMouvement.code}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Quantité impactée</p>
                       <p className={`text-2xl font-black ${selectedMouvement.type === 'SORTIE' ? 'text-red-600' : 'text-emerald-600'}`}>
                          {selectedMouvement.type === 'SORTIE' ? '-' : '+'}{selectedMouvement.quantite} {selectedMouvement.unite}
                       </p>
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center bg-gray-50/50 p-3 rounded-xl border border-dashed border-gray-200">
                       <p className="text-[10px] font-black text-gray-500 uppercase">Date d'Enregistrement :</p>
                       <p className="text-xs font-bold text-gray-800">{new Date(selectedMouvement.date).toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="flex justify-between items-center bg-gray-50/50 p-3 rounded-xl border border-dashed border-gray-200">
                       <p className="text-[10px] font-black text-blue-600 uppercase">Date réelle d'opération :</p>
                       <p className="text-xs font-black text-blue-700">{new Date(selectedMouvement.dateOperation).toLocaleString('fr-FR')}</p>
                    </div>
                 </div>

                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Observation / Source</p>
                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-sm font-medium text-orange-900 italic">
                       "{selectedMouvement.observation || 'Aucune observation saisie.'}"
                    </div>
                 </div>

                 <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center gap-2">
                       <User className="h-4 w-4 text-gray-400" />
                       <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Saisi par {selectedMouvement.utilisateur}</span>
                    </div>
                    <button 
                       onClick={() => setSelectedMouvement(null)}
                       className="px-6 py-3 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                    >
                       Fermer
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
      {/* Styles Print */}
      <style jsx global>{`
        @media print {
          nav, aside, header, .no-print, button, form { display: none !important; }
          body, main { background: white !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}
