'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Users, Search, Plus, Loader2, Pencil, Trash2, X, FileSpreadsheet, Download, Clock, Calendar, FileText, ChevronRight, DollarSign, CheckCircle2, Printer, Bell } from 'lucide-react'
import PaymentModal from '@/components/dashboard/PaymentModal'
import RelanceModal from '@/components/dashboard/RelanceModal'
import { useToast } from '@/hooks/useToast'
import { clientSchema } from '@/lib/validations'
import { validateForm, formatApiError } from '@/lib/validation-helpers'
import { MESSAGES } from '@/lib/messages'
import Pagination from '@/components/ui/Pagination'
import ImportExcelButton from '@/components/dashboard/ImportExcelButton'
import { addToSyncQueue, isOnline } from '@/lib/offline-sync'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

type Client = {
  id: number
  code: string | null
  nom: string
  telephone: string | null
  email: string | null
  type: string
  plafondCredit: number | null
  ncc: string | null
  localisation: string | null
  soldeInitial: number
  avoirInitial: number
  dette?: number
  derniereFacture?: string | null
}

export default function ClientsPage() {
  const searchParams = useSearchParams()
  const qFromUrl = searchParams.get('q') ?? ''
  const [q, setQ] = useState(qFromUrl)
  const [list, setList] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [err, setErr] = useState('')
  const { success: showSuccess, error: showError } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    nom: '',
    telephone: '',
    email: '',
    type: 'CASH',
    plafondCredit: '',
    ncc: '',
    localisation: '',
    soldeInitial: '',
    avoirInitial: '',
  })
  const [userRole, setUserRole] = useState<string>('')
  const [selectedHistory, setSelectedHistory] = useState<{ id: number; nom: string } | null>(null)
  const [historyData, setHistoryData] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [updatingDebt, setUpdatingDebt] = useState(false)
  const [tempDebt, setTempDebt] = useState('')
  const [editingDebt, setEditingDebt] = useState<number | null>(null)
  const [paymentModal, setPaymentModal] = useState<{ client: Client; invoices: any[] } | null>(null)
  const [relanceModal, setRelanceModal] = useState<{ id: number; nom: string } | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [allClientsForPrint, setAllClientsForPrint] = useState<Client[]>([])
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [printType, setPrintType] = useState<'PORTEFEUILLE' | 'REPERTOIRE'>('PORTEFEUILLE')
  const [entreprise, setEntreprise] = useState<any>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [printLayout, setPrintLayout] = useState<'portrait' | 'landscape'>('portrait')

  useEffect(() => {
    fetch('/api/auth/check').then((r) => r.ok && r.json()).then((d) => d && setUserRole(d.role)).catch(() => { })
    fetch('/api/parametres').then(r => r.ok && r.json()).then(d => { if (d) setEntreprise(d) }).catch(() => { })
  }, [])

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

      const res = await fetch(`/api/clients?${params.toString()}`)
      if (res.ok) {
        const response = await res.json()
        if (response.data) {
          setList(response.data)
          setPagination(response.pagination)
        } else {
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

  const handlePrintAll = async (type: 'PORTEFEUILLE' | 'REPERTOIRE') => {
    setPrintType(type)
    setIsPrinting(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)
      params.set('limit', '10000') 
      
      const res = await fetch('/api/clients?' + params.toString())
      if (res.ok) {
        const response = await res.json()
        setAllClientsForPrint(response.data || [])
        setIsPreviewOpen(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsPrinting(false)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchList(page)
  }

  const handleDelete = async (c: Client) => {
    if (!confirm(`Supprimer le client « ${c.nom} » ? Toutes les données historiques liées (ventes, paiements) seront également supprimées via la suppression en cascade. Cette action est irréversible.`)) return
    try {
      const res = await fetch(`/api/clients/${c.id}`, { method: 'DELETE' })
      if (res.ok) {
        setCurrentPage(1)
        fetchList(1)
        showSuccess(MESSAGES.CLIENT_SUPPRIME)
      } else {
        const d = await res.json()
        showError(res.status === 403 ? (d.error || MESSAGES.RESERVE_SUPER_ADMIN) : formatApiError(d.error || 'Erreur lors de la suppression.'))
      }
    } catch (e) {
      showError(formatApiError(e))
    }
  }

  const openForm = (c?: Client) => {
    if (c) {
      setEditing(c)
      setFormData({
        code: c.code || '',
        nom: c.nom,
        telephone: c.telephone || '',
        email: c.email || '',
        type: c.type,
        plafondCredit: c.plafondCredit != null ? String(c.plafondCredit) : '',
        ncc: c.ncc || '',
        localisation: c.localisation || '',
        soldeInitial: c.soldeInitial != null ? String(c.soldeInitial) : '',
        avoirInitial: c.avoirInitial != null ? String(c.avoirInitial) : '',
      })
    } else {
      setEditing(null)
      setFormData({ code: '', nom: '', telephone: '', email: '', type: 'CASH', plafondCredit: '', ncc: '', localisation: '', soldeInitial: '', avoirInitial: '' })
    }
    setForm(true)
    setErr('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')

    const plaf = formData.type === 'CREDIT' && formData.plafondCredit
      ? Math.max(0, Number(formData.plafondCredit))
      : null

    const validationData = {
      code: formData.code.trim() || null,
      nom: formData.nom.trim(),
      telephone: formData.telephone.trim() || null,
      type: formData.type as 'CASH' | 'CREDIT',
      plafondCredit: plaf,
      ncc: formData.ncc.trim() || null,
      localisation: formData.localisation.trim() || null,
      soldeInitial: formData.soldeInitial ? Number(formData.soldeInitial) : 0,
      avoirInitial: formData.avoirInitial ? Number(formData.avoirInitial) : 0,
      email: formData.email.trim() || null,
    }

    const validation = validateForm(clientSchema, validationData)
    if (!validation.success) {
      setErr(validation.error)
      showError(validation.error)
      return
    }

    // Dans GestiCom Offline, l'enregistrement se fait toujours directement vers le serveur local.

    try {
      if (editing) {
        const res = await fetch(`/api/clients/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validationData),
        })
        const data = await res.json()
        if (res.ok) {
          setForm(false)
          setEditing(null)
          setCurrentPage(1)
          fetchList(1)
          showSuccess(MESSAGES.CLIENT_MODIFIE)
        } else {
          const errorMsg = formatApiError(data.error || 'Erreur lors de la modification.')
          setErr(errorMsg)
          showError(errorMsg)
        }
      } else {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validationData),
        })
        const data = await res.json()
        if (res.ok) {
          setForm(false)
          setCurrentPage(1)
          fetchList(1)
          showSuccess(MESSAGES.CLIENT_ENREGISTRE)
        } else {
          const errorMsg = formatApiError(data.error || 'Erreur lors de la création.')
          setErr(errorMsg)
          showError(errorMsg)
        }
      }
    } catch (e) {
      const errorMsg = formatApiError(e)
      setErr(errorMsg)
      showError(errorMsg)
    }
  }

  const fetchHistory = async (c: Client) => {
    setSelectedHistory({ id: c.id, nom: c.nom })
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/rapports/ventes/clients/${c.id}/history`)
      if (res.ok) {
        setHistoryData(await res.json())
      }
    } catch (e) {
      showError('Erreur chargement historique client.')
    } finally {
      setLoadingHistory(false)
    }
  }

  // T-1 AUDIT : handleUpdateDebt est désactivé car il modifiait soldeInitial directement,
  // ce qui corrompait tous les calculs de solde de façon cumulée et irréversible.
  // Pour ajuster une dette client, utiliser la modale de paiement (encaissement exceptionnel).
  const handleUpdateDebt = async (client: Client) => {
    showError('⛔ Correction directe de dette désactivée pour protéger l\'intégrité des données. Utilisez la modale de paiement (bouton 💰) pour enregistrer un règlement ou un avoir.')
    setEditingDebt(null)
    openPaymentModal(client)
  }

  const openPaymentModal = async (c: Client) => {
    try {
      const res = await fetch(`/api/rapports/finances/etat-paiements?type=VENTE&filter=NON_SOLDER&dateDebut=2000-01-01&dateFin=2100-12-31`)
      if (res.ok) {
        const allInvoices = await res.json()
        // T-11 AUDIT : Filtrage uniquement par ID client (robuste) — fallback nom supprimé (fragile en cas d'homonymie)
        const clientInvoices = allInvoices.filter((inv: any) => 
          inv.clientId === c.id || inv.client?.id === c.id
        )
        if (clientInvoices.length === 0) {
            showError("Aucune facture impayée trouvée pour ce client.")
            return
        }
        setPaymentModal({ client: c, invoices: clientInvoices })
      }
    } catch (e) {
      showError("Erreur lors de la récupération des factures.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Clients</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">
            Gestion du portefeuille clients et des soldes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportExcelButton 
            endpoint="/api/clients/import" 
            onSuccess={() => fetchList()}
          />
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (q) params.set('q', q)
              if (dateDebut) params.set('dateDebut', dateDebut)
              if (dateFin) params.set('dateFin', dateFin)
              window.location.href = `/api/clients/export-excel?${params.toString()}`
            }}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-orange-600 transition-colors shadow-sm"
          >
            <Download className="h-4 w-4" />
            Exporter Excel
          </button>
          <button
            onClick={() => openForm()}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Nouveau
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 bg-white/5 p-4 rounded-xl border border-white/10 no-print">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-black text-white uppercase mb-1">Recherche</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Nom, code, téléphone..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-gray-900"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-black text-white uppercase mb-1">Dette Depuis le</label>
          <input 
            type="date"
            value={dateDebut}
            onChange={e => setDateDebut(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 text-gray-900 w-40"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-white uppercase mb-1">Jusqu'au</label>
          <input 
            type="date"
            value={dateFin}
            onChange={e => setDateFin(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 text-gray-900 w-40"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handlePrintAll('PORTEFEUILLE')}
            disabled={isPrinting}
            className="flex items-center gap-2 rounded-lg border-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-800 hover:bg-emerald-100 shadow-md active:scale-95 disabled:opacity-50 h-[42px] uppercase"
            title="Imprimer le portefeuille financier"
          >
            {isPrinting && printType === 'PORTEFEUILLE' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            PORTEFEUILLE
          </button>
          <button
            type="button"
            onClick={() => handlePrintAll('REPERTOIRE')}
            disabled={isPrinting}
            className="flex items-center gap-2 rounded-lg border-2 border-blue-600 bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-800 hover:bg-blue-100 shadow-md active:scale-95 disabled:opacity-50 h-[42px] uppercase"
            title="Imprimer le répertoire des contacts"
          >
            {isPrinting && printType === 'REPERTOIRE' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            RÉPERTOIRE
          </button>
          {(dateDebut || dateFin) && (
            <button 
              onClick={() => { setDateDebut(''); setDateFin(''); }}
              className="bg-white/20 hover:bg-white/30 text-white rounded-lg px-3 py-2 text-[10px] font-black transition-all h-[42px] uppercase"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Titre Impression (Invisible à l'écran) */}
      <div className="hidden print:block mb-8 border-b-2 border-gray-900 pb-4 text-center">
        <h1 className="text-2xl font-black uppercase tracking-widest">Liste du Portefeuille Clients</h1>
        <p className="text-sm font-bold mt-2">Filtre : {q || 'Tous les clients'}</p>
        <p className="text-xs mt-1 italic text-gray-400 font-medium tracking-tight">Document généré par Gesticom le {new Date().toLocaleString()}</p>
      </div>

      {form && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {editing ? 'Modifier le client' : 'Nouveau client'}
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Code Client</label>
              <input
                value={formData.code}
                onChange={(e) => setFormData((f) => ({ ...f, code: e.target.value }))}
                placeholder="Ex: CLT001"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nom *</label>
              <input
                required
                value={formData.nom}
                onChange={(e) => setFormData((f) => ({ ...f, nom: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Téléphone</label>
              <input
                value={formData.telephone}
                onChange={(e) => setFormData((f) => ({ ...f, telephone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                placeholder="client@email.com"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type de Compte</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none bg-orange-50 font-bold"
              >
                <option value="CASH">CASH (Comptant)</option>
                <option value="CREDIT">CREDIT (Compte Client)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Plafond Crédit (F)</label>
              <input
                type="number"
                min="0"
                disabled={formData.type !== 'CREDIT'}
                value={formData.plafondCredit}
                onChange={(e) => setFormData((f) => ({ ...f, plafondCredit: e.target.value }))}
                placeholder="Plafond autorisé"
                className={`mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none ${formData.type !== 'CREDIT' ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-white'}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">NCC (N° Contribuable)</label>
              <input
                value={formData.ncc}
                onChange={(e) => setFormData((f) => ({ ...f, ncc: e.target.value }))}
                placeholder="Ex: 0000000X"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Localisation / Adresse</label>
              <input
                value={formData.localisation}
                onChange={(e) => setFormData((f) => ({ ...f, localisation: e.target.value }))}
                placeholder="Ville, Quartier, Rue..."
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 text-red-600 font-bold">Dette Initiale (F)</label>
              <input
                type="number"
                value={formData.soldeInitial}
                onChange={(e) => setFormData((f) => ({ ...f, soldeInitial: e.target.value }))}
                placeholder="Ce que le client vous doit"
                className="mt-1 w-full rounded-lg border border-red-200 px-3 py-2 focus:border-red-500 focus:outline-none bg-red-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-600 font-bold">Avoir Initial (F)</label>
              <input
                type="number"
                value={formData.avoirInitial}
                onChange={(e) => setFormData((f) => ({ ...f, avoirInitial: e.target.value }))}
                placeholder="Acompte / Avance existante"
                className="mt-1 w-full rounded-lg border border-emerald-200 px-3 py-2 focus:border-emerald-500 focus:outline-none bg-emerald-50"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600">
                {editing ? 'Enregistrer' : 'Créer'}
              </button>
              <button
                type="button"
                onClick={() => { setForm(false); setEditing(null); }}
                className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300"
              >
                Annuler
              </button>
            </div>
          </form>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : list.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Aucun client.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Tél.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">NCC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Localisation</th>
                   <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Plafond</th>
                  {dateDebut && dateFin && (
                    <th className="px-4 py-3 text-right text-xs font-black uppercase text-orange-700 bg-orange-50 italic border-x border-orange-100">Dette Période</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Solde Global {dateFin && `au ${new Date(dateFin).toLocaleDateString()}`}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {list.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-gray-600">{c.code || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.nom}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.telephone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${c.type === 'CREDIT' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                        {c.type}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-600">{c.ncc || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.localisation || '—'}</td>
                     <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {c.type === 'CREDIT' && c.plafondCredit != null
                        ? `${Number(c.plafondCredit).toLocaleString('fr-FR')} F`
                        : '—'}
                    </td>
                    {dateDebut && dateFin && (
                      <td className="px-4 py-3 text-right text-sm font-black tabular-nums bg-orange-50 text-orange-900 border-x border-orange-100 italic">
                        {((c as any).dettePeriode ?? 0).toLocaleString('fr-FR')} F
                      </td>
                    )}
                     <td className="px-4 py-3 text-right text-sm font-black tabular-nums">
                      {Number(c.dette ?? 0) > 0 ? (
                        <span className="text-red-600">+{Math.abs(c.dette || 0).toLocaleString('fr-FR')} F (Dette)</span>
                      ) : Number(c.dette ?? 0) < 0 ? (
                        <span className="text-green-600">-{Math.abs(c.dette || 0).toLocaleString('fr-FR')} F (Avoir)</span>
                      ) : (
                        <span className="text-gray-400">À jour</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                          <button
                            onClick={() => fetchHistory(c)}
                            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-green-600"
                            title="Aperçu rapide Historique"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => window.location.href = `/dashboard/clients/releves?id=${c.id}`}
                            className="rounded p-1.5 text-blue-500 hover:bg-blue-50"
                            title="Générer Relevé de compte détaillé (Période)"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          {Number(c.dette ?? 0) > 0 && (
                            <button
                              onClick={() => openPaymentModal(c)}
                              className="rounded p-1.5 text-green-600 hover:bg-green-50"
                              title="Solder / Encaisser règlement"
                            >
                              <DollarSign className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setRelanceModal({ id: c.id, nom: c.nom })}
                            className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50"
                            title="Relance Client (WhatsApp, Email, PDF)"
                          >
                            <Bell className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openForm(c)}
                            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-orange-600"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                          <button
                            onClick={() => handleDelete(c)}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                            title="Supprimer définitivement (Super Admin)"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {selectedHistory && (
        <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
          {/* Header avec Dégradé Professionnel */}
          <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-700 to-blue-900 text-white print:hidden">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {selectedHistory.nom}
              </h2>
              <p className="text-blue-100 text-xs uppercase tracking-widest font-bold">Historique Complet des Factures</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
              >
                <Download className="h-4 w-4" />
                Imprimer
              </button>
              <button onClick={() => setSelectedHistory(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6" id="printable-history">
            {/* Style d'impression caché à l'écran */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body * { visibility: hidden; }
                #printable-history, #printable-history * { visibility: visible; }
                #printable-history { position: absolute; left: 0; top: 0; width: 100%; }
                .no-print { display: none !important; }
              }
            ` }} />

            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 no-print">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-gray-500 text-sm italic font-medium tracking-tight">Analyse des flux financiers...</p>
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-20 text-gray-500 no-print">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                Aucune facture enregistrée pour ce client.
              </div>
            ) : (
              <div className="space-y-6">
                {/* En-tête Impression (Visible uniquement à l'impression) */}
                <div className="hidden print:block border-b-2 border-gray-900 pb-4 mb-6">
                    <h1 className="text-2xl font-bold uppercase">Historique des Facturations</h1>
                    <p className="text-lg font-medium">Client : {selectedHistory.nom}</p>
                    <p className="text-sm text-gray-600 italic">Édité le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</p>
                </div>

                {/* Synthèse Financière (Les Compteurs) */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-gray-900 rounded-xl p-4 text-white shadow-lg border-b-4 border-blue-500">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Total Facturé</p>
                    <p className="text-xl font-black italic tracking-tighter">
                      {historyData.reduce((acc, h) => acc + (h.montantTotal || 0), 0).toLocaleString()} F
                    </p>
                  </div>
                  <div className="bg-emerald-600 rounded-xl p-4 text-white shadow-lg border-b-4 border-emerald-800">
                    <p className="text-[10px] uppercase font-bold text-emerald-100">Total Payé</p>
                    <p className="text-xl font-black italic tracking-tighter">
                      {historyData.reduce((acc, h) => acc + (h.montantPaye || 0), 0).toLocaleString()} F
                    </p>
                  </div>
                  <div className="bg-red-600 rounded-xl p-4 text-white shadow-lg border-b-4 border-red-800">
                    <p className="text-[10px] uppercase font-bold text-red-100">Reste à Payer</p>
                    <p className="text-xl font-black italic tracking-tighter">
                      {(historyData.reduce((acc, h) => acc + (h.montantTotal || 0), 0) - historyData.reduce((acc, h) => acc + (h.montantPaye || 0), 0)).toLocaleString()} F
                    </p>
                  </div>
                </div>

                {/* Liste des Factures - Design Professionnel */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest border-l-4 border-blue-600 pl-3">Détail chronologique</h3>
                  {historyData.map((h, i) => (
                    <div key={i} className="border-2 border-gray-100 rounded-2xl p-5 bg-white hover:border-blue-200 hover:shadow-xl transition-all group relative overflow-hidden">
                      {/* Badge Statut en filigrane */}
                      <div className="absolute top-2 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                         <FileText className="h-16 w-16 -rotate-12" />
                      </div>

                      <div className="flex items-center justify-between mb-4 relative z-10">
                         <div>
                            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter mb-1 inline-block">FACT. {h.numero}</span>
                            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                               <Calendar className="h-3 w-3" />
                               {new Date(h.date).toLocaleDateString('fr-FR')}
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-xl font-black text-gray-900 tracking-tighter italic">{h.montantTotal.toLocaleString()} F</p>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${h.statutPaiement === 'PAYE' ? 'bg-green-100 text-green-800 border-green-200 border' : 'bg-red-100 text-red-800 border-red-200 border'}`}>
                              {h.statutPaiement === 'PAYE' ? 'SÉCURISÉ ✅' : 'IMPAYÉ ⏳'}
                            </span>
                         </div>
                      </div>

                      {/* Lignes de Détail (Micro-design) */}
                      <div className="space-y-2 mt-4 bg-gray-50/50 p-3 rounded-xl border border-dashed border-gray-200">
                        {h.lignes && h.lignes.length > 0 ? h.lignes.map((l: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] font-medium text-gray-700">
                            <span className="flex-1">
                               <span className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded font-black mr-2 italic">{l.quantite}</span>
                               {l.produit?.designation || l.designation}
                            </span>
                            <span className="text-gray-900 font-bold">{(l.quantite * l.prixUnitaire).toLocaleString()} F</span>
                          </div>
                        )) : (
                          <p className="text-[10px] text-gray-400 italic">Détails indisponibles</p>
                        )}
                      </div>

                      {/* Footer de Facture */}
                      <div className="mt-4 pt-3 flex items-center justify-between text-[10px] border-t border-gray-100 no-print">
                         <div className="flex items-center gap-4">
                            <span className="text-gray-400 italic">Encaissement : <span className="text-gray-700 font-bold uppercase">{h.modePaiement}</span></span>
                            <span className="text-gray-400 italic">Réglé : <span className="text-emerald-700 font-bold">{(h.montantPaye || 0).toLocaleString()} F</span></span>
                         </div>
                         <button 
                          onClick={() => window.location.href = `/dashboard/ventes?numero=${h.numero}`}
                          className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all font-bold tracking-tighter uppercase"
                         >
                          Visualiser <ChevronRight className="h-3 w-3" />
                         </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pied de page Impression */}
                <div className="hidden print:block mt-12 border-t pt-4 text-center text-[10px] text-gray-500 italic">
                    Généré par GestiCom Pro - Logiciel de Gestion Commerciale Expert.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Relance Modal */}
      {relanceModal && (
        <RelanceModal
          isOpen={!!relanceModal}
          onClose={() => setRelanceModal(null)}
          clientId={relanceModal.id}
          tierNom={relanceModal.nom}
        />
      )}

      {paymentModal && (
        <PaymentModal
          isOpen={!!paymentModal}
          onClose={() => setPaymentModal(null)}
          onSuccess={() => fetchList()}
          type="VENTE"
          tierId={paymentModal.client.id}
          tierNom={paymentModal.client.nom}
          totalDu={paymentModal.client.dette || 0}
          invoices={paymentModal.invoices}
        />
      )}
      
      {/* MODALE D'APERÇU IMPRESSION CLIENTS */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
            <div className="flex items-center gap-6">
               <div>
                 <h2 className="text-2xl font-black text-gray-900 uppercase italic">Aperçu Impression</h2>
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">{printType === 'PORTEFEUILLE' ? 'Liste du Portefeuille Clients' : 'Répertoire des Contacts'}</p>
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
            <div className="flex gap-4">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase tracking-widest"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl bg-orange-600 px-10 py-2 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 uppercase tracking-widest"
              >
                <Printer className="h-4 w-4" />
                Lancer l'impression
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
            <div className={`mx-auto shadow-2xl bg-white ${printLayout === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]'}`}>
              {chunkArray(allClientsForPrint.length > 0 ? allClientsForPrint : list, 25).map((chunk, index, allChunks) => (
                <div key={index} className={index < allChunks.length - 1 ? 'page-break mb-8 border-b-2 border-dashed border-gray-100 pb-8' : ''}>
                  <ListPrintWrapper
                    title={printType === 'PORTEFEUILLE' ? "Portefeuille des Clients" : "Répertoire des Clients"}
                    subtitle={q ? `Filtre: "${q}"` : "Contenu Global"}
                    pageNumber={index + 1}
                    totalPages={allChunks.length}
                    layout={printLayout}
                  >
                    <table className="w-full text-[14px] border-collapse border-2 border-black">
                      <thead>
                        <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                          <th className="border-r-2 border-black px-2 py-3 text-center w-10">N°</th>
                          {printType === 'PORTEFEUILLE' ? (
                            <>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Code</th>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Nom</th>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Type</th>
                              {dateDebut && dateFin && (
                                <th className="border-r-2 border-black px-3 py-3 text-right">Dette Période</th>
                              )}
                              <th className="px-3 py-3 text-right">Solde Global</th>
                            </>
                          ) : (
                            <>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Nom</th>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Téléphone</th>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Email</th>
                              <th className="border-r-2 border-black px-3 py-3 text-left text-xs italic">Localisation</th>
                              <th className="px-3 py-3 text-left">NCC</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {chunk.map((c, idx) => (
                          <tr key={idx} className="border-b border-black">
                            <td className="border-r-2 border-black px-2 py-2 text-center font-bold">
                              {index * 25 + idx + 1}
                            </td>
                            {printType === 'PORTEFEUILLE' ? (
                              <>
                                <td className="border-r-2 border-black px-3 py-2 font-mono">{c.code || '-'}</td>
                                <td className="border-r-2 border-black px-3 py-2 font-bold uppercase">{c.nom}</td>
                                <td className="border-r-2 border-black px-3 py-2 font-medium">{c.type}</td>
                                {dateDebut && dateFin && (
                                  <td className="border-r-2 border-black px-3 py-2 text-right font-black bg-orange-50/50 italic text-[11px]">
                                    {((c as any).dettePeriode ?? 0).toLocaleString('fr-FR')} F
                                  </td>
                                )}
                                <td className={`px-3 py-2 text-right font-black ${Number(c.dette ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                  {Number(c.dette ?? 0) > 0 ? '+' : ''}{Number(c.dette ?? 0).toLocaleString('fr-FR')} F
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="border-r-2 border-black px-3 py-2 font-bold uppercase">{c.nom}</td>
                                <td className="border-r-2 border-black px-3 py-2">{c.telephone || '-'}</td>
                                <td className="border-r-2 border-black px-3 py-2 text-xs truncate max-w-[150px]">{c.email || '-'}</td>
                                <td className="border-r-2 border-black px-3 py-2 italic text-xs">{c.localisation || '-'}</td>
                                <td className="px-3 py-2 text-xs">{c.ncc || '-'}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      {index === allChunks.length - 1 && (
                        <tfoot>
                          <tr className="bg-gray-100 font-black text-[14px] border-t-2 border-black uppercase italic">
                            {printType === 'PORTEFEUILLE' ? (
                              <>
                                <td colSpan={dateDebut && dateFin ? 4 : 4} className="border-r-2 border-black px-3 py-5 text-right bg-white tracking-widest text-xs italic">SITUATION DU PORTEFEUILLE</td>
                                {dateDebut && dateFin && (
                                  <td className="border-r-2 border-black px-3 py-4 text-right bg-orange-100/50 text-orange-900 font-black text-[12px]">
                                    PÉRIODE: {(allClientsForPrint.length > 0 ? allClientsForPrint : list).reduce((acc, c) => acc + ((c as any).dettePeriode ?? 0), 0).toLocaleString()} F
                                  </td>
                                )}
                                <td className="px-3 py-4 text-right bg-white text-sm">
                                  <div className="flex flex-col gap-1 items-end">
                                    <div className="border-t-2 border-black pt-1 font-black underline decoration-double text-slate-900 text-lg">
                                      {(allClientsForPrint.length > 0 ? allClientsForPrint : list).reduce((acc, c) => acc + (c.dette ?? 0), 0).toLocaleString()} F
                                    </div>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <td colSpan={6} className="px-3 py-8 text-center bg-white tracking-[0.2em] font-black text-slate-900 italic text-lg shadow-inner">
                                RÉPERTOIRE : {(allClientsForPrint.length > 0 ? allClientsForPrint : list).length} CONTACTS
                              </td>
                            )}
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
      <div className="hidden print:block">
        {chunkArray(allClientsForPrint.length > 0 ? allClientsForPrint : list, 25).map((chunk, index, allChunks) => (
          <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
            <ListPrintWrapper
              title={printType === 'PORTEFEUILLE' ? "Portefeuille des Clients" : "Répertoire des Clients"}
              subtitle={q ? `Filtre: "${q}"` : "Portefeuille Global"}
              pageNumber={index + 1}
              totalPages={allChunks.length}
              layout={printLayout}
            >
              <table className="w-full text-[14px] border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 uppercase font-black text-gray-700">
                    <th className="border border-gray-300 px-2 py-3 text-center w-10">N°</th>
                    {printType === 'PORTEFEUILLE' ? (
                      <>
                        <th className="border border-gray-300 px-3 py-3 text-left">Code</th>
                        <th className="border border-gray-300 px-3 py-3 text-left">Nom</th>
                        <th className="border border-gray-300 px-3 py-3 text-left">Type</th>
                        {dateDebut && dateFin && (
                          <th className="border border-gray-300 px-3 py-3 text-right">Dette Période</th>
                        )}
                        <th className="border border-gray-300 px-3 py-3 text-right">Solde Global</th>
                      </>
                    ) : (
                      <>
                        <th className="border border-gray-300 px-3 py-3 text-left">Nom</th>
                        <th className="border border-gray-300 px-3 py-3 text-left">Téléphone</th>
                        <th className="border border-gray-300 px-3 py-3 text-left">Email</th>
                        <th className="border border-gray-300 px-3 py-3 text-left">Localisation</th>
                        <th className="border border-gray-300 px-3 py-3 text-left">NCC</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((c, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="border border-gray-300 px-2 py-2 text-center font-bold">
                        {index * 25 + idx + 1}
                      </td>
                      {printType === 'PORTEFEUILLE' ? (
                        <>
                          <td className="border border-gray-300 px-3 py-2 font-mono">{c.code || '-'}</td>
                          <td className="border border-gray-300 px-3 py-2 font-bold uppercase">{c.nom}</td>
                          <td className="border border-gray-300 px-3 py-2 font-medium">{c.type}</td>
                          {dateDebut && dateFin && (
                            <td className="border border-gray-300 px-3 py-2 text-right font-black bg-orange-50 italic text-[11px]">
                              {((c as any).dettePeriode ?? 0).toLocaleString('fr-FR')} F
                            </td>
                          )}
                          <td className={`border border-gray-300 px-3 py-2 text-right font-black ${Number(c.dette ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {Number(c.dette ?? 0) > 0 ? '+' : ''}{Number(c.dette ?? 0).toLocaleString('fr-FR')} F
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="border border-gray-300 px-3 py-2 font-bold uppercase">{c.nom}</td>
                          <td className="border border-gray-300 px-3 py-2">{c.telephone || '-'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-xs truncate max-w-[150px]">{c.email || '-'}</td>
                          <td className="border border-gray-300 px-3 py-2 italic text-xs">{c.localisation || '-'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-xs">{c.ncc || '-'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                {index === allChunks.length - 1 && (
                  <tfoot>
                    <tr className="bg-gray-100 font-black text-[14px] border-t-2 border-black uppercase italic">
                      {printType === 'PORTEFEUILLE' ? (
                        <>
                          <td colSpan={dateDebut && dateFin ? 4 : 4} className="border border-gray-300 px-3 py-4 text-right bg-white tracking-widest text-xs italic">TOTAL GÉNÉRAL DU PORTEFEUILLE</td>
                          {dateDebut && dateFin && (
                            <td className="border border-gray-300 px-3 py-4 text-right bg-orange-100 text-orange-900 font-black text-[12px]">
                              DETTE PÉRIODE: {(allClientsForPrint.length > 0 ? allClientsForPrint : list).reduce((acc, c) => acc + ((c as any).dettePeriode ?? 0), 0).toLocaleString()} F
                            </td>
                          )}
                          <td className="border border-gray-300 px-3 py-4 text-right bg-white text-sm">
                            <div className="flex flex-col gap-1 items-end">
                              <span className="text-red-700 text-xs">CRÉANCES: {(allClientsForPrint.length > 0 ? allClientsForPrint : list).filter(c => (c.dette ?? 0) > 0).reduce((acc, c) => acc + (c.dette ?? 0), 0).toLocaleString()} F</span>
                              <span className="text-emerald-700 text-xs">AVOIRS: {Math.abs((allClientsForPrint.length > 0 ? allClientsForPrint : list).filter(c => (c.dette ?? 0) < 0).reduce((acc, c) => acc + (c.dette ?? 0), 0)).toLocaleString()} F</span>
                              <div className="border-t border-black mt-1 pt-1 font-black underline decoration-double text-slate-900">
                                NET: {((allClientsForPrint.length > 0 ? allClientsForPrint : list).reduce((acc, c) => acc + (c.dette ?? 0), 0)).toLocaleString()} F
                              </div>
                            </div>
                          </td>
                        </>
                      ) : (
                        <td colSpan={6} className="border border-gray-300 px-3 py-6 text-center bg-white tracking-[0.2em] font-black text-gray-500 italic">
                          TOTAL RÉPERTOIRE : {(allClientsForPrint.length > 0 ? allClientsForPrint : list).length} CLIENTS ENREGISTRÉS
                        </td>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            </ListPrintWrapper>
          </div>
        ))}
      </div>

    </div>
  )
}
