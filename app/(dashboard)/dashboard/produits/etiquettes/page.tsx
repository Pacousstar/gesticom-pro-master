'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Search, Plus, Minus, Printer, ChevronDown,
  XCircle, Package, Settings
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import PrintPreview from '@/components/print/PrintPreview'
import { generateLignesHTML } from '@/lib/print-templates'

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

    const { default: JsBarcode } = await import('jsbarcode')

    let html = `<!DOCTYPE html><html><head><style>
      @page { size: 50mm 30mm; margin: 0; }
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
      .label { width: 50mm; height: 30mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm; box-sizing: border-box; border: 1px dashed #ccc; page-break-inside: avoid; }
      .barcode svg { max-width: 44mm; height: auto; }
      .code { font-size: 7px; font-weight: bold; margin-top: 1mm; text-align: center; }
      .name { font-size: 6px; text-align: center; color: #555; margin-top: 0.5mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 46mm; }
      .price { font-size: 8px; font-weight: bold; color: #d97706; margin-top: 0.5mm; }
      .grid { display: flex; flex-wrap: wrap; }
      @media print {
        .label { border: none; }
        @page { margin: 0; }
      }
    </style></head><body><div class="grid">`

    for (const p of selected) {
      const nb = copies[p.id] || copiesGlobales
      for (let i = 0; i < nb; i++) {
        const barcodeData = p.codeBarres || p.code

        const svgContainer = document.createElement('div')
        svgContainer.style.display = 'none'
        document.body.appendChild(svgContainer)

        try {
          JsBarcode(svgContainer, barcodeData, {
            format: p.codeBarres ? 'CODE128' : 'CODE128',
            width: 1.5,
            height: 18,
            displayValue: false,
            margin: 0,
          })
        } catch {
          // fallback: text only
        }

        const svgHtml = svgContainer.innerHTML
        document.body.removeChild(svgContainer)

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
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')}
            className="rounded-lg bg-white/10 hover:bg-white/20 p-2 transition-colors"
          >
            <ChevronDown className="h-5 w-5 rotate-90" />
          </button>
          <div className="rounded-xl bg-white/20 backdrop-blur-sm px-4 py-3 flex items-center gap-2 text-white font-bold text-lg">
            <Printer className="h-6 w-6" />
            Étiquettes Codes-Barres
          </div>
        </div>

        {/* Settings bar */}
        <div className="flex flex-wrap gap-3 items-center bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/70">Copies/pdt:</label>
            <input type="number" min={1} max={99} value={copiesGlobales}
              onChange={e => {
                const v = Math.max(1, Number(e.target.value) || 1)
                setCopiesGlobales(v)
                const newCopies: Record<number, number> = {}
                selectedIds.forEach(id => { newCopies[id] = v })
                setCopies(newCopies)
              }}
              className="w-16 rounded-lg bg-white/15 border border-white/20 px-2 py-2 text-sm text-white text-center focus:outline-none"
            />
          </div>
          <button onClick={genererEtiquettes} disabled={selected.length === 0}
            className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/20 disabled:cursor-not-allowed px-4 py-2 text-sm font-bold text-white transition-colors flex items-center gap-2"
          >
            <Printer className="h-4 w-4" /> Aperçu et imprimer ({selected.length} produit(s))
          </button>
        </div>

        {/* Table */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-white/60">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">Aucun produit trouvé</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/60 text-xs uppercase">
                    <th className="text-left px-4 py-3 font-medium w-10">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll} className="rounded border-white/30" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Produit</th>
                    <th className="text-left px-4 py-3 font-medium">Code barres</th>
                    <th className="text-left px-4 py-3 font-medium">Catégorie</th>
                    <th className="text-right px-4 py-3 font-medium">Prix</th>
                    <th className="text-center px-4 py-3 font-medium w-24">Copies</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filtered.map(p => {
                    const checked = selectedIds.has(p.id)
                    return (
                      <tr key={p.id}
                        className={`hover:bg-white/5 transition-colors cursor-pointer ${checked ? 'bg-white/10' : ''}`}
                        onClick={() => toggleSelect(p.id)}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleSelect(p.id)} className="rounded border-white/30" />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{p.designation}</p>
                          <p className="text-[10px] text-white/50 font-mono">{p.code}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-white/60 font-mono">{p.codeBarres || p.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-white/60 bg-white/10 px-1.5 py-0.5 rounded">{p.categorie}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-white font-medium">
                          {(p.prixVente || 0).toLocaleString('fr-FR')} F
                        </td>
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setCopies(c => ({ ...c, [p.id]: Math.max(1, (c[p.id] || copiesGlobales) - 1) }))}
                              className="p-1 rounded bg-white/10 hover:bg-white/20 text-white"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-sm font-bold text-white w-6 text-center">
                              {copies[p.id] || copiesGlobales}
                            </span>
                            <button onClick={() => setCopies(c => ({ ...c, [p.id]: Math.min(99, (c[p.id] || copiesGlobales) + 1) }))}
                              className="p-1 rounded bg-white/10 hover:bg-white/20 text-white"
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
          </div>
        )}

        <p className="text-center text-xs text-white/40">
          {filtered.length} produit(s) trouvé(s) — {selected.length} sélectionné(s)
          {selected.length > 0 && ` — Total étiquettes: ${[...selectedIds].reduce((s, id) => s + (copies[id] || copiesGlobales), 0)}`}
        </p>
      </div>

      {/* Print Preview */}
      {printPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setPrintPreviewOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Aperçu des étiquettes</h3>
              <button onClick={() => setPrintPreviewOpen(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors">
                <XCircle className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              <iframe srcDoc={printHtml}
                className="w-full h-full bg-white rounded shadow"
                title="Aperçu étiquettes"
                style={{ minHeight: '500px' }}
              />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50">
              <button onClick={() => setPrintPreviewOpen(false)}
                className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                Fermer
              </button>
              <button onClick={() => {
                const iframe = document.querySelector('iframe')
                if (iframe?.contentWindow) iframe.contentWindow.print()
              }}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-white font-bold flex items-center gap-2"
              >
                <Printer className="h-4 w-4" /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
