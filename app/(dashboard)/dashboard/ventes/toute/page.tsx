'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  Loader2, 
  Filter, 
  ShoppingCart, 
  Tag, 
  Warehouse, 
  Printer, 
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  X
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import ModificationVenteModal from '@/components/dashboard/ventes/ModificationVenteModal'
import { paginateForPrint } from '@/lib/print-helpers'
import { getStatutPaiementLabel, getStatutPaiementColors } from '@/lib/enums-commerce'

interface VenteListe {
  id: number
  numero: string
  date: string
  client: string
  montantTotal: number
  montantPaye: number
  statutPaiement: string
  modePaiement: string
  vendeur: string
  magasin: string
  produits: string
}

export default function ToutesLesVentesPage() {
  const [data, setData] = useState<VenteListe[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { success: showSuccess, error: showError } = useToast()
  const [statutPaiement, setStatutPaiement] = useState('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPrintingData, setIsPrintingData] = useState(false)
  const [allVentesForPrint, setAllVentesForPrint] = useState<VenteListe[]>([])
  const [printType, setPrintType] = useState<'GLOBAL' | 'DETAIL' | null>(null)
  const [editingVenteId, setEditingVenteId] = useState<number | null>(null)
  const [supprimant, setSupprimant] = useState<number | null>(null)
  const [entreprise, setEntreprise] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('')
  
  const ITEMS_PER_PAGE_REPORT = 18

  useEffect(() => {
    fetch('/api/auth/check').then(r => r.ok && r.json()).then(d => d && setUserRole(d.role)).catch(() => {})
  }, [])

  useEffect(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)

    
    const start = thirtyDaysAgo.toISOString().split('T')[0]
    const end = now.toISOString().split('T')[0]
    setStartDate(start)
    setEndDate(end)
    fetchData(start, end)
    fetch('/api/parametres').then(r => r.ok && r.json()).then(d => { if (d) setEntreprise(d) }).catch(() => { })
  }, [])

  const fetchData = async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/rapports/ventes/liste?dateDebut=${start}&dateFin=${end}`)
      if (res.ok) {
        const result = await res.json()
        setData(Array.isArray(result) ? result : (result.data || []))
      } else {
        showError('Impossible de charger la liste des ventes.')
      }
    } catch (err) {
      console.error(err)
      showError('Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  const handleSupprimer = async (id: number, numero: string) => {
    if (!confirm(`Supprimer définitivement la vente ${numero} ? Cette action est irréversible et annulera les stocks et la comptabilité liée.`)) return
    setSupprimant(id)
    try {
      const res = await fetch(`/api/ventes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showSuccess('Vente supprimée avec succès.')
        fetchData(startDate, endDate)
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors de la suppression.')
      }
    } catch (err) {
      showError('Erreur de connexion.')
    } finally {
      setSupprimant(null)
    }
  }

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchData(startDate, endDate)
  }

  const handleOpenPreview = async (type: 'GLOBAL' | 'DETAIL') => {
    setIsPrintingData(true)
    setPrintType(type)
    try {
      setAllVentesForPrint(filteredData)
      setIsPreviewOpen(true)
    } catch (e) {
      console.error(e)
    } finally {
      setIsPrintingData(false)
    }
  }

  const filteredData = data.filter(v => {
    const searchLower = search.toLowerCase()
    const dateStr = v.date ? new Date(v.date).toLocaleDateString('fr-FR').toLowerCase() : ''
    const clientName = (v.client || '').toLowerCase()
    const produitsList = (v.produits || '').toLowerCase()
    const numeroVente = (v.numero || '').toLowerCase()
    
    const matchSearch = !search || 
      numeroVente.includes(searchLower) || 
      clientName.includes(searchLower) ||
      produitsList.includes(searchLower) ||
      dateStr.includes(searchLower)
    
    const matchStatut = !statutPaiement || (v.statutPaiement || '').toUpperCase() === statutPaiement.toUpperCase()
    
    return matchSearch && matchStatut
  })

  useEffect(() => {
    setPage(1)
  }, [search, statutPaiement])

  const now = new Date().toISOString().split('T')[0]
  const todaySales = data.filter(v => (v.date || '').split('T')[0] === now)
  const caDay = todaySales.reduce((acc, v) => acc + v.montantTotal, 0)
  const nbSalesDay = todaySales.length
  
  const caMonth = data.reduce((acc, v) => acc + v.montantTotal, 0)
  const nbSalesMonth = data.length
  const encaisseMonth = data.reduce((acc, v) => acc + v.montantPaye, 0)

  const itemsPerPage = 20
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const formatFcfa = (val: number) => val.toLocaleString('fr-FR') + ' F'

  const renderPrintChunks = (baseClass: string, lastClass = '') => {
    const chunks = paginateForPrint(allVentesForPrint, { firstPageSize: 18, otherPagesSize: ITEMS_PER_PAGE_REPORT })
    return chunks.map((chunk, index, allChunks) => (
      <div key={index} className={index < allChunks.length - 1 ? baseClass : lastClass}>
        <ListPrintWrapper
          title={printType === 'GLOBAL' ? 'Journal Global des Ventes' : 'Journal Détaillé des Ventes'}
          subtitle={`Rapport extrait du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`}
          pageNumber={index + 1}
          totalPages={allChunks.length}
          hideHeader={index > 0}
          hideVisa={index < allChunks.length - 1}
          kpis={[
            { label: 'C.A PÉRIODE', value: allVentesForPrint.reduce((acc, v) => acc + v.montantTotal, 0).toLocaleString() + ' F', color: 'text-orange-600' },
            { label: 'TOTAL ENCAISSÉ', value: allVentesForPrint.reduce((acc, v) => acc + v.montantPaye, 0).toLocaleString() + ' F', color: 'text-emerald-600' },
            { label: 'RESTE À RECOUVRER', value: (allVentesForPrint.reduce((acc, v) => acc + v.montantTotal, 0) - allVentesForPrint.reduce((acc, v) => acc + v.montantPaye, 0)).toLocaleString() + ' F', color: 'text-rose-600' },
            { label: 'NOMBRE DE VENTES', value: String(allVentesForPrint.length), color: 'text-blue-600' }
          ]}
        >
          <table className="w-full text-[14px] border-collapse border-2 border-black">
            <thead>
              <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                <th className="border-r-2 border-black px-3 py-3 text-left">Réf / Date</th>
                <th className="border-r-2 border-black px-3 py-3 text-left">Client / Magasin</th>
                <th className="border-r-2 border-black px-3 py-3 text-center">Paiement</th>
                <th className="border-r-2 border-black px-3 py-3 text-right">Montant Total</th>
                <th className="px-3 py-3 text-right">Encaissé</th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((v) => (
                <tr key={v.id} className="border-b border-black">
                  <td className="border-r-2 border-black px-3 py-2">
                    <span className="font-black text-slate-800">{v.numero}</span><br/>
                    <span className="text-xs italic font-bold text-gray-500">{new Date(v.date).toLocaleDateString('fr-FR')}</span>
                  </td>
                  <td className="border-r-2 border-black px-3 py-2 font-black uppercase italic">
                    {v.client}<br/>
                    <div className="font-bold text-[10px] text-gray-400 truncate max-w-[150px]">{v.magasin}</div>
                  </td>
                  <td className="border-r-2 border-black px-3 py-2 text-center text-[14px] uppercase font-bold">
                    <div className="text-[10px] font-black text-blue-800">{v.modePaiement}</div>
                    <span className={`text-[11px] font-black underline decoration-double ${getStatutPaiementColors(v.statutPaiement).text}`}>{getStatutPaiementLabel(v.statutPaiement)}</span>
                  </td>
                  <td className="border-r-2 border-black px-3 py-2 text-right font-black shadow-inner bg-gray-50/50">
                    {v.montantTotal.toLocaleString()} F
                  </td>
                  <td className="px-3 py-2 text-right font-black text-emerald-800 tabular-nums">
                    {v.montantPaye.toLocaleString()} F
                  </td>
                </tr>
              ))}
            </tbody>
            {index === allChunks.length - 1 && (
              <tfoot>
                <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                  <td colSpan={3} className="px-3 py-5 text-right tracking-[0.2em] underline decoration-double">AUDIT VOLUME NET PÉRIODE</td>
                  <td className="px-3 py-5 text-right bg-white ring-2 ring-black font-mono">
                    {allVentesForPrint.reduce((acc, v) => acc + v.montantTotal, 0).toLocaleString()} F
                  </td>
                  <td className="px-3 py-5 text-right text-emerald-800 bg-white shadow-inner font-mono">
                    {allVentesForPrint.reduce((acc, v) => acc + v.montantPaye, 0).toLocaleString()} F
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </ListPrintWrapper>
      </div>
    ))
  }

  const printInNewWindow = async (data: VenteListe[], type: 'GLOBAL' | 'DETAIL') => {
    if (!data.length) return

    const entite = await fetch('/api/parametres').then(r => r.ok ? r.json() : null).catch(() => null) || {}

    const chunks = paginateForPrint(data, { firstPageSize: 18, otherPagesSize: 20 })
    const periode = startDate || endDate
      ? `Période: ${startDate ? new Date(startDate).toLocaleDateString('fr-FR') : '...'} au ${endDate ? new Date(endDate).toLocaleDateString('fr-FR') : '...'}`
      : 'Toutes périodes'
    const totalMontant = data.reduce((s, v) => s + v.montantTotal, 0)
    const totalPaye = data.reduce((s, v) => s + v.montantPaye, 0)
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
            <div style="font-size:16px;font-weight:900;text-transform:uppercase;">${type === 'GLOBAL' ? 'Journal Global des Ventes' : 'Journal Détaillé des Ventes'}</div>
            <div style="font-size:12px;font-weight:700;color:#555;margin-top:2px;">${periode}</div>
            <div style="font-size:11px;font-weight:900;color:#888;margin-top:8px;">Date d'édition: ${today}</div>
            <div style="font-size:14px;font-weight:900;color:#d46c0a;margin-top:4px;">PAGE ${pageNum} / ${totalPages}</div>
          </div>
        </div>`
      }
      return `<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
        <div style="font-size:14px;font-weight:900;color:#d46c0a;">PAGE ${pageNum} / ${totalPages}</div>
      </div>`
    }

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${type === 'GLOBAL' ? 'Journal Global' : 'Journal Détaillé'} des Ventes</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #000; background: #fff; }
  .page { page-break-after: always; padding: 0; }
  .page:last-child { page-break-after: auto; }
  .kpis { display: flex; gap: 8px; margin-bottom: 8px; }
  .kpi { flex: 1; border: 2px solid #000; background: #f5f5f5; padding: 6px 10px; font-size: 13px; font-weight: 900; text-align: center; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #eee; border: 2px solid #000; padding: 6px 4px; font-size: 13px; font-weight: 900; text-align: left; }
  th.right { text-align: right; }
  th.center { text-align: center; }
  td { border: 1px solid #000; padding: 4px; font-size: 13px; }
  td.right { text-align: right; font-weight: 700; }
  td.center { text-align: center; }
  tfoot td { background: #e0e0e0; font-weight: 900; font-size: 14px; }
  .total-label { text-align: right; padding-right: 8px; }
</style></head><body>`

    chunks.forEach((chunk, index, allChunks) => {
      html += `<div class="page">`
      html += headerHtml(index === 0, index + 1, allChunks.length)
      html += `<div class="kpis">
        <div class="kpi">CA: ${totalMontant.toLocaleString('fr-FR')} F</div>
        <div class="kpi">ENCAISSE: ${totalPaye.toLocaleString('fr-FR')} F</div>
        <div class="kpi">RESTE: ${(totalMontant - totalPaye).toLocaleString('fr-FR')} F</div>
        <div class="kpi">NB VENTES: ${data.length}</div>
      </div>`
      html += `<table>
        <thead><tr>
          <th style="width:14%">REF / DATE</th>
          <th style="width:22%">CLIENT / MAGASIN</th>
          <th style="width:22%" class="center">PAIEMENT</th>
          <th style="width:21%" class="right">MONTANT TOTAL</th>
          <th style="width:21%" class="right">ENCAISSE</th>
        </tr></thead><tbody>`
      chunk.forEach((v) => {
        html += `<tr>
          <td><b>${v.numero}</b><br/><span style="font-size:11px;color:#888;">${new Date(v.date).toLocaleDateString('fr-FR')}</span></td>
          <td><b>${v.client}</b><br/><span style="font-size:11px;color:#888;">${v.magasin}</span></td>
          <td class="center">${v.modePaiement}<br/><span style="font-size:11px;font-weight:700;color:#555;">${getStatutPaiementLabel(v.statutPaiement)}</span></td>
          <td class="right">${v.montantTotal.toLocaleString('fr-FR')} F</td>
          <td class="right" style="color:#059669;">${v.montantPaye.toLocaleString('fr-FR')} F</td>
        </tr>`
      })
      if (index === allChunks.length - 1) {
        html += `<tfoot><tr>
          <td colspan="3" class="total-label">TOTAUX</td>
          <td class="right">${totalMontant.toLocaleString('fr-FR')} F</td>
          <td class="right" style="color:#059669;">${totalPaye.toLocaleString('fr-FR')} F</td>
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
    <div className="pb-12">
      {/* VUE ÉCRAN */}
      <div className="print:hidden space-y-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-orange-700 p-8 shadow-2xl">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl opacity-50" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">Toutes les Ventes</h1>
              <p className="mt-2 text-white/90 font-medium max-w-2xl">
                Console analytique globale. Suivez vos performances en temps réel.
              </p>
            </div>
            <div className="flex gap-3 no-print">
               <button 
                onClick={() => handleOpenPreview('GLOBAL')}
                className="flex items-center gap-2 rounded-xl bg-orange-600 border-2 border-orange-400 px-6 py-3 text-sm font-black text-white hover:bg-orange-700 transition-all uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50"
                disabled={isPrintingData}
              >
                {isPrintingData && printType === 'GLOBAL' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                JOURNAL GLOBAL
              </button>
              <button 
                onClick={() => handleOpenPreview('DETAIL')}
                className="flex items-center gap-2 rounded-xl bg-gray-900 border-2 border-gray-700 px-6 py-3 text-sm font-black text-white hover:bg-black transition-all uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50"
                disabled={isPrintingData}
              >
                {isPrintingData && printType === 'DETAIL' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                JOURNAL DÉTAILLÉ
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="space-y-2">
          <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] ml-6">Analyse de Compteur : 1 / 4</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "C.A PÉRIODE", val: formatFcfa(caMonth), sub: `${nbSalesMonth} ventes sur la période`, icon: ShoppingCart, color: "bg-orange-600" },
              { label: "TOTAL ENCAISSÉ", val: formatFcfa(encaisseMonth), sub: "Règlements reçus", icon: CheckCircle2, color: "bg-blue-600" },
              { label: "RESTE À RECOUVRER", val: formatFcfa(caMonth - encaisseMonth), sub: "Impayés", icon: Clock, color: "bg-rose-600" },
              { label: "NOMBRE DE VENTES", val: String(nbSalesMonth), sub: "Volume de la période", icon: Tag, color: "bg-indigo-600" },
            ].map((c, i) => (
              <div key={i} className={`relative overflow-hidden rounded-[2rem] ${c.color} p-6 h-32 shadow-xl hover:scale-[1.02] transition-transform group`}>
                 <div className="relative z-10 text-white flex flex-col justify-between h-full">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{c.label}</p>
                    <div>
                      <h3 className="text-2xl font-black tracking-tighter">{c.val}</h3>
                      <p className="text-[9px] font-bold opacity-60 uppercase">{c.sub}</p>
                    </div>
                 </div>
                 <c.icon className="absolute right-4 bottom-4 h-12 w-12 text-white opacity-10 group-hover:scale-110 transition-transform" />
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-[2rem] bg-white p-6 shadow-xl border border-gray-100 flex flex-col md:flex-row gap-6 items-end">
          <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4 flex-1">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Du</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-40 rounded-xl border-gray-200 bg-gray-50 text-gray-900 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Au</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-40 rounded-xl border-gray-200 bg-gray-50 text-gray-900 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>
            <button type="submit" className="rounded-xl bg-gray-900 px-8 py-2.5 text-sm font-black text-white hover:bg-black transition-all shadow-lg uppercase tracking-widest flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtrer
            </button>
          </form>

          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Référence, client, produit, date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-sm font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
            />
          </div>
          <div>
            <select
              value={statutPaiement}
              onChange={(e) => setStatutPaiement(e.target.value)}
              className="rounded-2xl border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
            >
              <option value="">Tous les statuts</option>
              <option value="PAYE">Payé</option>
              <option value="PARTIEL">Partiel</option>
              <option value="CREDIT">Crédit</option>
              <option value="REMBOURSE">Remboursé</option>
              <option value="ANNULEE">Annulée</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-2xl border border-gray-100">
          <div className="bg-gray-50/50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic flex items-center gap-3">
                <Clock className="h-5 w-5 text-orange-500" />
                Journal détaillé des transactions
              </h2>
              <div className="flex gap-2">
                 <span className="bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {filteredData.length} Opérations
                 </span>
              </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
              <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
              <p className="text-xs font-black uppercase tracking-widest italic text-gray-500">Chargement des données...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-20">
               <ShoppingCart className="h-16 w-16" />
               <p className="text-sm font-black uppercase tracking-widest italic">Aucun mouvement trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-left">
                    <th className="px-8 py-5">Référence / Date</th>
                    <th className="px-8 py-5">Client / Magasin</th>
                    <th className="px-8 py-5 text-center">Règlement</th>
                    <th className="px-8 py-5 text-right">C.A Total</th>
                    <th className="px-8 py-5 text-right">Encaissé</th>
                    <th className="px-8 py-5 text-right">Dette</th>
                    <th className="px-8 py-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedData.map((v) => (
                    <tr key={v.id} className="group hover:bg-orange-50/30 transition-colors">
                      <td className="px-8 py-6">
                         <p className="font-mono text-xs font-black text-orange-600">{v.numero}</p>
                         <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">
                            {new Date(v.date).toLocaleDateString('fr-FR', {day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                         </p>
                      </td>
                      <td className="px-8 py-6">
                         <p className="text-sm font-black text-gray-800 uppercase tracking-tighter">{v.client}</p>
                         <p className="text-[9px] font-bold text-gray-400 flex items-center gap-1 mt-0.5 uppercase">
                            <Warehouse className="h-3 w-3" /> {v.magasin}
                         </p>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex flex-col items-center gap-2">
                            <span className="bg-gray-100 px-3 py-1 rounded-lg text-[9px] font-black text-gray-600 uppercase tracking-widest">
                               {v.modePaiement}
                            </span>
                             <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatutPaiementColors(v.statutPaiement).bg} ${getStatutPaiementColors(v.statutPaiement).text}`}>
                                {getStatutPaiementLabel(v.statutPaiement)}
                            </span>
                         </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <p className="text-sm font-black text-gray-900 tracking-tighter">{formatFcfa(v.montantTotal)}</p>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <p className="text-sm font-black text-emerald-600 tracking-tighter">{formatFcfa(v.montantPaye)}</p>
                      </td>
                        <td className="px-8 py-6 text-right">
                          <p className={`text-sm font-black tracking-tighter ${v.montantTotal - v.montantPaye > 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                             {formatFcfa(v.montantTotal - v.montantPaye)}
                          </p>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-center gap-2">
                            {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                              <button
                                onClick={() => setEditingVenteId(v.id)}
                                className="rounded-xl border border-gray-200 bg-white p-2.5 text-orange-600 hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                                title="Modifier"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                              <button
                                onClick={() => handleSupprimer(v.id, v.numero)}
                                disabled={supprimant === v.id}
                                className="rounded-xl border border-gray-200 bg-white p-2.5 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm disabled:opacity-50"
                                title="Supprimer"
                              >
                                {supprimant === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="bg-gray-50/50 px-8 py-6 border-t border-gray-100">
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
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white no-print">
          <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-100">
            <div className="flex items-center gap-6">
              <h2 className="text-lg font-black uppercase tracking-tight">Journal des Ventes</h2>
              <span className="rounded-full bg-orange-100 px-4 py-1.5 text-xs font-black text-orange-700 uppercase">
                {printType === 'GLOBAL' ? 'Journal Simplifié' : 'Journal Détaillé'} — {allVentesForPrint.length} Opérations
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => { setIsPreviewOpen(false); await printInNewWindow(allVentesForPrint, printType || 'GLOBAL') }}
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
            <div className="mx-auto max-w-[210mm] bg-white">
              {renderPrintChunks('page-break border-b-2 border-dashed border-gray-100 mb-8 pb-8', '')}
            </div>
          </div>
        </div>
      )}

      <ModificationVenteModal
        isOpen={editingVenteId !== null}
        onClose={() => setEditingVenteId(null)}
        venteId={editingVenteId || 0}
        onSuccess={() => fetchData(startDate, endDate)}
      />

    </div>
  )
}