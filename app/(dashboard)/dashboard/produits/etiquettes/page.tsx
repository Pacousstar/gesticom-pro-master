'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Search, Plus, Minus, Printer, Package, Tag, Barcode, Settings
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'

type Produit = {
  id: number
  code: string
  codeBarres: string | null
  designation: string
  prixVente: number | null
  categorie: string
}

export default function EtiquettesPage() {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()

  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [copies, setCopies] = useState<Record<number, number>>({})
  const [copiesGlobales, setCopiesGlobales] = useState(2)
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const [printHtml, setPrintHtml] = useState('')
  const [etPage, setEtPage] = useState(1)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch('/api/produits?limit=1000&actif=true')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data?.data || []
        setProduits(list)
      })
      .catch(() => showError('Erreur chargement produits'))
      .finally(() => setLoading(false))
  }, [showError])

  const filtered = produits.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.code.toLowerCase().includes(q) || p.designation.toLowerCase().includes(q) || (p.codeBarres || '').toLowerCase().includes(q)
  })

  const itemsPerPage = 10
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedData = filtered.slice((etPage - 1) * itemsPerPage, etPage * itemsPerPage)

  useEffect(() => {
    setEtPage(1)
  }, [search])

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setCopies(c => { const nc = { ...c }; delete nc[id]; return nc })
      } else {
        next.add(id)
        setCopies(c => ({ ...c, [id]: copiesGlobales }))
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
      setCopies({})
    } else {
      const ids = new Set(filtered.map(p => p.id))
      setSelectedIds(ids)
      const newCopies: Record<number, number> = {}
      ids.forEach(id => { newCopies[id] = copiesGlobales })
      setCopies(newCopies)
    }
  }

  const selected = produits.filter(p => selectedIds.has(p.id))

  const genererEtiquettes = async () => {
    if (selected.length === 0) { showError('Sélectionnez au moins un produit.'); return }

    setGenerating(true)
    try {
      const { default: JsBarcode } = await import('jsbarcode')

      let html = `<!DOCTYPE html><html><head><style>
        @page { margin: 8mm; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .label { width: 48mm; min-height: 28mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm; box-sizing: border-box; border: 1px dashed #ccc; break-inside: avoid; }
        .barcode svg { max-width: 44mm; height: auto; }
        .code { font-size: 7px; font-weight: bold; margin-top: 1mm; text-align: center; color: #222; }
        .name { font-size: 6px; text-align: center; color: #555; margin-top: 0.5mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 44mm; }
        .price { font-size: 8px; font-weight: bold; color: #d97706; margin-top: 0.5mm; }
        .grid { display: flex; flex-wrap: wrap; gap: 2mm; }
        @media print { .label { border: none; } }
      </style></head><body><div class="grid">`

      for (const p of selected) {
        const nb = copies[p.id] || copiesGlobales
        for (let i = 0; i < nb; i++) {
          const barcodeData = p.codeBarres || p.code

          const svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

          try {
            JsBarcode(svgContainer, barcodeData, {
              format: 'CODE128',
              width: 1.5,
              height: 18,
              displayValue: false,
              margin: 0,
            })
          } catch (e) {
            console.warn('JsBarcode error for', barcodeData, e)
          }

          const svgHtml = svgContainer.outerHTML

          html += `<div class="label">
            <div class="barcode">${svgHtml}</div>
            <div class="code">${p.code}</div>
            <div class="name">${p.designation}</div>
            <div class="price">${(p.prixVente || 0).toLocaleString('fr-FR')} F</div>
          </div>`
        }
      }

      html += '</div></body></html>'
      setPrintHtml(html)
      setPrintPreviewOpen(true)
    } finally {
      setGenerating(false)
    }
  }

  const formatFcfa = (val: number) => val.toLocaleString('fr-FR') + ' F'

  return (
    <div className="pb-12">
      <div className="print:hidden space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-violet-600 to-violet-800 p-8 shadow-2xl">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl opacity-50" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">Étiquettes Codes-Barres</h1>
              <p className="mt-2 text-white/90 font-medium max-w-2xl">
                Générez des étiquettes avec codes-barres pour vos produits.
              </p>
            </div>
          </div>
        </div>

        {/* Stats / Info cards */}
        <div className="space-y-2">
          <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] ml-6">Aperçu des produits : {produits.length} au total</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Produits total", val: String(produits.length), sub: "Dans le catalogue", icon: Package, color: "bg-violet-600" },
              { label: "Sélectionnés", val: String(selected.length), sub: "Pour étiquetage", icon: Tag, color: "bg-emerald-600" },
              { label: "Étiquettes à générer", val: String([...selectedIds].reduce((s, id) => s + (copies[id] || copiesGlobales), 0)), sub: "Copies totales", icon: Barcode, color: "bg-amber-600" },
              { label: "Copies par défaut", val: String(copiesGlobales), sub: "Par produit", icon: Settings, color: "bg-blue-600" },
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

        {/* Filters & actions */}
        <div className="rounded-[2rem] bg-white p-6 shadow-xl border border-gray-100 flex flex-col md:flex-row gap-6 items-end">
          <div className="flex flex-wrap items-end gap-4 flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full rounded-2xl border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-sm font-bold focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-2.5 border border-gray-200">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Copies/pdt</label>
              <input type="number" min={1} max={99} value={copiesGlobales}
                onChange={e => {
                  const v = Math.max(1, Number(e.target.value) || 1)
                  setCopiesGlobales(v)
                  const newCopies: Record<number, number> = {}
                  selectedIds.forEach(id => { newCopies[id] = v })
                  setCopies(newCopies)
                }}
                className="w-16 rounded-lg border-gray-300 bg-white px-2 py-1.5 text-sm font-bold text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <button onClick={genererEtiquettes} disabled={selected.length === 0 || generating}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-xl active:scale-95 uppercase tracking-widest"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              {generating ? 'Génération...' : `Aperçu et imprimer (${selected.length} produit(s))`}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-2xl border border-gray-100">
          <div className="bg-gray-50/50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic flex items-center gap-3">
              <Barcode className="h-5 w-5 text-violet-500" />
              Catalogue produits
            </h2>
            <div className="flex gap-2">
              <span className="bg-violet-100 text-violet-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                {filtered.length} Produits
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
              <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
              <p className="text-xs font-black uppercase tracking-widest italic text-gray-500">Chargement des données...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-20">
              <Package className="h-16 w-16" />
              <p className="text-sm font-black uppercase tracking-widest italic">Aucun produit trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-left">
                    <th className="px-8 py-5 w-10">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll} className="rounded border-gray-300 accent-violet-600" />
                    </th>
                    <th className="px-8 py-5">Produit</th>
                    <th className="px-8 py-5">Code barres</th>
                    <th className="px-8 py-5">Catégorie</th>
                    <th className="px-8 py-5 text-right">Prix</th>
                    <th className="px-8 py-5 text-center w-28">Copies</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedData.map(p => {
                    const checked = selectedIds.has(p.id)
                    return (
                      <tr key={p.id}
                        className={`group hover:bg-violet-50/30 transition-colors cursor-pointer ${checked ? 'bg-violet-50/50' : ''}`}
                        onClick={() => toggleSelect(p.id)}
                      >
                        <td className="px-8 py-5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleSelect(p.id)} className="rounded border-gray-300 accent-violet-600" />
                        </td>
                        <td className="px-8 py-5">
                          <p className="font-mono text-xs font-black text-violet-600">{p.code}</p>
                          <p className="text-sm font-bold text-gray-800 uppercase tracking-tighter">{p.designation}</p>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-xs font-bold text-gray-700 font-mono bg-gray-50 px-3 py-1 rounded-lg border border-gray-200">
                            {p.codeBarres || p.code}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            {p.categorie}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="text-sm font-black text-gray-900">{formatFcfa(p.prixVente || 0)}</span>
                        </td>
                        <td className="px-8 py-5 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setCopies(c => ({ ...c, [p.id]: Math.max(1, (c[p.id] || copiesGlobales) - 1) }))}
                              className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-100 transition-all"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-sm font-black text-gray-900 w-8 text-center tabular-nums">
                              {copies[p.id] || copiesGlobales}
                            </span>
                            <button onClick={() => setCopies(c => ({ ...c, [p.id]: Math.min(99, (c[p.id] || copiesGlobales) + 1) }))}
                              className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-100 transition-all"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="bg-gray-50/50 px-8 py-6 border-t border-gray-100">
              <Pagination
                currentPage={etPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                totalItems={filtered.length}
                onPageChange={setEtPage}
              />
            </div>
          )}
        </div>

        {/* Summary footer */}
        <div className="rounded-[2rem] bg-violet-50 border-2 border-violet-200 p-5 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-violet-100 p-2.5 shrink-0">
              <Barcode className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-black text-violet-800 uppercase tracking-tighter">
                {filtered.length} produit(s) trouvé(s) — {selected.length} sélectionné(s)
              </p>
              <p className="text-sm font-bold text-violet-700">
                Total étiquettes: {[...selectedIds].reduce((s, id) => s + (copies[id] || copiesGlobales), 0)} copie(s) à imprimer
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      {printPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
            <div className="flex items-center gap-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase italic">Aperçu des étiquettes</h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  {[...selectedIds].reduce((s, id) => s + (copies[id] || copiesGlobales), 0)} étiquette(s)
                </p>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <span className="rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-600 uppercase">
                {selected.length} PRODUITS
              </span>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setPrintPreviewOpen(false)}
                className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase tracking-widest"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  const iframe = document.querySelector('#etiquettes-iframe') as HTMLIFrameElement
                  if (iframe?.contentWindow) iframe.contentWindow.print()
                }}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-10 py-2 text-sm font-black text-white hover:bg-violet-700 shadow-xl transition-all active:scale-95 uppercase tracking-widest"
              >
                <Printer className="h-4 w-4" />
                Lancer l'impression
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
            <div className="mx-auto bg-white shadow-2xl min-h-[500px] rounded-xl overflow-hidden p-6">
              <iframe
                id="etiquettes-iframe"
                srcDoc={printHtml}
                className="w-full h-full"
                title="Aperçu étiquettes"
                style={{ minHeight: '80vh' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
