'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, Filter, Wallet, FileText, ShoppingBag, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import { paginateForPrint } from '@/lib/print-helpers'

interface SoldeFournisseur {
  id: number
  code: string | null
  nom: string
  telephone: string | null
  localisation: string | null
  achats: number
  paiements: number
  variationPeriode: number
  soldeGlobal: number
  derniereFacture: string | null
}

export default function SoldesFournisseursPage() {
  const router = useRouter()
  const [data, setData] = useState<SoldeFournisseur[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const { error: showError } = useToast()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [printData, setPrintData] = useState<SoldeFournisseur[]>([])

  useEffect(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    setStartDate(start)
    setEndDate(end)
    fetchData(start, end)

  }, [])

  const fetchData = async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fournisseurs/soldes?dateDebut=${start}&dateFin=${end}`)
      if (res.ok) {
        const d = await res.json()
        setData(d.fournisseurs || [])
      } else {
        showError('Impossible de charger les soldes fournisseurs.')
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
    fetchData(startDate, endDate)
  }

  const openPrintPreview = () => {
    setPrintData(filteredData)
    setIsPreviewOpen(true)
  }

  const printInNewWindow = async (data: SoldeFournisseur[]) => {
    if (!data.length) return
    const entite = await fetch('/api/parametres').then(r => r.ok ? r.json() : null).catch(() => null) || {}
    const chunks = paginateForPrint(data, { firstPageSize: 8, otherPagesSize: 14 })
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const totalAchats = data.reduce((s, f) => s + f.achats, 0)
    const totalPaiements = data.reduce((s, f) => s + f.paiements, 0)
    const totalSolde = data.reduce((s, f) => s + f.soldeGlobal, 0)

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
            <div style="font-size:16px;font-weight:900;text-transform:uppercase;">État Synthétique des Soldes Fournisseurs</div>
            <div style="font-size:12px;font-weight:700;color:#555;margin-top:2px;">${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}</div>
            <div style="font-size:11px;font-weight:900;color:#888;margin-top:8px;">Édition: ${today}</div>
            <div style="font-size:14px;font-weight:900;color:#d46c0a;margin-top:4px;">PAGE ${pageNum} / ${totalPages}</div>
          </div>
        </div>`
      }
      return `<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
        <div style="font-size:14px;font-weight:900;color:#d46c0a;">PAGE ${pageNum} / ${totalPages}</div>
      </div>`
    }

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Soldes Fournisseurs</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; }
  .page { page-break-after: always; padding: 0; }
  .page:last-child { page-break-after: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #eee; border: 2px solid #000; padding: 6px 4px; font-size: 12px; font-weight: 900; text-align: center; }
  td { border: 1px solid #000; padding: 4px; font-size: 12px; text-align: center; }
  td.left { text-align: left; }
  tfoot td { background: #e0e0e0; font-weight: 900; font-size: 13px; }
</style></head><body>`

    chunks.forEach((chunk, index, allChunks) => {
      html += `<div class="page">`
      html += headerHtml(index === 0, index + 1, allChunks.length)
      html += `<table>
        <thead><tr>
          <th style="width:6%">N°</th>
          <th style="width:24%" class="left">NOM DU<br/>FOURNISSEUR</th>
          <th style="width:22%">DETTE TOTALE /<br/>PAYÉ</th>
          <th style="width:22%">RESTE /<br/>VARIATION</th>
          <th style="width:16%">SOLDE NET<br/>GLOBAL</th>
        </tr></thead><tbody>`
      chunk.forEach((f, idx) => {
        const globalNum = allChunks.slice(0, index).reduce((s, a) => s + a.length, 0) + idx + 1
        const reste = f.achats - f.paiements
        html += `<tr>
          <td style="font-weight:900;">${globalNum}</td>
          <td class="left"><b>${f.nom}</b><br/><span style="font-size:11px;color:#555;font-family:monospace;">${f.code || '—'}</span></td>
          <td><span style="font-weight:900;">${f.achats.toLocaleString('fr-FR')} F</span><br/><span style="font-size:11px;color:#059669;">${f.paiements.toLocaleString('fr-FR')} F</span></td>
          <td><span style="font-weight:900;${reste > 0 ? 'color:#dc2626;' : 'color:#059669;'}">${reste.toLocaleString('fr-FR')} F</span><br/><span style="font-size:11px;color:#d97706;">${f.variationPeriode >= 0 ? '+' : ''}${f.variationPeriode.toLocaleString('fr-FR')} F</span></td>
          <td style="font-weight:900;font-size:14px;${f.soldeGlobal > 0 ? 'color:#dc2626;' : 'color:#059669;'}">${f.soldeGlobal.toLocaleString('fr-FR')} F</td>
        </tr>`
      })
      if (index === allChunks.length - 1) {
        const totalReste = totalAchats - totalPaiements
        html += `<tfoot><tr>
          <td colspan="2" style="text-align:right;padding-right:8px;font-weight:900;text-transform:uppercase;">TOTAUX DES ENCOURS FOURNISSEURS</td>
          <td style="font-weight:900;">${totalAchats.toLocaleString('fr-FR')} F<br/><span style="color:#059669;font-size:11px;">${totalPaiements.toLocaleString('fr-FR')} F</span></td>
          <td style="font-weight:900;">${totalReste.toLocaleString('fr-FR')} F<br/><span style="font-size:11px;color:#d97706;">${data.reduce((s, f) => s + f.variationPeriode, 0).toLocaleString('fr-FR')} F</span></td>
          <td style="font-weight:900;font-size:15px;">${totalSolde.toLocaleString('fr-FR')} F</td>
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
  }

  const filteredData = data.filter(f => 
    f.nom.toLowerCase().includes(search.toLowerCase()) || 
    (f.code && f.code.toLowerCase().includes(search.toLowerCase())) ||
    (f.localisation && f.localisation.toLowerCase().includes(search.toLowerCase()))
  )

  const totals = filteredData.reduce((acc, f) => ({
    achats: acc.achats + f.achats,
    paiements: acc.paiements + f.paiements,
    variationPeriode: acc.variationPeriode + f.variationPeriode,
    soldeGlobal: acc.soldeGlobal + f.soldeGlobal
  }), { achats: 0, paiements: 0, variationPeriode: 0, soldeGlobal: 0 })

  const paginatedData = Array.isArray(filteredData) ? filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : []
  const totalPages = Math.ceil((Array.isArray(filteredData) ? filteredData.length : 0) / itemsPerPage)

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Soldes Fournisseurs</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest italic">Synthèse de nos dettes et paiements par fournisseur</p>
        </div>
        <button 
          onClick={openPrintPreview}
          disabled={loading || filteredData.length === 0}
          className="flex items-center gap-2 rounded-xl border-2 border-orange-500 bg-orange-600 px-6 py-3 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 disabled:opacity-50 no-print uppercase tracking-widest"
        >
          <Printer className="h-5 w-5" /> 
          IMPRIMER
        </button>
      </div>

      {/* Cartes de Totaux */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 no-print">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-500 p-2 text-white">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Achats (Période)</p>
              <p className="text-xl font-bold text-gray-900">{totals.achats.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500 p-2 text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Payé (Période)</p>
              <p className="text-xl font-bold text-gray-900">{totals.paiements.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500 p-2 text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Variation Dette</p>
              <p className="text-xl font-bold text-gray-900">{totals.variationPeriode.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${totals.soldeGlobal > 0 ? 'border-red-100 bg-red-50/50' : 'border-blue-100 bg-blue-50/50'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 text-white ${totals.soldeGlobal > 0 ? 'bg-red-500' : 'bg-blue-500'}`}>
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-xs font-medium uppercase tracking-wider ${totals.soldeGlobal > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                Dette Totale Net
              </p>
              <p className="text-xl font-bold text-gray-900">{totals.soldeGlobal.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="flex flex-col md:flex-row gap-3 no-print">
        <form onSubmit={handleFilter} className="flex flex-wrap gap-2 items-end bg-white p-3 rounded-lg border border-gray-200 shadow-sm w-full md:w-auto">
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-1">Du</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-1">Au</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>
          <button type="submit" className="bg-orange-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-orange-700 flex items-center gap-2 h-[34px] transition-all active:scale-95">
            <Filter className="h-4 w-4" /> Filtrer
          </button>
        </form>

        <div className="flex-1 flex items-end">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, code ou localisation..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-lg border border-gray-200 py-1.5 pl-10 pr-4 mt-auto text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 focus:outline-none bg-white shadow-sm transition-all h-[34px]"
            />
          </div>
        </div>
      </div>

      {/* TABLEAU POUR L'ÉCRAN (Interactivité) */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl no-print">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-20 text-center">
            <Search className="mx-auto h-12 w-12 text-gray-200 mb-4" />
            <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Aucun résultat trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/50 uppercase text-[10px] font-black tracking-widest text-gray-400">
                  <th className="px-6 py-4 text-left">Fournisseur</th>
                  <th className="px-6 py-4 text-right">Achats (Période)</th>
                  <th className="px-6 py-4 text-right">Payé (Période)</th>
                  <th className="px-6 py-4 text-right">Variation</th>
                  <th className="px-6 py-4 text-right bg-orange-50/30 text-orange-900 border-x border-orange-100 italic">Solde Global</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedData.map((f, i) => (
                  <tr key={i} className="group hover:bg-orange-50/10 transition-colors">
<td className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-orange-50 transition-colors" onClick={() => router.push(`/dashboard/fournisseurs/soldes/${f.id}`)}>
                        <div className="font-black text-gray-900 uppercase text-sm tracking-tighter">{f.nom}</div>
                        <div className="text-[10px] text-gray-400 font-mono">#{f.code || '---'}</div>
                      </td>
                    <td className="px-6 py-4 text-right tabular-nums text-sm font-medium text-indigo-600">
                      {f.achats.toLocaleString()} F
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-sm font-bold text-emerald-600 italic">
                      {f.paiements.toLocaleString()} F
                    </td>
                    <td className={`px-6 py-4 text-right tabular-nums text-sm font-black ${f.variationPeriode >= 0 ? 'text-amber-600' : 'text-emerald-500'}`}>
                      {f.variationPeriode >= 0 ? '+' : ''}{f.variationPeriode.toLocaleString()} F
                    </td>
                    <td className={`px-6 py-4 text-right tabular-nums text-lg font-black bg-orange-50/10 border-x border-orange-50/50 ${f.soldeGlobal > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {f.soldeGlobal.toLocaleString()} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="border-t border-gray-100 p-4 bg-gray-50/50">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredData.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
            <div className="flex items-center gap-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase italic">Aperçu — Soldes Fournisseurs</h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  {printData.length} fournisseur(s) — {new Date(startDate).toLocaleDateString('fr-FR')} au {new Date(endDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase tracking-widest"
              >
                Fermer
              </button>
              <button
                onClick={async () => { setIsPreviewOpen(false); await printInNewWindow(printData) }}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-10 py-2 text-sm font-black text-white hover:bg-violet-700 shadow-xl transition-all active:scale-95 uppercase tracking-widest"
              >
                <Printer className="h-4 w-4" />
                Lancer l'impression
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-8">
            <div className="mx-auto bg-white shadow-2xl rounded-xl overflow-hidden" style={{ maxWidth: '1000px' }}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-[11px] font-black text-gray-600 uppercase tracking-wider">
                    <th className="p-4 text-center w-16">N°</th>
                    <th className="p-4 text-left">NOM DU<br/>FOURNISSEUR</th>
                    <th className="p-4 text-center">DETTE TOTALE /<br/>PAYÉ</th>
                    <th className="p-4 text-center">RESTE /<br/>VARIATION</th>
                    <th className="p-4 text-center">SOLDE NET<br/>GLOBAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {printData.map((f, i) => {
                    const reste = f.achats - f.paiements
                    return (
                      <tr key={f.id} className="hover:bg-violet-50/30 transition-colors">
                        <td className="p-4 text-center font-black text-gray-700">{i + 1}</td>
                        <td className="p-4 text-left">
                          <span className="font-bold text-gray-900">{f.nom}</span>
                          <br/><span className="text-[11px] font-mono text-gray-500">{f.code || '—'}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-black text-gray-800">{f.achats.toLocaleString('fr-FR')} F</span>
                          <br/><span className="text-[11px] font-bold text-emerald-600">{f.paiements.toLocaleString('fr-FR')} F</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`font-black text-sm ${reste > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{reste.toLocaleString('fr-FR')} F</span>
                          <br/><span className="text-[11px] font-bold text-amber-600">{f.variationPeriode >= 0 ? '+' : ''}{f.variationPeriode.toLocaleString('fr-FR')} F</span>
                        </td>
                        <td className={`p-4 text-center font-black text-sm ${f.soldeGlobal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {f.soldeGlobal.toLocaleString('fr-FR')} F
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-black text-sm border-t-2 border-gray-300">
                    <td colSpan={2} className="p-4 text-right uppercase tracking-wider italic">
                      Totaux des encours fournisseurs
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-gray-800">{printData.reduce((s, f) => s + f.achats, 0).toLocaleString('fr-FR')} F</span>
                      <br/><span className="text-[11px] text-emerald-600">{printData.reduce((s, f) => s + f.paiements, 0).toLocaleString('fr-FR')} F</span>
                    </td>
                    <td className="p-4 text-center">
                      <span>{printData.reduce((s, f) => s + (f.achats - f.paiements), 0).toLocaleString('fr-FR')} F</span>
                      <br/><span className="text-[11px] text-amber-600">{printData.reduce((s, f) => s + f.variationPeriode, 0) >= 0 ? '+' : ''}{printData.reduce((s, f) => s + f.variationPeriode, 0).toLocaleString('fr-FR')} F</span>
                    </td>
                    <td className="p-4 text-center text-base">
                      {printData.reduce((s, f) => s + f.soldeGlobal, 0).toLocaleString('fr-FR')} F
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
