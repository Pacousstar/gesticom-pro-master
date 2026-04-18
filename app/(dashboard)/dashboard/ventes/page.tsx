'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { 
  ShoppingBag, Plus, Loader2, FileSpreadsheet, Search, Filter, 
  Calendar, CreditCard, ChevronRight, Wallet
} from 'lucide-react'

// Library & Components
import { printDocument, generateLignesHTML, type TemplateData } from '@/lib/print-templates'
import PrintPreview from '@/components/print/PrintPreview'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'
import { MESSAGES } from '@/lib/messages'
import { formatDate } from '@/lib/format-date'

// New Sub-components
import { Magasin, Client, Produit, Vente, VenteDetail } from './components/types'
import VenteTable from './components/VenteTable'
import VenteForm from './components/VenteForm'
import VenteDetailModal from './components/VenteDetailModal'
import { ClientCreateModal, ReglementModal, StockInsuffisantModal } from './components/Modals'

export default function VentesPageOrchestrator() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8 text-orange-500" /></div>}>
      <VentesPage />
    </Suspense>
  )
}

function VentesPage() {
  const searchParams = useSearchParams()
  const openIdParam = searchParams.get('open')
  const { success: showSuccess, error: showError } = useToast()

  // --- States ---
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [ventes, setVentes] = useState<Vente[]>([])
  const [userRole, setUserRole] = useState<string>('')
  
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingVente, setEditingVente] = useState<any>(null)
  const [detailVente, setDetailVente] = useState<VenteDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null)
  
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<any>(null)
  const [totals, setTotals] = useState<any>(null)
  
  const [filters, setFilters] = useState({ dateDebut: '', dateFin: '', clientId: '' })
  const [tvaParDefaut, setTvaParDefaut] = useState(0)
  const [defaultTemplateId, setDefaultTemplateId] = useState<number | null>(null)
  
  // Modals visibility
  const [showReglement, setShowReglement] = useState<any>(null)
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [createClientAfter, setCreateClientAfter] = useState<(() => void) | null>(null)
  const [stockAlert, setStockAlert] = useState<any>(null)
  const [annulant, setAnnulant] = useState<number | null>(null)
  const [supprimant, setSupprimant] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const [printData, setPrintData] = useState<TemplateData | null>(null)

  // --- Initial Loads ---
  useEffect(() => {
    fetch('/api/parametres').then(r => r.ok && r.json()).then(d => { 
      if (d) setTvaParDefaut(Number(d.tvaParDefaut) || 0)
    }).catch(() => { })
    
    fetch('/api/auth/check').then((r) => r.ok && r.json()).then((d) => d && setUserRole(d.role)).catch(() => { })
    
    fetch('/api/print-templates?type=VENTE&actif=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((templates) => {
        const active = templates.find((t: any) => t.actif)
        if (active) setDefaultTemplateId(active.id)
      }).catch(() => { })

    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    const [m, c, p] = await Promise.all([
      fetch('/api/magasins').then(r => r.ok ? r.json() : []),
      fetch('/api/clients?limit=1000').then(r => r.ok ? r.json() : []),
      fetch('/api/produits?complet=1').then(r => r.ok ? r.json() : []),
    ])
    setMagasins(m)
    setClients(c.data || c)
    setProduits(p)
  }

  const fetchVentes = async (page = currentPage) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filters.dateDebut) params.set('dateDebut', filters.dateDebut)
      if (filters.dateFin) params.set('dateFin', filters.dateFin)
      if (filters.clientId) params.set('clientId', filters.clientId)
      
      const res = await fetch('/api/ventes?' + params.toString())
      const data = await res.json()
      setVentes(data.data || [])
      setPagination(data.pagination)
      setTotals(data.totals)
    } catch {
      showError("Erreur lors du chargement des ventes.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVentes() }, [currentPage, filters])

  // --- Handlers ---
  const handleVoirDetail = async (id: number) => {
    setLoadingDetail(id)
    try {
      const res = await fetch(`/api/ventes/${id}`)
      if (res.ok) {
        const data = await res.json()
        setDetailVente(data)
      } else {
        showError("Détails introuvables.")
      }
    } catch {
      showError("Erreur réseau.")
    } finally {
      setLoadingDetail(null)
    }
  }

  const handleEnregistrerVente = async (formData: any) => {
    setSubmitting(true)
    const url = editingVente ? `/api/ventes/${editingVente.id}` : '/api/ventes'
    const method = editingVente ? 'PUT' : 'POST'
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (res.ok) {
        showSuccess(editingVente ? "Vente mise à jour !" : "Vente enregistrée !")
        setFormOpen(false)
        setEditingVente(null)
        fetchVentes(1)
      } else {
        if (data.error?.includes('Stock insuffisant')) {
          // Extraire les infos pour la modale stock
          const match = data.error.match(/Stock insuffisant pour (.+?) \((\d+) dispo/i)
          if (match) {
             setStockAlert({
               produitId: formData.lignes.find((l: any) => l.designation === match[1])?.produitId,
               produitDesignation: match[1],
               quantiteDisponible: Number(match[2]),
               quantiteDemandee: formData.lignes.find((l: any) => l.designation === match[1])?.quantite,
               magasinId: formData.magasinId,
               lignes: formData.lignes
             })
          } else {
             showError(data.error)
          }
        } else {
           showError(data.error || "Une erreur est survenue.")
        }
      }
    } catch {
      showError("Erreur lors de l'envoi.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnnulerVente = async (v: Vente) => {
    if (!confirm(`Voulez-vous vraiment annuler la vente ${v.numero} ? Cette action réintégrera le stock.`)) return
    setAnnulant(v.id)
    try {
      const res = await fetch(`/api/ventes/${v.id}/annuler`, { method: 'POST' })
      if (res.ok) {
        showSuccess("Vente annulée.")
        fetchVentes()
      } else {
        const d = await res.json()
        showError(d.error || "Erreur lors de l'annulation.")
      }
    } catch {
      showError("Erreur réseau.")
    } finally {
      setAnnulant(null)
    }
  }

  const handleSupprimerVente = async (v: Vente) => {
    if (!confirm(`ATTENTION SUPPRESSION DÉFINITIVE de ${v.numero}. Aucune trace comptable ne sera gardée.`)) return
    if (v.statut !== 'ANNULEE' && !confirm("La vente n'est pas annulée. Continuer quand même ?")) return
    setSupprimant(v.id)
    try {
      const res = await fetch(`/api/ventes/${v.id}`, { method: 'DELETE' })
      if (res.ok) {
        showSuccess("Vente supprimée.")
        fetchVentes()
      } else {
        showError("Erreur lors de la suppression.")
      }
    } catch {
      showError("Erreur réseau.")
    } finally {
      setSupprimant(null)
    }
  }

  const handleCreateClient = async (form: any) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        showSuccess("Client créé !")
        const newClient = await res.json()
        setClients(prev => [...prev, newClient])
        setShowCreateClient(false)
        if (createClientAfter) createClientAfter()
      } else {
        showError("Erreur lors de la création du client.")
      }
    } catch {
      showError("Erreur réseau.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReglement = async (venteId: number, montant: number, mode: string, date: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ventes/${venteId}/reglement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ montant, modePaiement: mode, date })
      })
      if (res.ok) {
        showSuccess("Règlement enregistré !")
        setShowReglement(null)
        fetchVentes()
      } else {
        const d = await res.json()
        showError(d.error || "Erreur règlement.")
      }
    } catch {
      showError("Erreur réseau.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddStock = async (qte: number) => {
    if (!stockAlert) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/stock/entree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produitId: stockAlert.produitId,
          magasinId: stockAlert.magasinId,
          quantite: qte,
          motif: "Ajustement rapide avant vente",
          date: new Date().toISOString().split('T')[0]
        })
      })
      if (res.ok) {
        showSuccess("Stock ajusté !")
        setStockAlert(null)
        // Re-tenter l'enregistrement peut être complexe ici car on a perdu le contexte du formulaire
        // On demande juste de re-cliquer sur Valider
        fetchInitialData()
      } else {
        showError("Erreur lors de l'ajustement du stock.")
      }
    } catch {
      showError("Erreur réseau.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleImprimer = () => {
    if (!detailVente) return
    const d = detailVente
    // Logique simplifiée d'impression (on réutilise le code précédent)
    const templateData: TemplateData = {
      NUMERO: d.numero,
      DATE: formatDate(d.date),
      TOTAL: `${d.montantTotal.toLocaleString()} F`,
      CLIENT_NOM: d.client?.nom || d.clientLibre || '—',
      MODE_PAIEMENT: d.modePaiement,
      LIGNES: generateLignesHTML(d.lignes as any)
    }
    setPrintData(templateData)
    setPrintPreviewOpen(true)
  }

  // --- Effects for URL params ---
  useEffect(() => {
    if (openIdParam) handleVoirDetail(Number(openIdParam))
  }, [openIdParam])

  return (
    <div className="space-y-6">
      {/* Header & Stats Rapidement */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
            <ShoppingBag className="text-orange-500" /> Gestion des Ventes
          </h1>
          <p className="text-sm text-gray-500">Gérez vos factures et règlements clients.</p>
        </div>
        <div className="flex gap-2">
          {!formOpen && (
            <button
              onClick={() => { setEditingVente(null); setFormOpen(true); }}
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-orange-900/10 transition-transform hover:scale-105 active:scale-95"
            >
              <Plus className="h-5 w-5" /> Nouvelle Vente
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Chiffre d'Affaires", val: `${(totals?.montantTotal || 0).toLocaleString()} F`, color: "bg-blue-600", icon: ShoppingBag },
          { label: "Total Encaissé", val: `${(totals?.montantPaye || 0).toLocaleString()} F`, color: "bg-emerald-600", icon: CreditCard },
          { label: "Reste à Recouvrer", val: `${(totals?.resteAPayer || 0).toLocaleString()} F`, color: "bg-orange-600", icon: Wallet },
          { label: "Ventes Totales", val: pagination?.total || 0, color: "bg-indigo-600", icon: FileSpreadsheet },
        ].map((c, i) => (
          <div key={i} className={`rounded-3xl ${c.color} p-6 h-32 text-white shadow-xl flex flex-col justify-between`}>
             <div className="flex items-center justify-between opacity-80">
                <span className="text-xs font-bold uppercase tracking-wider">{c.label}</span>
                <c.icon className="h-5 w-5" />
             </div>
             <div className="text-2xl font-black">{c.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input type="date" value={filters.dateDebut} onChange={e => setFilters(f => ({ ...f, dateDebut: e.target.value }))} className="rounded border border-gray-200 px-3 py-1.5 text-sm" />
          <ChevronRight className="h-3 w-3 text-gray-400" />
          <input type="date" value={filters.dateFin} onChange={e => setFilters(f => ({ ...f, dateFin: e.target.value }))} className="rounded border border-gray-200 px-3 py-1.5 text-sm" />
        </div>
        <select value={filters.clientId} onChange={e => setFilters(f => ({ ...f, clientId: e.target.value }))} className="rounded border border-gray-200 px-3 py-1.5 text-sm">
          <option value="">Tous les clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <button onClick={() => setFilters({ dateDebut: '', dateFin: '', clientId: '' })} className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600">
           <Filter className="h-4 w-4" /> Reset
        </button>
      </div>

      {formOpen ? (
        <VenteForm 
          initialData={editingVente}
          magasins={magasins}
          clients={clients}
          produits={produits}
          tvaParDefaut={tvaParDefaut}
          submitting={submitting}
          onClose={() => setFormOpen(false)}
          onSubmit={handleEnregistrerVente}
          onOpenCreateClient={(after) => { setShowCreateClient(true); setCreateClientAfter(() => after); }}
          onRefetchProduits={fetchInitialData}
        />
      ) : (
        <VenteTable 
          ventes={ventes}
          loading={loading}
          pagination={pagination}
          totals={totals}
          userRole={userRole}
          loadingDetail={loadingDetail}
          annulant={annulant}
          supprimant={supprimant}
          onPageChange={setCurrentPage}
          onVoirDetail={handleVoirDetail}
          onModifier={(v) => { setEditingVente(v); setFormOpen(true); }}
          onAnnuler={handleAnnulerVente}
          onSupprimer={handleSupprimerVente}
          onReglement={(v) => setShowReglement({ id: v.id, numero: v.numero, reste: (v.montantTotal - (v.montantPaye || 0)) })}
        />
      )}

      {/* Modals */}
      {detailVente && (
        <VenteDetailModal 
          detailVente={detailVente}
          userRole={userRole}
          onClose={() => setDetailVente(null)}
          onImprimer={handleImprimer}
          onModifier={(v) => { setEditingVente(v); setFormOpen(true); setDetailVente(null); }}
          onReglement={(id, numero, reste) => { setShowReglement({ id, numero, reste }); setDetailVente(null); }}
        />
      )}

      {showReglement && (
        <ReglementModal 
          data={showReglement}
          onClose={() => setShowReglement(null)}
          onSave={handleReglement}
          saving={submitting}
        />
      )}

      {showCreateClient && (
        <ClientCreateModal 
          onClose={() => setShowCreateClient(false)}
          onSave={handleCreateClient}
          saving={submitting}
        />
      )}

      {stockAlert && (
        <StockInsuffisantModal 
          data={stockAlert}
          onClose={() => setStockAlert(null)}
          onSave={handleAddStock}
          saving={submitting}
        />
      )}

      {printData && (
        <PrintPreview 
          isOpen={printPreviewOpen}
          onClose={() => setPrintPreviewOpen(false)}
          type="VENTE"
          data={printData}
          defaultTemplateId={defaultTemplateId}
        />
      )}
    </div>
  )
}
