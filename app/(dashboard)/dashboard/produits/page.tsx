'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Plus, Upload, Download, Loader2, Pencil, Trash2, AlertTriangle, FileSpreadsheet, X, Printer, History } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { produitSchema } from '@/lib/validations'
import { validateForm, formatApiError } from '@/lib/validation-helpers'
import Pagination from '@/components/ui/Pagination'
import ImportExcelButton from '@/components/dashboard/ImportExcelButton'
import { addToSyncQueue, isOnline } from '@/lib/offline-sync'
import { formatDate } from '@/lib/format-date'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { paginateArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

type Produit = {
  id: number
  code: string
  codeBarres: string | null
  designation: string
  categorie: string
  unite: string
  prixAchat: number | null
  pamp: number | null
  prixVente: number | null
  prixMinimum: number | null
  seuilMin: number
  fournisseurId: number | null
  stockConsolide?: number
  createdAt: string
}

type Stats = { total: number; enStock: number; totalConsolide: number | null }
type Magasin = { id: number; code: string; nom: string }

export default function ProduitsPage() {
  const searchParams = useSearchParams()
  const qFromUrl = searchParams.get('q') ?? ''
  const [q, setQ] = useState(qFromUrl)
  const [list, setList] = useState<Produit[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [categories, setCategories] = useState<string[]>(['DIVERS'])
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [fournisseurs, setFournisseurs] = useState<{ id: number; nom: string }[]>([])
  const [form, setForm] = useState(false)
  const [editing, setEditing] = useState<Produit | null>(null)
  const [editData, setEditData] = useState({ designation: '', prixAchat: '', prixVente: '', prixMinimum: '', fournisseurId: '' })
  const [err, setErr] = useState('')
  const [savingPrix, setSavingPrix] = useState(false)
  const [deleting, setDeleting] = useState<Produit | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [params, setParams] = useState<any>(null)
  const [allProductsForPrint, setAllProductsForPrint] = useState<Produit[]>([])
  const [isPrinting, setIsPrinting] = useState(false)
  const { success: showSuccess, error: showError } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE_REPORT = 25
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    codeBarres: '',
    designation: '',
    categorie: 'DIVERS',
    unite: 'unite',
    magasinId: '',
    prixAchat: '',
    prixVente: '',
    prixMinimum: '',
    fournisseurId: '',
    seuilMin: '5',
    quantiteInitiale: '0',
  })

  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  const fetchList = async (page?: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page ?? currentPage),
        limit: '20',
      })
      if (q) params.set('q', q)
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)
      const res = await fetch(`/api/produits?${params.toString()}`)
      if (res.ok) {
        const response = await res.json()
        if (response.data) {
          setList(response.data)
          setPagination(response.pagination)
        } else {
          // Compatibilité avec l'ancien format
          setList(Array.isArray(response) ? response : [])
          setPagination(null)
        }
      } else {
        setList([])
        setPagination(null)
      }
    } catch {
      setList([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setQ(qFromUrl)
  }, [qFromUrl])

  useEffect(() => {
    setCurrentPage(1)
    fetchList(1)
  }, [q, dateDebut, dateFin])

  useEffect(() => {
    fetchList()
  }, [currentPage])

  const handleDirectPrint = async () => {
    setIsPrinting(true)
    try {
      const p = new URLSearchParams()
      if (q) p.set('q', q)
      if (dateDebut) p.set('dateDebut', dateDebut)
      if (dateFin) p.set('dateFin', dateFin)
      p.set('limit', '10000')

      const res = await fetch('/api/produits?complet=1&' + p.toString())
      if (res.ok) {
        const response = await res.json()
        setAllProductsForPrint(Array.isArray(response) ? response : (response.data || []))
        setTimeout(() => {
          window.print()
          setIsPrinting(false)
        }, 1000)
      } else {
        showError("Erreur lors de la récupération de la liste complète.")
        setIsPrinting(false)
      }
    } catch (e) {
      showError("Erreur réseau lors de la préparation de l'impression.")
      setIsPrinting(false)
    }
  }

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N ou Cmd+N : Nouveau produit
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !form) {
        e.preventDefault()
        setFormData({ code: '', codeBarres: '', designation: '', categorie: 'DIVERS', unite: 'unite', magasinId: '', prixAchat: '', prixVente: '', prixMinimum: '', fournisseurId: '', seuilMin: '5', quantiteInitiale: '0' })
        setForm(true)
        fetchNextCode('DIVERS')
      }
      // Échap : Fermer le formulaire
      if (e.key === 'Escape' && form) {
        setForm(false)
        setEditing(null)
        setErr('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [form])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchList(page)
  }

  const fetchStats = () => {
    fetch('/api/produits/stats').then((r) => (r.ok ? r.json() : null)).then((s) => { if (s) setStats(s) })
  }

  const fetchCategories = () => {
    fetch('/api/produits/categories')
      .then((r) => (r.ok ? r.json() : ['DIVERS']))
      .then((cat) => setCategories(Array.isArray(cat) && cat.length ? cat : ['DIVERS']))
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/produits/stats').then((r) => (r.ok ? r.json() : { total: 0, enStock: 0, totalConsolide: null })),
      fetch('/api/produits/categories').then((r) => (r.ok ? r.json() : ['DIVERS'])),
      fetch('/api/magasins').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/fournisseurs?complet=1').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/parametres').then((r) => (r.ok ? r.json() : null)),
    ]).then(([st, cat, mags, fours, p]) => {
      setStats(st)
      setCategories(Array.isArray(cat) && cat.length ? cat : ['DIVERS'])
      setMagasins(Array.isArray(mags) ? mags : [])
      setFournisseurs(Array.isArray(fours) ? fours : [])
      setParams(p)
    })
  }, [])

  useEffect(() => {
    fetchStats()
    fetchCategories()
  }, [list])

  const openEditProduit = (p: Produit) => {
    setEditing(p)
    setEditData({
      designation: p.designation,
      prixAchat: p.prixAchat != null ? String(p.prixAchat) : '',
      prixVente: p.prixVente != null ? String(p.prixVente) : '',
      prixMinimum: p.prixMinimum != null ? String(p.prixMinimum) : '0',
      fournisseurId: p.fournisseurId != null ? String(p.fournisseurId) : '',
    })
    setErr('')
  }

  const handleSaveProduit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSavingPrix(true)
    setErr('')
    try {
      const res = await fetch(`/api/produits/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designation: editData.designation.trim(),
          fournisseurId: editData.fournisseurId ? Number(editData.fournisseurId) : null,
          prixAchat: editData.prixAchat === '' ? null : Math.max(0, Number(editData.prixAchat)),
          prixVente: editData.prixVente === '' ? null : Math.max(0, Number(editData.prixVente)),
          prixMinimum: editData.prixMinimum === '' ? 0 : Math.max(0, Number(editData.prixMinimum)),
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setEditing(null)
        fetchList()
        showSuccess('Produit modifié avec succès.')
      } else {
        const errorMsg = formatApiError(d.error || 'Erreur lors de la modification.')
        setErr(errorMsg)
        showError(errorMsg)
      }
    } catch (e) {
      const errorMsg = formatApiError(e)
      setErr(errorMsg)
      showError(errorMsg)
    } finally { setSavingPrix(false) }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/produits/${deleting.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        setDeleting(null)
        fetchList()
        showSuccess(data.softDeleted ? 'Produit archivé ( historique conservé).' : 'Produit supprimé définitivement.')
      } else {
        showError(data.error || 'Erreur lors de la suppression.')
      }
    } catch (e) {
      showError('Erreur réseau lors de la suppression.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleImportExcel = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setImporting(true)
      setErr('')
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'produits')
        const res = await fetch('/api/import/excel', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (res.ok) {
          let msg = `Import Excel OK: ${data.created} créés, ${data.updated} mis à jour.`
          if (data.errors && data.errors.length > 0) {
            msg += `\n\nErreurs:\n${data.errors.slice(0, 5).join('\n')}`
            if (data.errors.length > 5) msg += `\n... et ${data.errors.length - 5} autres`
          }
          showSuccess(msg)
          fetchList()
          // Notifier les autres pages pour rafraîchir leurs listes de produits
          window.dispatchEvent(new CustomEvent('produit-created'))
        } else {
          showError(formatApiError(data.error || 'Erreur import Excel'))
        }
      } catch (e) {
        showError(formatApiError(e))
      } finally {
        setImporting(false)
      }
    }
    input.click()
  }

  const handleExportExcel = async () => {
    try {
      const res = await fetch('/api/produits/export')
      if (!res.ok) {
        const data = await res.json()
        showError(formatApiError(data.error || 'Erreur lors de l\'export Excel'))
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const contentDisposition = res.headers.get('Content-Disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'produits.xlsx'
        : 'produits.xlsx'
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showSuccess('Export Excel réussi.')
    } catch (e) {
      showError(formatApiError(e))
    }
  }

  const fetchNextCode = (categorie: string) => {
    fetch('/api/produits/next-code?categorie=' + encodeURIComponent(categorie || 'DIVERS'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.nextCode) {
          setFormData((f) => ({ ...f, code: data.nextCode }))
        }
      })
  }

  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const designation = formData.designation.trim()
    if (!form || designation.length < 2) return
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)
    suggestTimeoutRef.current = setTimeout(() => {
      suggestTimeoutRef.current = null
      const requestedDesignation = designation
      fetch('/api/produits/suggest?designation=' + encodeURIComponent(requestedDesignation))
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.code == null && data?.categorie == null) return
          setFormData((f) => {
            if (f.designation.trim() !== requestedDesignation) return f
            return {
              ...f,
              ...(data.code != null && { code: data.code }),
              ...(data.categorie != null && { categorie: data.categorie }),
            }
          })
          if (data.categorie) {
            setCategories((prev) =>
              prev.includes(data.categorie) ? prev : [...prev, data.categorie].sort((a, b) => a.localeCompare(b, 'fr'))
            )
          }
        })
    }, 400)
    return () => {
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)
    }
  }, [form, formData.designation])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')

    const validationData = {
      code: formData.code.trim().toUpperCase(),
      designation: formData.designation.trim(),
      categorie: formData.categorie.trim() || 'DIVERS',
      prixAchat: formData.prixAchat ? Number(formData.prixAchat) : null,
      prixVente: formData.prixVente ? Number(formData.prixVente) : null,
      prixMinimum: formData.prixMinimum ? Number(formData.prixMinimum) : 0,
      seuilMin: Math.max(0, Number(formData.seuilMin) || 5),
    }

    const validation = validateForm(produitSchema, validationData)
    if (!validation.success) {
      setErr(validation.error)
      showError(validation.error)
      return
    }

    // POINT DE VENTE OBLIGATOIRE
    if (!formData.magasinId || formData.magasinId === '') {
      setErr('Le point de vente est obligatoire.')
      showError('Le point de vente est obligatoire pour créer un produit.')
      return
    }

    const requestData = {
      ...validationData,
      codeBarres: formData.codeBarres.trim() || null,
      unite: formData.unite || 'unite',
      magasinId: Number(formData.magasinId),
      quantiteInitiale: Math.max(0, Number(formData.quantiteInitiale) || 0),
    }

    // Dans GestiCom Offline, on enregistre toujours vers le serveur local.

    try {
      const res = await fetch('/api/produits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })
      const data = await res.json()
      if (res.ok) {
        setForm(false)
        setFormData({ code: '', codeBarres: '', designation: '', categorie: 'DIVERS', unite: 'unite', magasinId: '', prixAchat: '', prixVente: '', prixMinimum: '', fournisseurId: '', seuilMin: '5', quantiteInitiale: '0' })
        setCurrentPage(1)
        fetchList(1)
        // Notifier les autres pages pour rafraîchir leurs listes de produits
        window.dispatchEvent(new CustomEvent('produit-created'))
        showSuccess(`Produit ${data.code} créé avec succès.`)
        // Rafraîchir plusieurs fois pour être sûr (problème cache parfois en standalone)
        fetchList(1)
        setTimeout(() => fetchList(1), 500)
        setTimeout(() => fetchStats(), 1000)
      } else {
        const errorMsg = formatApiError(data.error || 'Erreur lors de la création.')
        setErr(errorMsg)
        showError(errorMsg)
      }
    } catch (e) {
      const errorMsg = formatApiError(e)
      setErr(errorMsg)
      showError(errorMsg)
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Produits</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Catalogue et gestion des articles</p>
          <p className="mt-1 text-sm font-medium text-white/60">
            Total : <span className="text-amber-300 font-bold">{stats?.total ?? '—'}</span>
            {' · '}En stock : <span className="text-emerald-300 font-bold">{stats?.enStock ?? '—'}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportExcelButton
            endpoint="/api/produits/import"
            onSuccess={() => {
              fetchList()
              window.dispatchEvent(new CustomEvent('produit-created'))
            }}
          />
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
            title="Exporter tous les produits vers un fichier Excel"
          >
            <Download className="h-4 w-4" />
            Exporter Excel
          </button>
          <button
            onClick={handleDirectPrint}
            disabled={isPrinting}
            className="flex items-center gap-2 rounded-xl border-2 border-orange-600 bg-orange-50 px-6 py-3 text-sm font-black text-orange-900 hover:bg-orange-100 disabled:opacity-50 transition-all shadow-xl active:scale-95 no-print"
          >
            {isPrinting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
            IMPRIMER
          </button>
          <button
            onClick={() => {
              setFormData({ code: '', codeBarres: '', designation: '', categorie: 'DIVERS', unite: 'unite', magasinId: '', prixAchat: '', prixVente: '', prixMinimum: '', fournisseurId: '', seuilMin: '5', quantiteInitiale: '0' })
              setForm(true)
              fetchNextCode('DIVERS')
            }}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            title="Nouveau produit (Ctrl+N)"
          >
            <Plus className="h-4 w-4" />
            Nouveau
            <span className="hidden sm:inline text-xs opacity-75 ml-1">(Ctrl+N)</span>
          </button>
        </div>
      </div>

      {isPrinting && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md no-print">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm border-4 border-orange-500 transform scale-110">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-orange-500 mb-6" />
            <h3 className="text-2xl font-black text-gray-900 uppercase italic">Génération du Rapport</h3>
            <p className="mt-2 text-gray-600 font-bold uppercase text-[11px] tracking-widest">
              Veuillez patienter pendant la préparation de l'impression...
            </p>
          </div>
        </div>
      )}

      {/* Rendu masqué pour l'impression système direct */}
      <div className="hidden print:block bg-white w-full">
        {paginateArray(allProductsForPrint.length > 0 ? allProductsForPrint : list, 15, 23).map((chunk, index, allChunks) => (
          <div key={index} className="page-break">
            <ListPrintWrapper
              title="CATALOGUE GÉNÉRAL DES PRODUITS"
              subtitle={q ? `Recherche : "${q}"` : "Inventaire complet du catalogue"}
              pageNumber={index + 1}
              totalPages={allChunks.length}
              enterprise={params}
              layout="landscape"
              hideVisa={index < allChunks.length - 1}
            >
              <table className="w-full text-[14px] border-collapse border-2 border-black">
                <thead>
                  <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                    <th className="border border-black px-1 py-3 text-center w-10">N°</th>
                    <th className="border border-black px-1 py-3 text-left">Code</th>
                    <th className="border border-black px-2 py-3 text-left">Désignation de l'Article</th>
                    <th className="border border-black px-1 py-3 text-left">Catégorie</th>
                    <th className="border border-black px-1 py-3 text-right">Qté</th>
                    <th className="border border-black px-1 py-3 text-right">P. Achat</th>
                    <th className="border border-black px-1 py-3 text-right">P. Vente</th>
                    <th className="border border-black px-1 py-3 text-right">P. Min</th>
                    <th className="border border-black px-2 py-3 text-right bg-gray-50 uppercase text-[10px]">Val. Achat</th>
                    <th className="border border-black px-2 py-3 text-right bg-gray-50 uppercase text-[10px]">Val. Vente</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((p, idx) => {
                    const stock = p.stockConsolide ?? 0
                    const pAchat = p.pamp || p.prixAchat || 0
                    const pVente = p.prixVente || 0
                    const pMin = p.prixMinimum || 0
                    const valAchat = stock * pAchat
                    const valVente = stock * pVente
                    return (
                      <tr key={idx} className="border border-black font-medium">
                        <td className="border border-black px-1 py-2 text-center font-bold">
                          {index * ITEMS_PER_PRINT_PAGE + idx + 1}
                        </td>
                        <td className="border border-black px-1 py-2 font-mono text-[11px] font-bold">{p.code}</td>
                        <td className="border border-black px-2 py-2 uppercase font-black text-[13px] leading-tight">{p.designation}</td>
                        <td className="border border-black px-1 py-2 text-[11px] italic font-bold">{p.categorie}</td>
                        <td className="border border-black px-1 py-2 text-right font-black text-[15px]">{stock.toLocaleString('fr-FR')}</td>
                        <td className="border border-black px-1 py-2 text-right">{pAchat.toLocaleString('fr-FR')}</td>
                        <td className="border border-black px-1 py-2 text-right font-bold">{pVente.toLocaleString('fr-FR')}</td>
                        <td className="border border-black px-1 py-2 text-right italic text-gray-500">{pMin.toLocaleString('fr-FR')}</td>
                        <td className="border border-black px-2 py-2 text-right font-bold bg-gray-50/50">{valAchat.toLocaleString('fr-FR')}</td>
                        <td className="border border-black px-2 py-2 text-right font-black bg-gray-50/50 uppercase tracking-tighter italic">{valVente.toLocaleString('fr-FR')}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {index === allChunks.length - 1 && (
                  <tfoot>
                    <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-lg">
                      <td colSpan={4} className="border border-black px-2 py-4 text-right">
                        BILAN GÉNÉRAL ({ (allProductsForPrint.length > 0 ? allProductsForPrint : list).length } RÉFÉRENCES) :
                      </td>
                      <td className="border border-black px-2 py-4 text-right bg-white shadow-inner">
                        {(allProductsForPrint.length > 0 ? allProductsForPrint : list).reduce((acc, p) => acc + (p.stockConsolide ?? 0), 0).toLocaleString()}
                      </td>
                      <td colSpan={3} className="border border-black px-2 py-4 text-right bg-gray-50/50 text-[12px] font-bold tracking-widest leading-none">
                        VALEUR TOTALE DU CATALOGUE <br/><span className="text-[9px] font-normal italic">(Calculée sur stock actuel)</span>
                      </td>
                      <td className="border border-black px-2 py-4 text-right bg-white text-orange-800">
                        {(allProductsForPrint.length > 0 ? allProductsForPrint : list).reduce((acc, p) => acc + ((p.stockConsolide ?? 0) * (p.pamp && p.pamp > 0 ? p.pamp : (p.prixAchat || 0))), 0).toLocaleString()} F
                      </td>
                      <td className="border border-black px-2 py-4 text-right bg-slate-900 text-white shadow-2xl">
                        {(allProductsForPrint.length > 0 ? allProductsForPrint : list).reduce((acc, p) => acc + ((p.stockConsolide ?? 0) * (p.prixVente || 0)), 0).toLocaleString()} F
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </ListPrintWrapper>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4 no-print items-end bg-white/10 p-3 rounded-xl border border-white/20">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Rechercher par code, désignation, catégorie..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-gray-900"
          />
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <label className="block text-[10px] font-black text-white uppercase mb-1">Depuis le</label>
            <input
              type="date"
              value={dateDebut}
              onChange={e => setDateDebut(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-orange-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-white uppercase mb-1">Jusqu'au</label>
            <input
              type="date"
              value={dateFin}
              onChange={e => setDateFin(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-orange-500 text-gray-900"
            />
          </div>
          {(dateDebut || dateFin) && (
            <button
              onClick={() => { setDateDebut(''); setDateFin(''); }}
              className="bg-white/20 hover:bg-white/30 text-white rounded-lg p-2 text-xs font-bold transition-all"
            >
              RÉINITIALISER
            </button>
          )}
        </div>
      </div>

      {form && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Nouveau produit</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Ligne 1 : Code + Désignation + Catégorie + Point de vente */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Code *</label>
              <input
                required
                value={formData.code}
                onChange={(e) => setFormData((f) => ({ ...f, code: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
              <p className="mt-0.5 text-xs text-gray-500">Suggéré selon la catégorie ou la désignation</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Désignation *</label>
              <input
                required
                value={formData.designation}
                onChange={(e) => setFormData((f) => ({ ...f, designation: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
              <p className="mt-0.5 text-xs text-gray-500">Code et catégorie suggérés automatiquement à partir des produits similaires en base.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Catégorie *</label>
              <input
                list="categories-list"
                value={formData.categorie}
                onChange={(e) => {
                  const cat = e.target.value.toUpperCase()
                  setFormData((f) => ({ ...f, categorie: cat }))
                  if (cat.length >= 1) fetchNextCode(cat)
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                placeholder="Ex: BOISSONS"
                required
              />
              <datalist id="categories-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className="mt-0.5 text-xs text-gray-500">Choisissez ou tapez une nouvelle catégorie</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Point de vente *</label>
              <select
                required
                value={formData.magasinId}
                onChange={(e) => setFormData((f) => ({ ...f, magasinId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
                <option value="">— Choisir un point de vente —</option>
                {magasins.map((m) => (
                  <option key={m.id} value={m.id}>{m.code} — {m.nom}</option>
                ))}
              </select>
              <p className="mt-0.5 text-xs text-gray-500">Le produit sera en stock uniquement dans ce point de vente (obligatoire)</p>
            </div>
            {/* Ligne 2 : Code-barres + Unité + Prix achat + Prix vente */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Code-barres (EAN-13/QR)</label>
              <input
                value={formData.codeBarres}
                onChange={(e) => setFormData((f) => ({ ...f, codeBarres: e.target.value }))}
                placeholder="Ex: 3017620422003"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none font-mono text-sm"
              />
              <p className="mt-0.5 text-xs text-gray-500">Permet la détection automatique via le scanner caméra 📷</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Unité de vente</label>
              <select
                value={formData.unite}
                onChange={(e) => setFormData((f) => ({ ...f, unite: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
                <option value="unite">Unité (pièce)</option>
                <option value="kg">Kilogramme (kg)</option>
                <option value="g">Gramme (g)</option>
                <option value="litre">Litre (L)</option>
                <option value="cl">Centilitre (cl)</option>
                <option value="m">Mètre (m)</option>
                <option value="m2">Mètre carré (m²)</option>
                <option value="m3">Mètre cube (m³)</option>
                <option value="boite">Boîte</option>
                <option value="carton">Carton</option>
                <option value="sachet">Sachet</option>
                <option value="heure">Heure (service)</option>
                <option value="jour">Jour (service)</option>
                <option value="forfait">Forfait (service)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prix d&apos;achat (FCFA)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.prixAchat}
                onChange={(e) => setFormData((f) => ({ ...f, prixAchat: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prix de vente (FCFA)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.prixVente}
                onChange={(e) => setFormData((f) => ({ ...f, prixVente: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-600 font-bold italic tracking-tighter uppercase">Prix de vente MIN (FCFA) *</label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={formData.prixMinimum}
                onChange={(e) => setFormData((f) => ({ ...f, prixMinimum: e.target.value }))}
                className="mt-1 w-full rounded-lg border-2 border-red-200 px-3 py-2 focus:border-red-500 focus:outline-none bg-red-50/30 font-black italic"
              />
              <p className="mt-0.5 text-[10px] text-red-500 font-bold uppercase tracking-widest">⚠️ Seuil de blocage à la vente</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Seuil min.</label>
              <input
                type="number"
                min="0"
                value={formData.seuilMin}
                onChange={(e) => setFormData((f) => ({ ...f, seuilMin: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantité initiale *</label>
              <input
                type="number"
                min="0"
                required
                value={formData.quantiteInitiale}
                onChange={(e) => setFormData((f) => ({ ...f, quantiteInitiale: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
              <p className="mt-0.5 text-xs text-gray-500">Stock initial dans le magasin sélectionné</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 font-bold text-orange-600">Fournisseur Livreur *</label>
              <select
                required
                value={formData.fournisseurId}
                onChange={(e) => setFormData((f) => ({ ...f, fournisseurId: e.target.value }))}
                className="mt-1 w-full rounded-lg border-2 border-orange-200 px-3 py-2 focus:border-orange-500 focus:outline-none bg-orange-50/50"
              >
                <option value="">— Sélectionner le fournisseur —</option>
                {fournisseurs.map((f) => (
                  <option key={f.id} value={f.id}>{f.nom}</option>
                ))}
              </select>
              <p className="mt-0.5 text-[10px] text-gray-400 uppercase font-black">Obligatoire pour la traçabilité des stocks</p>
            </div>
            <div className="flex gap-2 col-span-1 sm:col-span-2 lg:col-span-4">
              <button type="submit" className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600">
                Enregistrer
              </button>
              <button type="button" onClick={() => setForm(false)} className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300">
                Annuler
              </button>
            </div>
          </form>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white no-print">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : list.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Aucun produit. Importez depuis un fichier Excel ou ajoutez-en manuellement.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">N°</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Désignation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Catégorie</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Prix achat</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Prix vente</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-red-800 bg-red-50 italic">Prix Min.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Stock Actuel</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Seuil</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date création</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {list.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">{(pagination ? (pagination.page - 1) * pagination.limit : 0) + idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-900">{p.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{p.designation}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.categorie}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {p.prixAchat != null ? `${Number(p.prixAchat).toLocaleString('fr-FR')} F` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      <input
                        type="number"
                        defaultValue={p.prixVente || 0}
                        onBlur={async (e) => {
                          const val = Number(e.target.value)
                          if (val === p.prixVente) return
                          await fetch(`/api/produits/${p.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prixVente: val })
                          })
                          showSuccess(`${p.code}: Prix de vente mis à jour.`)
                        }}
                        className="w-20 rounded border border-transparent hover:border-gray-300 px-1 text-right focus:border-orange-500 outline-none transition-all"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-black text-red-700 bg-red-50 italic">
                      <input
                        type="number"
                        defaultValue={p.prixMinimum || 0}
                        onBlur={async (e) => {
                          const val = Number(e.target.value)
                          if (val === p.prixMinimum) return
                          await fetch(`/api/produits/${p.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prixMinimum: val })
                          })
                          showSuccess(`${p.code}: Prix minimum mis à jour.`)
                        }}
                        className="w-20 rounded border border-transparent hover:border-red-300 px-1 text-right focus:border-red-500 outline-none bg-transparent transition-all"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={`font-bold ${(p.stockConsolide ?? 0) <= p.seuilMin ? 'text-red-600' : 'text-emerald-600'}`}>
                          {(p.stockConsolide ?? 0).toLocaleString()}
                        </span>
                        {(p.stockConsolide ?? 0) <= p.seuilMin && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 font-medium">{p.seuilMin}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(p.createdAt, { includeTime: true })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEditProduit(p)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-orange-600"
                          title="Modifier produit (Nom, Prix, Fournisseur)"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(p)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                          title="Supprimer ce produit"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-[2rem] border border-gray-200 bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">Modifier Produit</h3>
                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{editing.code}</p>
              </div>
              <button onClick={() => setEditing(null)} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"><X className="h-6 w-6" /></button>
            </div>

            <form onSubmit={handleSaveProduit} className="space-y-5">
              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Désignation (Nom du produit)</label>
                <input
                  required
                  value={editData.designation}
                  onChange={(e) => setEditData((f) => ({ ...f, designation: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 focus:border-orange-500 focus:outline-none font-bold text-gray-900 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Fournisseur Attitré</label>
                <select
                  value={editData.fournisseurId}
                  onChange={(e) => setEditData((f) => ({ ...f, fournisseurId: e.target.value }))}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 focus:border-orange-500 focus:outline-none font-bold text-gray-700 bg-gray-50/50 shadow-sm"
                >
                  <option value="">— Aucun fournisseur —</option>
                  {fournisseurs.map((f) => (
                    <option key={f.id} value={f.id}>{f.nom}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Prix d&apos;achat</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editData.prixAchat}
                    onChange={(e) => setEditData((f) => ({ ...f, prixAchat: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 focus:border-orange-500 focus:outline-none font-bold tabular-nums shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Prix de vente</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editData.prixVente}
                    onChange={(e) => setEditData((f) => ({ ...f, prixVente: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 focus:border-orange-500 focus:outline-none font-bold tabular-nums shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-red-600 uppercase tracking-widest mb-1.5 ml-1 italic">Prix de vente MINIMUM (Blocage)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={editData.prixMinimum}
                  onChange={(e) => setEditData((f) => ({ ...f, prixMinimum: e.target.value }))}
                  className="w-full rounded-2xl border-2 border-red-100 bg-red-50/30 px-4 py-3 focus:border-red-500 focus:outline-none font-black text-red-700 tabular-nums shadow-sm"
                />
              </div>

              {err && <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{err}</p>}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={savingPrix}
                  className="flex-1 rounded-2xl bg-orange-600 py-4 text-sm font-black text-white hover:bg-orange-700 disabled:opacity-60 shadow-lg shadow-orange-500/30 uppercase tracking-widest transition-all hover:-translate-y-1"
                >
                  {savingPrix ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Mettre à jour"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 rounded-2xl border-2 border-gray-200 bg-white py-4 text-sm font-black text-gray-700 hover:bg-gray-50 uppercase tracking-widest transition-all"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Confirmation Suppression */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleting(null)}>
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3 text-red-600">
              <div className="rounded-full bg-red-100 p-2">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">Confirmer la suppression</h3>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              Voulez-vous vraiment supprimer le produit **{deleting.designation}** ({deleting.code}) ?
              **Attention :** Cette opération est définitive et supprimera également tout l'historique associé (stocks, ventes, achats, mouvements) via la suppression en cascade.
            </p>
            <div className="flex gap-3">
              <button
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Suppression...' : 'Oui, supprimer'}
              </button>
              <button
                onClick={() => setDeleting(null)}
                className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 font-bold text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
