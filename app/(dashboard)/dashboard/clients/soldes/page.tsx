'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, Filter, Wallet, FileText, Landmark, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import { paginateForPrint } from '@/lib/print-helpers'

interface SoldeClient {
  id: number
  code: string | null
  nom: string
  telephone: string | null
  ncc: string | null
  localisation: string | null
  factures: number
  paiements: number
  soldeInitial: number
  variationPeriode: number
  soldeClient: number
  statut: 'DOIT' | 'SOLDE' | 'CREDIT'
  derniereFacture: string | null
  derniereBon: string | null
}

export default function SoldesClientsPage() {
  const router = useRouter()
  const [data, setData] = useState<SoldeClient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const { error: showError } = useToast()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [printData, setPrintData] = useState<SoldeClient[]>([])

  useEffect(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)
    const start = thirtyDaysAgo.toISOString().split('T')[0]
    const end = now.toISOString().split('T')[0]
    setStartDate(start)
    setEndDate(end)
    fetchData(start, end)

  }, [])

  const fetchData = async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/soldes?dateDebut=${start}&dateFin=${end}`)
      if (res.ok) {
        const d = await res.json()
        if (Array.isArray(d)) {
          setData(d)
        } else if (d?.clients) {
          setData(d.clients)
        } else {
          setData([])
        }
      } else {
        showError('Impossible de charger les soldes.')
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
    fetchData(startDate, endDate)
  }

  const openPrintPreview = () => {
    setPrintData(filteredData)
    setIsPreviewOpen(true)
  }

  const printInNewWindow = async (data: SoldeClient[]) => {
    if (!data.length) return
    const entite = await fetch('/api/parametres').then(r => r.ok ? r.json() : null).catch(() => null) || {}
    const chunks = paginateForPrint(data, { firstPageSize: 8, otherPagesSize: 14 })
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const totalFactures = data.reduce((s, c) => s + c.factures, 0)
    const totalPaiements = data.reduce((s, c) => s + c.paiements, 0)
    const totalSolde = data.reduce((s, c) => s + c.soldeClient, 0)

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
            <div style="font-size:16px;font-weight:900;text-transform:uppercase;">État Synthétique des Soldes Clients</div>
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

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Soldes Clients</title>
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
          <th style="width:24%" class="left">PARTENAIRE /<br/>IDENTIFIANT</th>
          <th style="width:16%">LOCALISATION</th>
          <th style="width:22%">FACTURATION /<br/>RÈGLEMENTS</th>
          <th style="width:20%">SOLDE GLOBAL NET /<br/>ÉTAT</th>
        </tr></thead><tbody>`
      chunk.forEach((c, idx) => {
        html += `<tr>
          <td class="left"><b>${c.nom}</b><br/><span style="font-size:11px;color:#555;font-family:monospace;">${c.code || '—'}</span></td>
          <td>${(c.localisation && c.localisation !== 'null') ? c.localisation : '—'}</td>
          <td><span style="font-weight:900;">${c.factures.toLocaleString('fr-FR')} F</span><br/><span style="font-size:11px;color:#059669;">${c.paiements.toLocaleString('fr-FR')} F</span></td>
          <td style="font-weight:900;${c.statut === 'DOIT' ? 'color:#dc2626;' : c.statut === 'CREDIT' ? 'color:#2563eb;' : 'color:#059669;'}">${c.soldeClient.toLocaleString('fr-FR')} F<br/><span style="font-size:10px;font-weight:900;text-transform:uppercase;">${c.statut === 'DOIT' ? 'DOIT' : c.statut === 'CREDIT' ? 'AVOIR' : 'SOLDÉ'}</span></td>
        </tr>`
      })
      if (index === allChunks.length - 1) {
        html += `<tfoot><tr>
          <td style="text-align:right;padding-right:8px;font-weight:900;text-transform:uppercase;">TOTAUX DES ENCOURS CLIENTS</td>
          <td></td>
          <td style="font-weight:900;">F: ${totalFactures.toLocaleString('fr-FR')}<br/><span style="color:#059669;">R: ${totalPaiements.toLocaleString('fr-FR')} F</span></td>
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

  const filteredData = Array.isArray(data) ? data.filter(c => 
    c.nom.toLowerCase().includes(search.toLowerCase()) || 
    (c.code && c.code.toLowerCase().includes(search.toLowerCase())) ||
    (c.localisation && c.localisation.toLowerCase().includes(search.toLowerCase()))
  ) : []

  const totals = filteredData.reduce((acc, c) => ({
    factures: acc.factures + c.factures,
    paiements: acc.paiements + c.paiements,
    variationPeriode: acc.variationPeriode + c.variationPeriode,
    soldeClient: acc.soldeClient + c.soldeClient
  }), { factures: 0, paiements: 0, variationPeriode: 0, soldeClient: 0 })

  const paginatedData = Array.isArray(filteredData) ? filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : []
  const totalPages = Math.ceil((Array.isArray(filteredData) ? filteredData.length : 0) / itemsPerPage)

  return (
    <div className="space-y-6">



      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
             <Landmark className="h-8 w-8" />
             Soldes & Créances
          </h1>
          <p className="mt-1 text-white/90 font-medium italic">Tableau de bord de la solvabilité clients et suivi des encours</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={openPrintPreview}
            disabled={loading || filteredData.length === 0}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-black text-white hover:bg-orange-700 shadow-lg shadow-orange-900/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Printer className="h-5 w-5" /> 
            Imprimer
          </button>
        </div>
      </div>

      {/* Cartes de Totaux (Analyse de Compteur) */}
      <div className="space-y-2 no-print">
        <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] ml-6 italic">Analyse des flux financiers tiers</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Facturé", val: totals.factures.toLocaleString('fr-FR') + ' F', icon: FileText, color: "from-blue-600 to-indigo-700", sub: "Volume général" },
            { label: "Total Payé", val: totals.paiements.toLocaleString('fr-FR') + ' F', icon: Wallet, color: "from-emerald-600 to-teal-700", sub: "Recouvrements" },
            { label: "Variation Période", val: totals.variationPeriode.toLocaleString('fr-FR') + ' F', icon: Landmark, color: "from-indigo-500 to-purple-600", sub: "Flux période" },
            { 
              label: "Net à Recouvrer", 
              val: totals.soldeClient.toLocaleString('fr-FR') + ' F', 
              icon: Filter, 
              color: totals.soldeClient > 0 ? "from-orange-500 to-rose-600" : "from-emerald-500 to-teal-600",
              sub: totals.soldeClient > 0 ? "Créances clients" : "Avoirs clients"
            },
          ].map((c, i) => (
            <div key={i} className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${c.color} p-6 h-36 shadow-2xl transition-all border border-white/10 group`}>
               <div className="relative z-10 text-white flex flex-col justify-between h-full">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                    <c.icon className="h-4 w-4" />
                    {c.label}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter italic">{c.val}</h3>
                    <p className="text-[9px] font-bold opacity-60 uppercase">{c.sub}</p>
                  </div>
               </div>
               <c.icon className="absolute right-[-10px] bottom-[-10px] h-20 w-20 text-white opacity-10 group-hover:scale-110 transition-transform" />
            </div>
          ))}
        </div>
      </div>

      {/* Barre de recherche & Filtres */}
      <div className="flex flex-wrap items-center gap-4 rounded-[2rem] bg-slate-800/50 border border-slate-700 p-4 backdrop-blur-sm shadow-xl no-print">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher un client (nom, code, localisation)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-2xl border-2 border-slate-700 bg-slate-900/50 py-3 pl-12 pr-4 text-sm font-bold text-white placeholder:text-slate-600 focus:border-orange-500 focus:outline-none transition-all"
          />
        </div>
        
        <form onSubmit={handleFilter} className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-1">Dès le</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border-2 border-slate-700 bg-slate-900/50 px-3 py-2 text-sm font-bold text-white focus:border-orange-500 focus:outline-none transition-all"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-1">jusqu'au</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border-2 border-slate-700 bg-slate-900/50 px-3 py-2 text-sm font-bold text-white focus:border-orange-500 focus:outline-none transition-all"
            />
          </div>
          <button type="submit" className="mt-4 flex items-center gap-2 rounded-xl bg-slate-700 px-6 py-2.5 text-sm font-black text-white hover:bg-slate-600 transition-all shadow-lg active:scale-95">
            <Filter className="h-4 w-4" /> FILTRER
          </button>
        </form>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm no-print">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : filteredData.length === 0 ? (
          <p className="py-12 text-center text-gray-500 italic">Aucun client trouvé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dernière Opération</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Partenaire / Identifiant</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Localisation</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Facturation</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Règlements</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 bg-orange-50/50">Variation</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 bg-slate-100">Solde Global Net</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedData.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-all group">
                    <td className="px-6 py-4 text-sm font-black text-orange-600 italic">
                      {c.derniereFacture || '—'}
                      {c.derniereBon && (
                        <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                          <FileText className="h-3 w-3" /> BON: {c.derniereBon}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 cursor-pointer" onClick={() => router.push(`/dashboard/clients/soldes/${c.id}`)}>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{c.code || 'SANS CODE'}</span>
                        <span className="text-sm font-bold text-slate-900 group-hover:text-orange-600 transition-colors uppercase italic">{c.nom}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500 italic uppercase">
                      {c.localisation && c.localisation !== 'null' ? c.localisation : '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-black text-slate-700">
                      {c.factures.toLocaleString('fr-FR')} F
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-black text-emerald-600">
                      {c.paiements.toLocaleString('fr-FR')} F
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-black text-orange-500 bg-orange-50/30">
                      {c.variationPeriode >= 0 ? '+' : ''}{c.variationPeriode.toLocaleString('fr-FR')} F
                    </td>
                    <td 
                      className={`whitespace-nowrap px-6 py-4 text-right text-base font-black italic tabular-nums bg-slate-50/50 ${c.statut === 'DOIT' ? 'text-rose-600' : c.statut === 'CREDIT' ? 'text-blue-600' : 'text-emerald-700'}`}
                    >
                      {c.soldeClient.toLocaleString('fr-FR')} F
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black tracking-widest uppercase ${
                        c.statut === 'DOIT' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                        c.statut === 'CREDIT' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                        'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${c.statut === 'DOIT' ? 'bg-rose-500' : c.statut === 'CREDIT' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                        {c.statut === 'DOIT' ? 'DOIT' : c.statut === 'CREDIT' ? 'AVOIR' : 'SOLDÉ'}
                      </span>
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

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
            <div className="flex items-center gap-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase italic">Aperçu — Soldes Clients</h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  {printData.length} client(s) — {new Date(startDate).toLocaleDateString('fr-FR')} au {new Date(endDate).toLocaleDateString('fr-FR')}
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
            <div className="mx-auto bg-white shadow-2xl rounded-xl overflow-hidden" style={{ maxWidth: '1100px' }}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-[11px] font-black text-gray-600 uppercase tracking-wider">
                    <th className="p-4 text-left w-[300px]">PARTENAIRE /<br/>IDENTIFIANT</th>
                    <th className="p-4 text-center">LOCALISATION</th>
                    <th className="p-4 text-center">FACTURATION /<br/>RÈGLEMENTS</th>
                    <th className="p-4 text-center">SOLDE GLOBAL NET /<br/>ÉTAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {printData.map((c, i) => (
                    <tr key={c.id} className="hover:bg-violet-50/30 transition-colors">
                      <td className="p-4 text-left">
                        <span className="font-bold text-gray-900">{c.nom}</span>
                        <br/><span className="text-[11px] font-mono text-gray-500">{c.code || '—'}</span>
                      </td>
                      <td className="p-4 text-center text-gray-700">
                        {(c.localisation && c.localisation !== 'null') ? c.localisation : '—'}
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-black text-gray-800">{c.factures.toLocaleString('fr-FR')} F</span>
                        <br/><span className="text-[11px] font-bold text-emerald-600">{c.paiements.toLocaleString('fr-FR')} F</span>
                      </td>
                      <td className={`p-4 text-center font-black text-sm ${c.statut === 'DOIT' ? 'text-rose-600' : c.statut === 'CREDIT' ? 'text-blue-600' : 'text-emerald-600'}`}>
                        {c.soldeClient.toLocaleString('fr-FR')} F
                        <br/><span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[9px] font-black tracking-widest uppercase ${c.statut === 'DOIT' ? 'bg-rose-100 text-rose-700' : c.statut === 'CREDIT' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {c.statut === 'DOIT' ? 'DOIT' : c.statut === 'CREDIT' ? 'AVOIR' : 'SOLDÉ'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-black text-sm border-t-2 border-gray-300">
                    <td className="p-4 text-right uppercase tracking-wider italic">
                      Totaux des encours clients
                    </td>
                    <td></td>
                    <td className="p-4 text-center">
                      <span className="text-gray-800">{printData.reduce((s, c) => s + c.factures, 0).toLocaleString('fr-FR')} F</span>
                      <br/><span className="text-[11px] text-emerald-600">{printData.reduce((s, c) => s + c.paiements, 0).toLocaleString('fr-FR')} F</span>
                    </td>
                    <td className="p-4 text-center text-base">
                      {printData.reduce((s, c) => s + c.soldeClient, 0).toLocaleString('fr-FR')} F
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
