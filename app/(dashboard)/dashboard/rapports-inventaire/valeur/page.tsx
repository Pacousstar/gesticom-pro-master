'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, Download, Coins, Package, Warehouse, Calendar, ArrowRight, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'

interface ProduitValo {
  id: number
  code: string | null
  designation: string
  categorie: string
  unite: string
  quantite: number
  pamp: number
  valeurTotal: number
}

export default function ValeurStockPage() {
  const [data, setData] = useState<ProduitValo[]>([])
  const [magasins, setMagasins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFin, setDateFin] = useState('')
  const [selectedMagasin, setSelectedMagasin] = useState('TOUT')
  const [selectedCategorie, setSelectedCategorie] = useState('TOUTE')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const { error: showError } = useToast()
  const [isPrinting, setIsPrinting] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
   const [entreprise, setEntreprise] = useState<any>(null)
   const [printLayout, setPrintLayout] = useState<'portrait' | 'landscape'>('portrait')

  const ITEMS_PER_PRINT_PAGE = 25

  function chunkArray<T>(array: T[], size: number): T[][] {
    const result = []
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size))
    }
    return result
  }

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setDateFin(today)
    loadMagasins()
    fetchData(today, 'TOUT')
    
    // Charger les paramètres de l'entreprise
    fetch('/api/parametres')
      .then(r => r.ok && r.json())
      .then(d => { if (d) setEntreprise(d) })
      .catch(() => { })
  }, [])

  const loadMagasins = async () => {
    try {
      const res = await fetch('/api/magasins')
      if (res.ok) setMagasins(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const fetchData = async (date: string, mag: string) => {
    setLoading(true)
    try {
      let url = `/api/rapports/inventaire/valeur?dateFin=${date}`
      if (mag !== 'TOUT') url += `&magasinId=${mag}`
      
      const res = await fetch(url)
      if (res.ok) {
        setData(await res.json())
      } else {
        showError('Impossible de charger la valorisation.')
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
    fetchData(dateFin, selectedMagasin)
  }

  const filteredData = data.filter(p => {
    const matchesSearch = p.designation.toLowerCase().includes(search.toLowerCase()) || 
                          (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
    const matchesCategorie = selectedCategorie === 'TOUTE' || p.categorie === selectedCategorie
    return matchesSearch && matchesCategorie
  })

  // Extraire les catégories uniques pour le filtre
  const categories = Array.from(new Set(data.map(p => p.categorie))).sort()

  const totalValeur = filteredData.reduce((acc, p) => acc + p.valeurTotal, 0)
  const totalQuantite = filteredData.reduce((acc, p) => acc + p.quantite, 0)

  const paginatedData = Array.isArray(filteredData) ? filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : []
  const totalPages = Math.ceil((Array.isArray(filteredData) ? filteredData.length : 0) / itemsPerPage)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Valeur de Stock</h1>
          <p className="text-sm text-white/90 font-medium">Estimation financière du stock disponible à une date donnée</p>
        </div>
        <div className="flex gap-3 no-print">
          <button 
            onClick={() => setIsPreviewOpen(true)}
            disabled={isPrinting}
            className="flex items-center gap-2 rounded-lg border-2 border-orange-500 bg-orange-50 px-4 py-2 text-sm font-black text-orange-800 hover:bg-orange-100 shadow-lg transition-all active:scale-95 disabled:opacity-50 uppercase"
          >
            <Printer className="h-4 w-4" /> 
            APERÇU & IMPRESSION
          </button>
          <button 
            onClick={() => {
              const url = `/api/rapports/inventaire/valeur/export?dateFin=${dateFin}&magasinId=${selectedMagasin}`
              window.open(url, '_blank')
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 shadow-lg transition-all active:scale-95 uppercase"
          >
            <Download className="h-4 w-4 text-emerald-600" /> EXCEL
          </button>
        </div>
      </div>

      {/* Titre Impression (Invisible à l'écran) - Géré par ListPrintWrapper désomais */}

      {/* MODALE D'APERÇU IMPRESSION VALORISATION (ZenPrint) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-gray-900/95 backdrop-blur-md no-print font-sans text-slate-900 uppercase italic tracking-tighter">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
              <div className="flex items-center gap-6">
                 <div>
                   <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Rapport de Valorisation</h2>
                   <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                     Estimation Financière des Stocks Disponibles
                   </p>
                 </div>
                 <div className="h-10 w-px bg-gray-200" />
                 <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-emerald-600 italic uppercase">Dépôt : {selectedMagasin === 'TOUT' ? 'Global' : magasins.find(m => m.id === Number(selectedMagasin))?.nom || 'Inconnu'}</span>
                      <span className="text-xs font-black text-emerald-600 italic uppercase text-[10px]">Arrêté au : {new Date(dateFin).toLocaleDateString('fr-FR')}</span>
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
                  Imprimer
                </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
              <div className={`mx-auto shadow-2xl bg-white ${printLayout === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]'} min-h-screen p-4 text-slate-900 not-italic tracking-normal`}>
                  {chunkArray(filteredData, ITEMS_PER_PRINT_PAGE).map((chunk: ProduitValo[], index: number, allChunks: ProduitValo[][]) => (
                      <div key={index} className="page-break-after border-b-2 border-dashed border-gray-200 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0">
                          <ListPrintWrapper
                              title="RAPPORT DE VALORISATION DES STOCKS"
                              subtitle={`Dépôt : ${selectedMagasin === 'TOUT' ? 'Global' : magasins.find(m => m.id === Number(selectedMagasin))?.nom || 'Inconnu'} | Inventaire au : ${new Date(dateFin).toLocaleDateString('fr-FR')}`}
                              pageNumber={index + 1}
                              totalPages={allChunks.length}
                              layout={printLayout}
                              enterprise={entreprise}
                          >
                              <table className="w-full text-[13px] border-collapse border-2 border-black font-sans">
                                  <thead>
                                      <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                          <th className="border border-black px-2 py-3 text-center w-10 italic">N°</th>
                                          <th className="border border-black px-2 py-3 text-left">Référence / Désignation</th>
                                          <th className="border border-black px-2 py-3 text-center">Catégorie</th>
                                          <th className="border border-black px-2 py-3 text-right">Qté</th>
                                          <th className="border border-black px-2 py-3 text-right text-[11px]">PAMP / Achat</th>
                                          <th className="border border-black px-2 py-3 text-right bg-emerald-50 underline decoration-double font-black">VALEUR TOTALE</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {chunk.map((p: ProduitValo, idx: number) => (
                                          <tr key={idx} className="border-b border-black">
                                              <td className="border border-black px-2 py-2 text-center font-bold">
                                                  {index * ITEMS_PER_PRINT_PAGE + idx + 1}
                                              </td>
                                              <td className="border border-black px-2 py-2">
                                                  <div className="font-black uppercase text-[12px]">{p.designation}</div>
                                                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.code || 'SANS REF'} • {p.unite}</div>
                                              </td>
                                              <td className="border border-black px-2 py-2 text-center italic text-[10px] font-bold uppercase">
                                                  {p.categorie}
                                              </td>
                                              <td className="border border-black px-2 py-2 text-right font-black text-[14px]">
                                                  {p.quantite.toLocaleString()}
                                              </td>
                                              <td className="border border-black px-2 py-2 text-right tabular-nums">
                                                  {p.pamp.toLocaleString('fr-FR')}
                                              </td>
                                              <td className="border border-black px-2 py-2 text-right font-black bg-emerald-50/20 text-[14px] tabular-nums">
                                                  {p.valeurTotal.toLocaleString('fr-FR')} F
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                                  {index === allChunks.length - 1 && (
                                      <tfoot>
                                          <tr className="bg-emerald-900 font-black text-[15px] border-t-4 border-black uppercase italic text-white shadow-2xl">
                                              <td colSpan={3} className="border border-black px-4 py-8 text-right bg-emerald-950 tracking-widest leading-none">
                                                VALORISATION TOTALE DU STOCK :
                                                <div className="text-[9px] not-italic tracking-normal mt-1 opacity-60">Calcul basé sur le PAMP du jour</div>
                                              </td>
                                              <td className="border border-black px-4 py-8 text-right bg-emerald-900 tabular-nums">
                                                  {totalQuantite.toLocaleString()}
                                              </td>
                                              <td colSpan={2} className="border border-black px-4 py-8 text-right text-2xl bg-emerald-900 tabular-nums shadow-inner">
                                                  {totalValeur.toLocaleString('fr-FR')} FCFA
                                              </td>
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

      {/* ZONE D'IMPRESSION (Masquée à l'écran) */}
      <div className="hidden print:block absolute inset-0 bg-white">
        {chunkArray(filteredData, ITEMS_PER_PRINT_PAGE).map((chunk: ProduitValo[], index: number, allChunks: ProduitValo[][]) => (
          <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
            <ListPrintWrapper
              title="RAPPORT DE VALORISATION DES STOCKS"
              subtitle={`Dépôt : ${selectedMagasin === 'TOUT' ? 'Global' : magasins.find(m => m.id === Number(selectedMagasin))?.nom || 'Inconnu'} | Date d'inventaire : ${new Date(dateFin).toLocaleDateString('fr-FR')}`}
              pageNumber={index + 1}
              totalPages={allChunks.length}
              enterprise={entreprise}
            >
              <table className="w-full text-[14px] border-collapse border-2 border-black font-sans">
                <thead>
                  <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                    <th className="border border-black px-2 py-3 text-center w-10">N°</th>
                    <th className="border border-black px-2 py-3 text-left">Référence</th>
                    <th className="border border-black px-2 py-3 text-left">Désignation</th>
                    <th className="border border-black px-2 py-3 text-center">Catégorie</th>
                    <th className="border border-black px-2 py-3 text-right">Quantité</th>
                    <th className="border border-black px-2 py-3 text-right">PAMP / Achat</th>
                    <th className="border border-black px-2 py-3 text-right bg-emerald-50 underline decoration-double font-black">VALEUR TOTALE</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((p: ProduitValo, idx: number) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="border border-black px-2 py-2 text-center font-bold">
                        {index * ITEMS_PER_PRINT_PAGE + idx + 1}
                      </td>
                      <td className="border border-black px-2 py-2 font-mono text-[11px] font-bold">
                        {p.code || '—'}
                      </td>
                      <td className="border border-black px-2 py-2">
                        <div className="font-black uppercase text-[13px]">{p.designation}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.unite}</div>
                      </td>
                      <td className="border border-black px-2 py-2 text-center italic text-[11px] font-bold">
                        {p.categorie}
                      </td>
                      <td className="border border-black px-2 py-2 text-right font-black text-[15px]">
                        {p.quantite.toLocaleString()}
                      </td>
                      <td className="border border-black px-2 py-2 text-right">
                        {p.pamp.toLocaleString('fr-FR')} F
                      </td>
                      <td className="border border-black px-2 py-2 text-right font-black bg-emerald-50/20 text-[15px]">
                        {p.valeurTotal.toLocaleString('fr-FR')} F
                      </td>
                    </tr>
                  ))}
                </tbody>
                {index === allChunks.length - 1 && (
                  <tfoot>
                    <tr className="bg-emerald-900 font-black text-[16px] border-t-4 border-black uppercase italic text-white shadow-2xl">
                      <td colSpan={4} className="border border-black px-4 py-8 text-right bg-emerald-950 tracking-widest">VALORISATION TOTALE DU STOCK :</td>
                      <td className="border border-black px-4 py-8 text-right bg-emerald-900">
                        {totalQuantite.toLocaleString()}
                      </td>
                      <td colSpan={2} className="border border-black px-4 py-8 text-right text-2xl bg-emerald-900 tabular-nums">
                        {totalValeur.toLocaleString('fr-FR')} F CFA
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </ListPrintWrapper>
          </div>
        ))}
      </div>

      {/* VUE ÉCRAN (Masquée à l'impression) */}
      <div className="print:hidden space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Filtres */}
          <div className="md:col-span-2 space-y-4">
            <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-black text-gray-700 uppercase mb-1">Date d'inventaire</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-black text-gray-700 uppercase mb-1">Magasin / Dépôt</label>
                <div className="relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={selectedMagasin}
                    onChange={(e) => setSelectedMagasin(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm appearance-none focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="TOUT">Tous les magasins</option>
                    {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-black text-gray-700 uppercase mb-1">Catégorie</label>
                <select
                  value={selectedCategorie}
                  onChange={(e) => setSelectedCategorie(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                >
                  <option value="TOUTE">Toutes les catégories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2 h-[40px] shadow-sm">
                <ArrowRight className="h-4 w-4" /> Calculer Valeur
              </button>
            </form>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 focus:border-emerald-500 shadow-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Résumé Financier */}
          <div className="bg-emerald-900 text-white p-6 rounded-2xl shadow-lg flex flex-col justify-center gap-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
               <Coins className="h-24 w-24" />
            </div>
            <p className="text-emerald-300 text-xs font-bold uppercase tracking-widest">
              Valeur Totale du Stock
              {(search.trim() || selectedCategorie !== 'TOUTE' || selectedMagasin !== 'TOUT') && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-900 uppercase tracking-tighter">
                  ⚠️ Filtré
                </span>
              )}
            </p>
            <p className="text-3xl font-black mb-1">{totalValeur.toLocaleString('fr-FR')} F</p>
            <div className="pt-2 border-t border-emerald-800 flex justify-between items-center text-sm">
               <span className="text-emerald-400">Total Articles :</span>
               <span className="font-bold">{totalQuantite.toLocaleString()}</span>
            </div>
            {(search.trim() || selectedCategorie !== 'TOUTE' || selectedMagasin !== 'TOUT') && (
              <p className="text-[10px] text-amber-300 italic font-medium mt-1">
                ⚠️ Totaux calculés sur la sélection actuelle uniquement. Effacez les filtres pour voir le total global.
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : filteredData.length === 0 ? (
            <p className="py-12 text-center text-gray-500 italic font-medium">Aucun stock valorisé pour ces critères.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-gray-600">Référence</th>
                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-gray-600">Désignation</th>
                    <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-wider text-gray-600">Catégorie</th>
                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-gray-600">Quantité</th>
                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-gray-600">PAMP / Prix Achat</th>
                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-gray-600">Valeur Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paginatedData.map((p) => (
                    <tr key={p.id} className="hover:bg-emerald-50/30 transition-colors group">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-400 group-hover:text-emerald-600">
                        {p.code || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg text-gray-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                             <Package className="h-4 w-4" />
                          </div>
                          <span className="font-bold text-gray-800">{p.designation}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          {p.categorie}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-bold text-gray-900">
                        {p.quantite.toLocaleString()} <span className="text-gray-400 font-normal text-xs uppercase">{p.unite}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-600 italic">
                        {p.pamp.toLocaleString('fr-FR')} F
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-black text-gray-900 bg-emerald-50/20 group-hover:bg-emerald-50 transition-colors">
                        {p.valeurTotal.toLocaleString('fr-FR')} F
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
      </div>
    </div>
  )
}
