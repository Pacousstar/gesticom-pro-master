'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, Download, Coins, Package, Warehouse, Calendar, ArrowRight, Printer, X } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import { paginateForPrint } from '@/lib/print-helpers'

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

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface TotalsInfo {
  valeurTotal: number
  totalQuantite: number
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
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [totals, setTotals] = useState<TotalsInfo | null>(null)
  const itemsPerPage = 20
  const { error: showError } = useToast()
  const [isPrinting, setIsPrinting] = useState(false)
  const [entreprise, setEntreprise] = useState<any>(null)
  const [allDataForPrint, setAllDataForPrint] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // P2: impression standardisée (1ère page plus courte, puis 23 lignes/page)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setDateFin(today)
    loadMagasins()
    fetchData(today, 'TOUT', 1, '', selectedCategorie)
    loadCategories(today)
    
    fetch('/api/parametres')
      .then(r => r.ok && r.json())
      .then(d => { if (d) setEntreprise(d) })
      .catch(() => { })
  }, [])

  // Recherche temps réel : mise à jour à chaque frappe avec debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      fetchData(dateFin, selectedMagasin, 1, search, selectedCategorie)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, selectedCategorie])

  const loadMagasins = async () => {
    try {
      const res = await fetch('/api/magasins')
      if (res.ok) {
        const magData = await res.json()
        setMagasins(Array.isArray(magData) ? magData : (magData.data || []))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadCategories = async (date?: string) => {
    try {
      const d = date || dateFin
      if (!d) return
      const res = await fetch(`/api/rapports/inventaire/valeur?limit=10000&dateFin=${d}`)
      if (res.ok) {
        const json = await res.json()
        const allData = json.data || []
        const cats = Array.from(new Set(allData.map((p: any) => p.categorie))).sort() as string[]
        setCategories(cats)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchData = async (date: string, mag: string, page: number = 1, searchTerm: string = '', cat: string = 'TOUTE') => {
    setLoading(true)
    try {
      let url = `/api/rapports/inventaire/valeur?dateFin=${date}&page=${page}&limit=${itemsPerPage}&includeTotals=true`
      if (mag !== 'TOUT') url += `&magasinId=${mag}`
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`
      if (cat && cat !== 'TOUTE') url += `&categorie=${encodeURIComponent(cat)}`
      
      const res = await fetch(url)
      if (res.ok) {
        const d = await res.json()
        setData(d.data || [])
        setPagination(d.pagination || null)
        setTotals(d.totals || null)
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
    fetchData(dateFin, selectedMagasin, 1, search, selectedCategorie)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    fetchData(dateFin, selectedMagasin, newPage, search, selectedCategorie)
  }

  const totalValeur = totals?.valeurTotal ?? 0
  const totalQuantite = totals?.totalQuantite ?? 0

  const printInNewWindow = async (data: any[]) => {
    if (!data.length) return

    const entite = await fetch('/api/parametres').then(r => r.ok ? r.json() : null).catch(() => null) || {}

    const chunks = paginateForPrint(data, { firstPageSize: 14, otherPagesSize: 18 })
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    let totalValeur = 0, totalQte = 0

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
            <div style="font-size:16px;font-weight:900;text-transform:uppercase;">Rapport de Valorisation des Stocks</div>
            <div style="font-size:12px;font-weight:700;color:#555;margin-top:2px;">${selectedMagasin === 'TOUT' ? 'Tous les magasins' : (magasins.find(m => m.id === Number(selectedMagasin))?.nom || '')} | ${new Date(dateFin).toLocaleDateString('fr-FR')}</div>
            <div style="font-size:11px;font-weight:900;color:#888;margin-top:8px;">Date d'édition: ${today}</div>
            <div style="font-size:14px;font-weight:900;color:#d46c0a;margin-top:4px;">PAGE ${pageNum} / ${totalPages}</div>
          </div>
        </div>`
      }
      return `<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
        <div style="font-size:14px;font-weight:900;color:#d46c0a;">PAGE ${pageNum} / ${totalPages}</div>
      </div>`
    }

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Valorisation des Stocks</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; }
  .page { page-break-after: always; padding: 0; }
  .page:last-child { page-break-after: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #eee; border: 2px solid #000; padding: 5px 3px; font-size: 12px; font-weight: 900; text-align: center; }
  th.left { text-align: left; }
  td { border: 1px solid #000; padding: 3px; font-size: 12px; }
  td.center { text-align: center; }
  td.left { text-align: left; }
  tfoot td { background: #e0e0e0; font-weight: 900; font-size: 13px; }
</style></head><body>`

    chunks.forEach((chunk, index, allChunks) => {
      html += `<div class="page">`
      html += headerHtml(index === 0, index + 1, allChunks.length)
      html += `<table>
        <thead><tr>
          <th style="width:8%">N° /<br/>REFERENCE</th>
          <th style="width:30%" class="left">DESIGNATION /<br/>CATEGORIE</th>
          <th style="width:10%">QUANTITE</th>
          <th style="width:16%">PRIX ACHAT /<br/>PAMP</th>
          <th style="width:12%">VALEUR<br/>STOCK</th>
        </tr></thead><tbody>`
      chunk.forEach((p: any) => {
        totalQte += p.quantite || 0
        totalValeur += p.valeurTotal || 0
        html += `<tr>
          <td class="center"><b>${chunk.indexOf(p) + 1}</b><br/><span style="font-size:11px;color:#555;">${p.code || '—'}</span></td>
          <td class="left"><b>${p.designation || '—'}</b><br/><span style="font-size:11px;color:#888;">${p.categorie || '—'}</span></td>
          <td class="center" style="font-weight:900;">${(p.quantite || 0).toLocaleString('fr-FR')}</td>
          <td class="center">${(p.pamp || 0).toLocaleString('fr-FR')} F<br/><span style="font-size:11px;color:#555;">${(p.pamp || 0).toLocaleString('fr-FR')} F</span></td>
          <td class="center" style="font-weight:900;color:#059669;">${(p.valeurTotal || 0).toLocaleString('fr-FR')} F</td>
        </tr>`
      })
      if (index === allChunks.length - 1) {
        html += `<tfoot><tr>
          <td colspan="3" class="right" style="padding-right:8px;">VALORISATION TOTALE</td>
          <td class="center">—</td>
          <td class="center" style="color:#059669;font-weight:900;">${totalValeur.toLocaleString('fr-FR')} F</td>
        </tr></tfoot>`
      }
      html += `</tbody></table></div>`
    })

    html += `</body></html>`
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 500)
    } else {
      alert('Autorisez les popups pour imprimer, ou utilisez Ctrl+P')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Valeur de Stock</h1>
          <p className="text-sm text-white/90 font-medium">Estimation financière du stock disponible à une date donnée</p>
        </div>
        <div className="flex gap-2 no-print">
          <button 
            onClick={async () => {
              setIsPrinting(true)
              try {
                let url = `/api/rapports/inventaire/valeur?dateFin=${dateFin}&limit=10000&includeTotals=true`
                if (selectedMagasin !== 'TOUT') url += `&magasinId=${selectedMagasin}`
                if (search) url += `&search=${encodeURIComponent(search)}`
                if (selectedCategorie !== 'TOUTE') url += `&categorie=${encodeURIComponent(selectedCategorie)}`
                const res = await fetch(url)
                if (res.ok) {
                  const d = await res.json()
                  setAllDataForPrint(Array.isArray(d.data) ? d.data : [])
                  setIsPreviewOpen(true)
                }
              } catch (e) {
                console.error(e)
              } finally {
                setIsPrinting(false)
              }
            }}
            disabled={isPrinting}
            className="flex items-center gap-2 rounded-lg border-2 border-orange-500 bg-orange-50 px-4 py-2 text-sm font-black text-orange-800 hover:bg-orange-100 shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} 
            IMPRIMER LA LISTE
          </button>
          <button 
            onClick={async () => {
              try {
                let url = `/api/rapports/inventaire/valeur?dateFin=${dateFin}&export=all&includeTotals=true`
                if (selectedMagasin !== 'TOUT') url += `&magasinId=${selectedMagasin}`
                if (search) url += `&search=${encodeURIComponent(search)}`
                
                const res = await fetch(url)
                if (res.ok) {
                  const d = await res.json()
                  const allData = d.data || []
                  
                  const csv = [
                    ['Code', 'Désignation', 'Catégorie', 'Unité', 'Quantité', 'PAMP', 'Valeur Totale'].join(';'),
                    ...allData.map((p: ProduitValo) => [
                      p.code || '',
                      p.designation,
                      p.categorie,
                      p.unite,
                      p.quantite,
                      p.pamp,
                      p.valeurTotal
                    ].join(';'))
                  ].join('\n')
                  
                  const totalRow = [
                    '', '', '', '',
                    d.totals?.totalQuantite || 0,
                    '',
                    d.totals?.valeurTotal || 0
                  ].join(';')
                  
                  const bom = '\uFEFF'
                  const blob = new Blob([bom + csv + '\n' + totalRow], { type: 'text/csv;charset=utf-8;' })
                  const blobUrl = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = blobUrl
                  a.download = `valeur_stock_${dateFin}.csv`
                  a.click()
                  window.URL.revokeObjectURL(blobUrl)
                }
              } catch (err) {
                console.error('Export error:', err)
                showError('Erreur lors de l\'export.')
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white no-print">
          <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-100">
            <div className="flex items-center gap-6">
              <h2 className="text-lg font-black uppercase tracking-tight">Valorisation des Stocks</h2>
              <span className="rounded-full bg-orange-100 px-4 py-1.5 text-xs font-black text-orange-700 uppercase">
                {(allDataForPrint.length > 0 ? allDataForPrint : data).length} Lignes
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => { setIsPreviewOpen(false); await printInNewWindow(allDataForPrint.length > 0 ? allDataForPrint : data) }}
                className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600 flex items-center gap-2"
              >
                <Printer className="h-4 w-4" /> LANCER L'IMPRESSION
              </button>
              <button onClick={() => setIsPreviewOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-200 flex items-center gap-2">
                <X className="h-4 w-4" /> Fermer
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="mx-auto" style={{maxWidth:'297mm'}}>
              {(() => {
                const printData = allDataForPrint.length > 0 ? allDataForPrint : data
                const chunks = paginateForPrint(printData, { firstPageSize: 14, otherPagesSize: 18 })
                let totalValeur = 0, totalQte = 0
                return chunks.map((chunk: any[], index: number, allChunks: any[][]) => (
                  <div key={index} className={index < allChunks.length - 1 ? 'page-break border-b-2 border-dashed border-gray-100 mb-8 pb-8' : ''}>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-200 uppercase font-black">
                          <th style={{width:'8%'}} className="border-2 border-black p-2 text-center">N° /<br/>REFERENCE</th>
                          <th style={{width:'30%'}} className="border-2 border-black p-2 text-left">DESIGNATION /<br/>CATEGORIE</th>
                          <th style={{width:'10%'}} className="border-2 border-black p-2 text-center">QUANTITE</th>
                          <th style={{width:'16%'}} className="border-2 border-black p-2 text-center">PRIX ACHAT /<br/>PAMP</th>
                          <th style={{width:'12%'}} className="border-2 border-black p-2 text-center">VALEUR<br/>STOCK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chunk.map((p: any, idx: number) => {
                          totalQte += p.quantite || 0
                          totalValeur += p.valeurTotal || 0
                          return (
                            <tr key={idx} className="border-b">
                              <td className="border p-2 text-center font-bold">{idx + 1}<br/><span className="text-xs text-gray-500">{p.code || '—'}</span></td>
                              <td className="border p-2 text-left"><b>{p.designation || '—'}</b><br/><span className="text-xs text-gray-500">{p.categorie || '—'}</span></td>
                              <td className="border p-2 text-center font-bold">{(p.quantite || 0).toLocaleString('fr-FR')}</td>
                              <td className="border p-2 text-center font-bold">{(p.pamp || 0).toLocaleString('fr-FR')} F<br/><span className="text-xs text-gray-500">{(p.pamp || 0).toLocaleString('fr-FR')} F</span></td>
                              <td className="border p-2 text-center font-bold text-emerald-600">{(p.valeurTotal || 0).toLocaleString('fr-FR')} F</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      {index === allChunks.length - 1 && (
                        <tfoot>
                          <tr className="bg-gray-100 font-bold">
                            <td colSpan={3} className="border-2 border-black p-2 text-right">VALORISATION TOTALE</td>
                            <td className="border-2 border-black p-2 text-center">—</td>
                            <td className="border-2 border-black p-2 text-center font-bold text-emerald-600">{totalValeur.toLocaleString('fr-FR')} F</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

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
                onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
          }}
                className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 focus:border-emerald-500 shadow-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Résumé Financier */}
          <div className="bg-emerald-900 text-white p-6 rounded-2xl shadow-lg flex flex-col justify-center gap-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
               <Coins className="h-24 w-24" />
            </div>
            <p className="text-emerald-300 text-xs font-bold uppercase tracking-widest">Valeur Totale du Stock</p>
            <p className="text-3xl font-black mb-1">{totalValeur.toLocaleString('fr-FR')} F</p>
            <div className="pt-2 border-t border-emerald-800 flex justify-between items-center text-sm">
               <span className="text-emerald-400">Total Articles :</span>
               <span className="font-bold">{totalQuantite.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : data.length === 0 ? (
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
                  {data.map((p) => (
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
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}
