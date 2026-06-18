'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, X, Filter, Loader2, Truck, ShoppingBag, Printer, ExternalLink, ArrowLeft } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { VenteTableRow } from '@/components/dashboard/ventes/VenteTableRow'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { paginateForPrint } from '@/lib/print-helpers'
import { formatDate } from '@/lib/format-date'
import { formatApiError } from '@/lib/validation-helpers'
import { useToast } from '@/hooks/useToast'

export default function SuiviVentesPage() {
  const { success: showSuccess, error: showError } = useToast()
  const pathname = usePathname()

  const [ventes, setVentes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null)
  const [allVentesForPrint, setAllVentesForPrint] = useState<any[]>([])
  const [isPrinting, setIsPrinting] = useState(false)

  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [searchNumero, setSearchNumero] = useState('')
  const [searchClient, setSearchClient] = useState('')
  const router = useRouter()
  const [statutSuivi, setStatutSuivi] = useState('')

  const [detailVente, setDetailVente] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null)
  const [annulant, setAnnulant] = useState<number | null>(null)
  const [livrant, setLivrant] = useState<number | null>(null)

  const [deliverVente, setDeliverVente] = useState<any>(null)
  const [deliverQtys, setDeliverQtys] = useState<Record<number, number>>({})
  const [savingDeliver, setSavingDeliver] = useState(false)

  const [userRole, setUserRole] = useState('')
  const [supprimant, setSupprimant] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setUserRole(d.role || '')
    })
  }, [])

  const fetchVentes = useCallback(async (page = currentPage) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: 'suivi', page: String(page), limit: '20' })
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)
      if (searchNumero) params.set('numero', searchNumero)
      if (searchClient) params.set('clientSearch', searchClient)

      const res = await fetch(`/api/ventes?${params}`)
      if (!res.ok) throw new Error('Erreur chargement')
      const d = await res.json()
      setVentes(d.data || [])
      setPagination(d.pagination)
    } catch (e) {
      showError(formatApiError(e))
    } finally {
      setLoading(false)
    }
  }, [dateDebut, dateFin, searchNumero, searchClient, currentPage])

  useEffect(() => { fetchVentes() }, [fetchVentes])

  const handleVoirDetail = async (id: number) => {
    setLoadingDetail(id)
    try {
      const res = await fetch(`/api/ventes/${id}`)
      if (res.ok) setDetailVente(await res.json())
    } catch { /* ignore */ }
    finally { setLoadingDetail(null) }
  }

  const handleAnnuler = async (v: { id: number; numero: string }) => {
    if (!confirm(`Annuler ${v.numero} ? Le stock sera recrédité.`)) return
    setAnnulant(v.id)
    try {
      const res = await fetch(`/api/ventes/${v.id}/annuler`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (res.ok) { showSuccess('Vente annulée.'); fetchVentes(); if (detailVente?.id === v.id) setDetailVente(null) }
      else { const d = await res.json(); showError(d.error || 'Erreur') }
    } catch (e) { showError(formatApiError(e)) }
    finally { setAnnulant(null) }
  }

  const handleSupprimer = async (v: { id: number; numero: string }) => {
    if (!confirm(`SUPPRESSION DÉFINITIVE de ${v.numero} ? Cette action est irréversible.`)) return
    setSupprimant(v.id)
    try {
      const res = await fetch(`/api/ventes/${v.id}`, { method: 'DELETE' })
      if (res.ok) { showSuccess('Vente supprimée.'); fetchVentes(); if (detailVente?.id === v.id) setDetailVente(null) }
      else { const d = await res.json(); showError(d.error || 'Erreur') }
    } catch (e) { showError(formatApiError(e)) }
    finally { setSupprimant(null) }
  }

  const handleLivrer = (v: any) => {
    if (!v.lignes) return
    const initial: Record<number, number> = {}
    v.lignes.forEach((l: any) => {
      const reste = l.quantite - (l.quantiteLivree || 0)
      if (reste > 0) initial[l.produitId] = reste
    })
    setDeliverQtys(initial)
    setDeliverVente(v)
  }

  const confirmDeliver = async () => {
    if (!deliverVente) return
    setSavingDeliver(true)
    setLivrant(deliverVente.id)
    try {
      const lignesLivrees = Object.entries(deliverQtys).filter(([, q]) => Number(q) > 0).map(([produitId, quantite]) => ({ produitId: Number(produitId), quantite: Number(quantite) }))
      const res = await fetch(`/api/ventes/${deliverVente.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LIVRER', lignes: lignesLivrees }),
      })
      if (res.ok) { setDeliverVente(null); showSuccess('Livraison effectuée.'); fetchVentes(); if (detailVente?.id === deliverVente.id) handleVoirDetail(deliverVente.id) }
      else { const d = await res.json(); showError(d.error || 'Erreur') }
    } catch (e) { showError(formatApiError(e)) }
    finally { setLivrant(null); setSavingDeliver(false) }
  }

  const handleRetrait = (v: { id: number }) => {
    router.push(`/dashboard/ventes/retraits?venteId=${v.id}`)
  }

  const handlePrintAll = async () => {
    setIsPrinting(true)
    try {
      const params = new URLSearchParams({ type: 'suivi', limit: '10000', page: '1' })
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)
      if (searchNumero) params.set('numero', searchNumero)
      if (searchClient) params.set('clientSearch', searchClient)
      const res = await fetch(`/api/ventes?${params}`)
      if (res.ok) {
        const d = await res.json()
        setAllVentesForPrint(d.data || [])
        setTimeout(() => { window.print(); setIsPrinting(false) }, 500)
      } else {
        setIsPrinting(false)
      }
    } catch (e) {
      console.error(e)
      setIsPrinting(false)
    }
  }

  const computedStatus = (v: any): string => {
    if (v.statut === 'ANNULEE') return 'annulee'
    const totalQ = v.lignes?.reduce((s: number, l: any) => s + Number(l.quantite || 0), 0) || 0
    const totalL = v.lignes?.reduce((s: number, l: any) => s + Number(l.quantiteLivree || 0), 0) || 0
    if (v.typeVente === 'COMMANDE') {
      if (v.dateLivraison || totalL >= totalQ) return 'soldee'
      if (totalL > 0) return 'partiel'
      return 'en_attente'
    }
    if (v.retraitDiffere) {
      if (totalL >= totalQ) return 'soldee'
      if (totalL > 0) return 'partiel'
      return 'en_attente'
    }
    return 'soldee'
  }

  const stats = ventes.reduce((acc, v) => {
    const s = computedStatus(v)
    if (s === 'en_attente') { if (v.typeVente === 'COMMANDE') acc.commandesEnAttente++; else acc.retraitsEnAttente++ }
    else if (s === 'partiel') acc.partiel++
    else if (s === 'soldee') acc.soldees++
    return acc
  }, { commandesEnAttente: 0, retraitsEnAttente: 0, partiel: 0, soldees: 0, retires: 0 })

  const ventesFiltrees = statutSuivi ? ventes.filter(v => computedStatus(v) === statutSuivi) : ventes

  const formatStatutSuivi = (v: any) => {
    const s = computedStatus(v)
    if (s === 'en_attente') return v.typeVente === 'COMMANDE' ? 'Commande en attente' : 'Retrait en attente'
    if (s === 'partiel') return v.typeVente === 'COMMANDE' ? 'Livraison partielle' : 'Retrait partiel'
    if (s === 'soldee') return 'Soldée'
    if (s === 'annulee') return 'Annulée'
    return ''
  }

  const statutColor = (v: any) => {
    const s = computedStatus(v)
    if (s === 'en_attente') return v.typeVente === 'COMMANDE' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'
    if (s === 'partiel') return 'bg-blue-100 text-blue-800'
    if (s === 'soldee') return 'bg-green-100 text-green-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-700 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/ventes')} className="rounded-lg bg-white/10 hover:bg-white/20 p-2 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Suivi des commandes et retraits
            </h1>
          </div>
          <button
            type="button"
            onClick={handlePrintAll}
            disabled={isPrinting}
            className="no-print flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 disabled:opacity-50"
            title="Imprimer la liste de suivi"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {isPrinting ? 'Préparation...' : 'Imprimer'}
          </button>
        </div>

        {/* Sous-navigation ventes */}
        <div className="flex flex-wrap gap-1 no-print">
          {[
            { href: '/dashboard/ventes', label: 'Ventes' },
            { href: '/dashboard/ventes/toute', label: 'Toutes' },
            { href: '/dashboard/ventes/rapide', label: 'Rapide' },
            { href: '/dashboard/ventes/commandes', label: 'Commandes' },
            { href: '/dashboard/ventes/retours', label: 'Retours' },
            { href: '/dashboard/ventes/retraits', label: 'Retraits' },
            { href: '/dashboard/ventes/suivi', label: 'Suivi' },
            { href: '/dashboard/ventes/historiques', label: 'Historiques' },
          ].map((tab) => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  active
                    ? 'bg-white text-indigo-700 shadow-md'
                    : 'bg-white/15 text-white/80 hover:bg-white/25 hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-purple-300/40">
          <p className="text-xs text-purple-200 font-medium">Commandes en attente</p>
          <p className="text-2xl font-bold text-purple-200">{stats.commandesEnAttente}</p>
        </div>
        <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-amber-300/40">
          <p className="text-xs text-amber-200 font-medium">Retraits en attente</p>
          <p className="text-2xl font-bold text-amber-200">{stats.retraitsEnAttente}</p>
        </div>
        <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-blue-300/40">
          <p className="text-xs text-blue-200 font-medium">Livraisons partielles</p>
          <p className="text-2xl font-bold text-blue-200">{stats.partiel}</p>
        </div>
        <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-green-300/40">
          <p className="text-xs text-green-200 font-medium">Terminées</p>
          <p className="text-2xl font-bold text-green-200">{stats.soldees}</p>
        </div>
        <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-white/20">
          <p className="text-xs text-white/70 font-medium">Total</p>
          <p className="text-2xl font-bold text-white">{ventes.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-3">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-medium text-white/70 mb-1">Statut</label>
          <select value={statutSuivi} onChange={e => setStatutSuivi(e.target.value)} className="w-full rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30">
            <option value="" className="text-gray-900">Tous les statuts</option>
            <option value="en_attente" className="text-gray-900">En attente</option>
            <option value="partiel" className="text-gray-900">Partiel</option>
            <option value="soldee" className="text-gray-900">Soldée / Retiré</option>
            <option value="annulee" className="text-gray-900">Annulée</option>
          </select>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-medium text-white/70 mb-1">N° facture</label>
          <div className="relative">
            <input type="text" value={searchNumero} onChange={e => setSearchNumero(e.target.value)} placeholder="Rechercher..." className="w-full rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 pl-8 pr-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30" />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
          </div>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-medium text-white/70 mb-1">Client</label>
          <input type="text" value={searchClient} onChange={e => setSearchClient(e.target.value)} placeholder="Nom, code..." className="w-full rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30" />
        </div>
        <div className="min-w-[100px]">
          <label className="block text-xs font-medium text-white/70 mb-1">Du</label>
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="w-full rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 [color-scheme:dark]" />
        </div>
        <div className="min-w-[100px]">
          <label className="block text-xs font-medium text-white/70 mb-1">Au</label>
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="w-full rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 [color-scheme:dark]" />
        </div>
        <button onClick={() => { setCurrentPage(1); fetchVentes(1) }} className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30 flex items-center gap-1.5">
          <Filter className="h-4 w-4" /> Filtrer
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="text-left text-xs uppercase text-white/60 border-b border-white/10">
            <tr>
              <th className="px-4 py-3 font-medium">N°</th>
              <th className="px-4 py-3 font-medium">Bon</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Mag.</th>
              <th className="px-4 py-3 font-medium text-right">Montant</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Paiement</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 text-right">Reste</th>
              <th className="px-4 py-3">État</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={13} className="px-4 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></td></tr>
            ) : ventesFiltrees.length === 0 ? (
              <tr><td colSpan={13} className="px-4 py-12 text-center text-gray-400">Aucune commande ou retrait différé trouvé.</td></tr>
            ) : ventesFiltrees.map(v => (
              <VenteTableRow
                key={v.id} v={v} userRole={userRole}
                annulant={annulant} supprimant={supprimant} loadingDetail={loadingDetail} livrant={livrant}
                onEdit={() => {}} onPay={() => {}} onView={handleVoirDetail} onReturn={() => {}}
                onCancel={handleAnnuler} onDelete={handleSupprimer}
                onDeliver={handleLivrer} onRetrait={handleRetrait}
              />
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={p => { setCurrentPage(p); fetchVentes(p) }} />
      )}

      {detailVente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailVente(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{detailVente.numero}</h2>
              <button onClick={() => setDetailVente(null)} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              <p><strong>Date :</strong> {formatDate(detailVente.date, { includeTime: true })}</p>
              <p><strong>Client :</strong> {detailVente.client?.nom || detailVente.clientLibre || '—'}</p>
              <p><strong>Magasin :</strong> {detailVente.magasin?.code || '—'}</p>
              <p><strong>Type :</strong> {detailVente.typeVente === 'COMMANDE' ? 'Commande' : detailVente.retraitDiffere ? 'Retrait différé' : 'Directe'}</p>
              <p><strong>Paiement :</strong> {detailVente.modePaiement}</p>
              {detailVente.dateLivraison && <p><strong>Livrée le :</strong> {formatDate(detailVente.dateLivraison, { includeTime: true })}</p>}
              {detailVente.retraitDiffere && (() => {
                const tq = detailVente.lignes?.reduce((a: number, l: any) => a + Number(l.quantite || 0), 0) || 0
                const tl = detailVente.lignes?.reduce((a: number, l: any) => a + Number(l.quantiteLivree || 0), 0) || 0
                if (tl >= tq) return <p><strong>Retrait :</strong> <span className="text-green-600">Complété</span></p>
                return <p><strong>Retrait :</strong> {tl}/{tq} ({Math.round(tl/tq*100)}%)</p>
              })()}
              {detailVente.observation && <p><strong>Observation :</strong> {detailVente.observation}</p>}
            </div>
            {detailVente.lignes?.length > 0 && (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-500 border-b border-gray-200">
                  <tr><th className="pb-2 pr-2 text-left">Produit</th><th className="pb-2 pr-2 text-right">Qté</th><th className="pb-2 pr-2 text-right">P.U.</th><th className="pb-2 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detailVente.lignes.map((l: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2 pr-2 font-medium text-gray-900">{l.designation}</td>
                      <td className="py-2 pr-2 text-right">{l.quantite}</td>
                      <td className="py-2 pr-2 text-right">{Number(l.prixUnitaire).toLocaleString('fr-FR')}</td>
                      <td className="py-2 text-right font-medium">{(l.montant || l.quantite * l.prixUnitaire).toLocaleString('fr-FR')} F</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 font-bold">
                  <tr><td colSpan={3} className="py-2 pr-2 text-right">Total</td><td className="py-2 text-right">{Number(detailVente.montantTotal).toLocaleString('fr-FR')} F</td></tr>
                </tfoot>
              </table>
            )}
            {detailVente.reglements?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Règlements</h3>
                {detailVente.reglements.map((r: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100">
                    <span className="text-gray-600">{r.modePaiement} {formatDate(r.date, { includeTime: true })}</span>
                    <span className="font-medium">{Number(r.montant).toLocaleString('fr-FR')} F</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {deliverVente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-gray-900">Livraison — {deliverVente.numero}</h2>
            <p className="mb-4 text-sm text-gray-500">Ajustez les quantités à livrer par produit.</p>
            <div className="mb-4 max-h-[50vh] overflow-y-auto space-y-3">
              {deliverVente.lignes.filter((l: any) => l.quantite - (l.quantiteLivree || 0) > 0).map((l: any) => {
                const reste = l.quantite - (l.quantiteLivree || 0)
                return (
                  <div key={l.produitId} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{l.designation}</p>
                      <p className="text-xs text-gray-400">Commandé: {l.quantite} / Reste: {reste}</p>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <button type="button" onClick={() => setDeliverQtys(prev => ({ ...prev, [l.produitId]: Math.max(0, (prev[l.produitId] || reste) - 1) }))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">−</button>
                      <input type="number" min={0} max={reste} value={deliverQtys[l.produitId] ?? reste} onChange={(e) => setDeliverQtys(prev => ({ ...prev, [l.produitId]: Math.min(reste, Math.max(0, Number(e.target.value) || 0)) }))} className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-center text-sm" />
                      <button type="button" onClick={() => setDeliverQtys(prev => ({ ...prev, [l.produitId]: Math.min(reste, (prev[l.produitId] || reste) + 1) }))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">+</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-800">
              <span>Total à livrer</span>
              <span>{Object.values(deliverQtys).reduce((s: number, q: any) => s + Number(q || 0), 0)} article(s)</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeliverVente(null)} disabled={savingDeliver} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={confirmDeliver} disabled={savingDeliver || Object.values(deliverQtys).every((q: any) => Number(q || 0) <= 0)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {savingDeliver ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Livrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENDU IMPRESSION */}
      <div className="hidden print:block">
        {(() => {
          if (!allVentesForPrint.length) return null
          const today = new Date().toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric'
          })
          const pages = paginateForPrint(allVentesForPrint, { otherPagesSize: 20 })
          return pages.map((pageData, pageIdx) => (
            <div key={pageIdx} className="print-page">
              <ListPrintWrapper
                title="Suivi des commandes et retraits"
                subtitle={`GestiCom Pro • ${today}`}
                pageNumber={pageIdx + 1}
                totalPages={pages.length}
              >
                <table className="min-w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-1 text-left">N°</th>
                      <th className="border p-1 text-left">Date</th>
                      <th className="border p-1 text-left">Client</th>
                      <th className="border p-1 text-left">Mag.</th>
                      <th className="border p-1 text-right">Montant</th>
                      <th className="border p-1 text-left">Paiement</th>
                      <th className="border p-1 text-left">Type</th>
                      <th className="border p-1 text-left">État</th>
                      <th className="border p-1 text-right">Reste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((v: any) => {
                      const rp = Math.max(0, Number(v.montantTotal) - (Number(v.montantPaye) || 0))
                      return (
                        <tr key={v.id}>
                          <td className="border p-1">{v.numero}</td>
                          <td className="border p-1">{formatDate(v.date, { includeTime: false })}</td>
                          <td className="border p-1">{v.client?.nom || v.clientLibre || '—'}</td>
                          <td className="border p-1">{v.magasin.code}</td>
                          <td className="border p-1 text-right">{Number(v.montantTotal).toLocaleString('fr-FR')} F</td>
                          <td className="border p-1">{v.modePaiement}</td>
                          <td className="border p-1">
                            {v.typeVente === 'COMMANDE' ? 'Commande' : v.retraitDiffere ? 'Retrait diff.' : 'Directe'}
                          </td>
                          <td className="border p-1">{formatStatutSuivi(v)}</td>
                          <td className="border p-1 text-right">{rp > 0 ? rp.toLocaleString('fr-FR') + ' F' : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ListPrintWrapper>
            </div>
          ))
        })()}
      </div>
      </div>
    </div>
  )
}
