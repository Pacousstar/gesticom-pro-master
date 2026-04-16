'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, Download, Filter, Package, Warehouse, User, ArrowUpRight, ArrowDownLeft, RefreshCcw, AlertTriangle, Printer, TrendingUp, X, FileText, HelpCircle } from 'lucide-react'
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
  const { success: showSuccess, error: showError } = useToast()
  const [isPrinting, setIsPrinting] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [allMouvementsForPrint, setAllMouvementsForPrint] = useState<Mouvement[]>([])
  const [printLayout, setPrintLayout] = useState<'portrait' | 'landscape'>('portrait')
  const [entreprise, setEntreprise] = useState<any>(null)

  const ITEMS_PER_PRINT_PAGE = 25

  function chunkArray<T>(array: T[], size: number): T[][] {
    const result = []
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size))
    }
    return result
  }

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
            onClick={async () => {
              setIsPrinting(true)
              try {
                // On s'assure d'avoir toutes les données pour l'impression
                let url = `/api/rapports/inventaire/mouvements?dateDebut=${startDate}&dateFin=${endDate}`
                if (selectedProduct !== 'TOUT') url += `&produitId=${selectedProduct}`
                if (selectedMagasin !== 'TOUT') url += `&magasinId=${selectedMagasin}`
                if (selectedType !== 'TOUT') url += `&type=${selectedType}`
                url += `&limit=10000`

                const res = await fetch(url)
                if (res.ok) {
                  const d = await res.json()
                  setAllMouvementsForPrint(Array.isArray(d) ? d : [])
                  setIsPreviewOpen(true)
                }
              } catch (e) {
                 console.error(e)
                 showError("Erreur lors de la préparation de l'impression.")
              } finally {
                 setIsPrinting(false)
              }
            }}
            disabled={isPrinting}
            className="flex items-center gap-2 rounded-lg border-2 border-orange-500 bg-orange-50 px-4 py-2 text-sm font-black text-orange-800 hover:bg-orange-100 shadow-xl transition-all active:scale-95 disabled:opacity-50 uppercase"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} 
            IMPRIMER
          </button>
          <button 
            onClick={() => {
              let url = `/api/rapports/inventaire/mouvements/export?dateDebut=${startDate}&dateFin=${endDate}`
              if (selectedProduct !== 'TOUT') url += `&produitId=${selectedProduct}`
              if (selectedMagasin !== 'TOUT') url += `&magasinId=${selectedMagasin}`
              if (selectedType !== 'TOUT') url += `&type=${selectedType}`
              window.open(url, '_blank')
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 shadow-lg transition-all active:scale-95 uppercase"
          >
            <Download className="h-4 w-4 text-emerald-600" /> EXCEL
          </button>
        </div>
      </div>

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

      {/* ZONE D'IMPRESSION (Masquée à l'écran) */}
      <div className="hidden print:block absolute inset-0 bg-white shadow-2xl">
        {chunkArray(allMouvementsForPrint.length > 0 ? allMouvementsForPrint : filteredData, ITEMS_PER_PRINT_PAGE).map((chunk: Mouvement[], index: number, allChunks: Mouvement[][]) => (
          <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
            <ListPrintWrapper
              title="JOURNAL DES MOUVEMENTS DE STOCK"
              subtitle={`Flux de produits du ${startDate} au ${endDate}`}
              pageNumber={index + 1}
              totalPages={allChunks.length}
              layout={printLayout}
              enterprise={entreprise}
            >
              <table className="w-full text-[12px] border-collapse border-2 border-black font-sans">
                <thead>
                  <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                    <th className="border-r-2 border-black px-2 py-3 text-left">Date Opération</th>
                    <th className="border-r-2 border-black px-2 py-3 text-left">Produit / Magasin</th>
                    <th className="border-r-2 border-black px-2 py-3 text-center">Type</th>
                    <th className="border-r-2 border-black px-2 py-3 text-right">Quantité</th>
                    <th className="px-2 py-3 text-left text-[10px]">Observations / Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((m, idx) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="border-r-2 border-black px-2 py-2 font-mono text-[10px]">
                        {new Date(m.dateOperation).toLocaleString('fr-FR')}
                      </td>
                      <td className="border-r-2 border-black px-2 py-2">
                        <div className="font-black uppercase text-[12px]">{m.produit}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{m.magasin}</div>
                      </td>
                      <td className="border-r-2 border-black px-2 py-2 text-center font-black uppercase text-[10px] italic">
                        {m.type}
                      </td>
                      <td className={`border-r-2 border-black px-2 py-2 text-right font-black text-[14px] ${m.type === 'SORTIE' ? 'text-red-700' : 'text-emerald-700'}`}>
                        {m.type === 'SORTIE' ? '-' : '+'}{m.quantite.toLocaleString()} {m.unite}
                      </td>
                      <td className="px-2 py-2 italic text-[10px]">
                        <p className="font-bold uppercase tracking-tighter opacity-70 mb-1">{m.utilisateur}</p>
                        <p className="leading-tight">{m.observation || '-'}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {index === allChunks.length - 1 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-black text-[14px] border-t-2 border-black uppercase italic shadow-2xl">
                        <td colSpan={3} className="border-r-2 border-black px-3 py-6 text-right tracking-[0.2em] underline decoration-double">FLUX NET DE PÉRIODE</td>
                        <td className="border-r-2 border-black px-3 py-6 text-right text-lg tabular-nums bg-gray-100 ring-2 ring-black">
                           {netFlux > 0 ? '+' : ''}{netFlux.toLocaleString()}
                        </td>
                        <td className="px-3 py-6 bg-white text-[10px] not-italic opacity-60">
                           Entrées: {totalEntrees.toLocaleString()} | Sorties: {totalSorties.toLocaleString()}
                        </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </ListPrintWrapper>
          </div>
        ))}
      </div>

      {/* MODALE D'APERÇU IMPRESSION MOUVEMENTS (ZenPrint) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
              <div className="flex items-center gap-6">
                 <div>
                   <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Journal des Flux</h2>
                   <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                     Traçabilité Intégrale des Mouvements de Stock
                   </p>
                 </div>
                 <div className="h-10 w-px bg-gray-200" />
                 <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Période du</span>
                      <span className="text-xs font-black text-orange-600 italic uppercase">{startDate} au {endDate}</span>
                    </div>
                    <div className="h-10 w-px bg-gray-200" />
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Orientation :</label>
                      <select 
                        value={printLayout}
                        onChange={(e) => setPrintLayout(e.target.value as any)}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Paysage</option>
                      </select>
                    </div>
                 </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase"
                >
                  Fermer
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 rounded-xl bg-orange-600 px-10 py-2 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 uppercase"
                >
                  <Printer className="h-4 w-4" />
                  Lancer l'impression
                </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
              <div className={`mx-auto shadow-2xl bg-white ${printLayout === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]'} min-h-screen p-12 text-slate-900 not-italic tracking-normal`}>
                  {chunkArray(allMouvementsForPrint.length > 0 ? allMouvementsForPrint : filteredData, ITEMS_PER_PRINT_PAGE).map((chunk: Mouvement[], index: number, allChunks: Mouvement[][]) => (
                      <div key={index} className="page-break-after border-b-2 border-dashed border-gray-200 mb-12 pb-12 last:border-0 last:mb-0 last:pb-0 shadow-sm">
                          <ListPrintWrapper
                              title="JOURNAL RÉCAPITULATIF DES MOUVEMENTS"
                              subtitle={`Audit des flux logistiques - Du ${startDate} au ${endDate}`}
                              pageNumber={index + 1}
                              totalPages={allChunks.length}
                              layout={printLayout}
                              enterprise={entreprise}
                          >
                              <table className="w-full text-[14px] border-collapse border-2 border-black font-sans shadow-xl">
                                <thead>
                                  <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                    <th className="border-r-2 border-black px-3 py-3 text-left">Horodatage</th>
                                    <th className="border-r-2 border-black px-3 py-3 text-left">Produit & Dépôt</th>
                                    <th className="border-r-2 border-black px-3 py-3 text-center">Type</th>
                                    <th className="border-r-2 border-black px-3 py-3 text-right">Quantité</th>
                                    <th className="px-3 py-3 text-left">Opérateur / Obs</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {chunk.map((m, idx) => (
                                    <tr key={idx} className="border-b border-black group hover:bg-orange-50/20 transition-colors">
                                      <td className="border-r-2 border-black px-3 py-2 font-mono text-[11px] font-bold text-gray-500">
                                        {new Date(m.dateOperation).toLocaleString('fr-FR')}
                                      </td>
                                      <td className="border-r-2 border-black px-3 py-2">
                                        <div className="font-black uppercase text-slate-800 tracking-tight leading-none mb-1">{m.produit}</div>
                                        <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest">{m.magasin}</div>
                                      </td>
                                      <td className="border-r-2 border-black px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase italic ${getTypeStyle(m.type)}`}>
                                          {m.type}
                                        </span>
                                      </td>
                                      <td className={`border-r-2 border-black px-3 py-2 text-right font-black tabular-nums text-lg ${m.type === 'SORTIE' ? 'text-red-600 bg-red-50/10' : 'text-emerald-600 bg-emerald-50/10'}`}>
                                        {m.type === 'SORTIE' ? '-' : '+'}{m.quantite.toLocaleString()} <span className="text-[10px] opacity-40">{m.unite}</span>
                                      </td>
                                      <td className="px-3 py-2 italic text-[11px] leading-tight">
                                        <div className="font-black text-slate-900 uppercase mb-1">{m.utilisateur}</div>
                                        <div className="opacity-70">{m.observation || '—'}</div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                {index === allChunks.length - 1 && (
                                  <tfoot>
                                    <tr className="bg-slate-900 text-white font-black text-[16px] border-t-2 border-black uppercase italic shadow-2xl">
                                        <td colSpan={3} className="px-4 py-8 text-right bg-slate-800 tracking-widest underline decoration-orange-500 underline-offset-8">BILAN NET DES UNITÉS TRANSFÉRÉES</td>
                                        <td className="px-4 py-8 text-right text-3xl tabular-nums bg-slate-900 shadow-inner ring-4 ring-slate-800 ring-inset">
                                           {netFlux > 0 ? '+' : ''}{netFlux.toLocaleString()}
                                        </td>
                                        <td className="bg-slate-800"></td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                          </ListPrintWrapper>
                      </div>
                  ))}
              </div>
          </div>
        </div>
      )}

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
                      {m.date ? new Date(m.date).toLocaleString('fr-FR') : 'Date inconnue'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-slate-800">
                      {m.dateOperation ? new Date(m.dateOperation).toLocaleString('fr-FR') : 'Non spécifiée'}
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
                    <td 
                      onClick={() => setSelectedMouvement(m)}
                      className={`whitespace-nowrap px-6 py-4 text-right text-sm font-black cursor-pointer hover:underline decoration-2 underline-offset-4 ${m.type === 'SORTIE' ? 'text-red-600' : 'text-emerald-600'}`}
                    >
                      {m.type === 'SORTIE' ? '-' : '+'}{(m.quantite || 0).toLocaleString()} {m.unite || 'u'}
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

      {selectedMouvement && (() => {
        const obs = selectedMouvement.observation || ''
        const refMatch = obs.match(/(Vente|Achat|Transfert|Ajustement|Inventaire)\s+([A-Z0-9]+)/i)
        const docType = refMatch ? refMatch[1] : null
        const docRef = refMatch ? refMatch[2] : null

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white/20 transform animate-in zoom-in-95 duration-300">
                <div className={`p-8 text-white flex items-center justify-between ${selectedMouvement.type === 'SORTIE' ? 'bg-gradient-to-r from-red-600 to-rose-500' : 'bg-gradient-to-r from-emerald-600 to-teal-500'}`}>
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner">
                      {getTypeIcon(selectedMouvement.type)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter">Détail du Flux</h2>
                      <p className="text-white/80 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Package className="h-3 w-3" /> {selectedMouvement.type} DE STOCK
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedMouvement(null)}
                    className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all active:scale-90"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="p-8 space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Produit concerné</p>
                      <p className="text-xl font-black text-gray-900 uppercase leading-none">{selectedMouvement.produit}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded uppercase tracking-wider border border-gray-200">
                          Code: {selectedMouvement.code}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded uppercase tracking-wider border border-gray-200">
                          Unité: {selectedMouvement.unite}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Impact Stock</p>
                      <p className={`text-4xl font-black tabular-nums transition-all ${selectedMouvement.type === 'SORTIE' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {selectedMouvement.type === 'SORTIE' ? '-' : '+'}{selectedMouvement.quantite.toLocaleString()}
                      </p>
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Unités sorties</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 py-6 border-y border-gray-100">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                          <Warehouse className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lieu de stockage</p>
                          <p className="text-sm font-bold text-gray-700">{selectedMouvement.magasin}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Responsable Saisie</p>
                          <p className="text-sm font-bold text-gray-700">{selectedMouvement.utilisateur}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 justify-end text-right">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date effective</p>
                          <p className="text-sm font-bold text-gray-700">{new Date(selectedMouvement.dateOperation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                          <p className="text-[10px] text-gray-400 font-mono italic">{new Date(selectedMouvement.dateOperation).toLocaleTimeString('fr-FR')}</p>
                        </div>
                        <div className="mt-1 h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                           <RefreshCcw className="h-4 w-4" />
                        </div>
                      </div>
                      
                      {docRef && (
                        <div className="flex items-start gap-3 justify-end text-right">
                          <div>
                            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Référence Document</p>
                            <p className="text-sm font-black text-gray-900 uppercase underline decoration-orange-300 underline-offset-2">{docRef}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{docType}</p>
                          </div>
                          <div className="mt-1 h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                             <FileText className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-inner">
                    <div className="flex items-center gap-2 mb-2">
                       <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observation système complète</p>
                    </div>
                    <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                      {selectedMouvement.observation || "Aucune observation détaillée disponible pour ce mouvement."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[9px] font-mono text-gray-300 uppercase tracking-widest">ID Mouvement: #{selectedMouvement.id}</p>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setSelectedMouvement(null)}
                        className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                      >
                        Fermer
                      </button>
                      <button 
                        onClick={() => setSelectedMouvement(null)}
                        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-[0_10px_30px_rgba(15,23,42,0.3)] flex items-center gap-2"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" /> Terminer
                      </button>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        )
      })()}
      <style jsx global>{`
        @media print {
          nav, aside, header, .no-print, button, form { display: none !important; }
          body, main { background: white !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}
