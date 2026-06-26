'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Search, User, Wallet, Calendar, X, Check,
  Plus, Package, Trash2, AlertCircle, ChevronDown, ChevronUp,
  Banknote, ShoppingCart
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'

interface ClientItem {
  id: number
  code: string | null
  nom: string
  telephone: string | null
  type: string
}

interface PaiementItem {
  id: number
  date: string
  montant: number
  modePaiement: string
}

interface ClientAcompte {
  clientId: number
  clientCode: string | null
  clientNom: string
  totalAcompte: number
  paiements: PaiementItem[]
}

interface ProduitItem {
  id: number
  code: string
  designation: string
  prixVente: number
  stocks: { magasinId: number; quantite: number }[]
}

interface LignePanier {
  produitId: number
  designation: string
  code: string
  quantite: number
  prixUnitaire: number
  stockDispo: number
}

export default function EnlevementsAcomptesPage() {
  const [clients, setClients] = useState<ClientItem[]>([])
  const [clientsAcomptes, setClientsAcomptes] = useState<ClientAcompte[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientAcompte | null>(null)
  const [montant, setMontant] = useState('')
  const [montantRembourse, setMontantRembourse] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [showClientList, setShowClientList] = useState(false)
  const [clientType, setClientType] = useState<'registered' | 'counter'>('registered')
  const [clientLibre, setClientLibre] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [dateReglement, setDateReglement] = useState(today)

  const [produits, setProduits] = useState<ProduitItem[]>([])
  const [prodSearch, setProdSearch] = useState('')
  const [showProdList, setShowProdList] = useState(false)
  const [selectedProd, setSelectedProd] = useState<ProduitItem | null>(null)
  const [prodQuantite, setProdQuantite] = useState('1')
  const [lignes, setLignes] = useState<LignePanier[]>([])

  const [loadingInit, setLoadingInit] = useState(true)
  const [showHistorique, setShowHistorique] = useState(false)

  const { success: toastSuccess, error: toastError } = useToast()
  const router = useRouter()
  const clientRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/clients?limit=1000').then(r => r.json()),
      fetch('/api/clients/acomptes').then(r => r.json()),
      fetch('/api/produits?complet=1').then(r => r.json()),
    ]).then(([clientsData, acomptesData, produitsData]) => {
      const allClients = Array.isArray(clientsData.data) ? clientsData.data : []
      setClients(allClients)
      setClientsAcomptes(Array.isArray(acomptesData) ? acomptesData : [])
      const prods = Array.isArray(produitsData) ? produitsData : (Array.isArray(produitsData.data) ? produitsData.data : [])
      setProduits(prods)
    }).catch(() => {
      toastError('Erreur chargement données.')
    }).finally(() => setLoadingInit(false))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setShowClientList(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const clientsFiltres = clientsAcomptes.filter(c =>
    c.clientNom.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.clientCode && c.clientCode.toLowerCase().includes(clientSearch.toLowerCase()))
  )

  const produitsFiltres = produits.filter(p =>
    !selectedProd &&
    prodSearch.length >= 1 &&
    (p.designation.toLowerCase().includes(prodSearch.toLowerCase()) ||
     p.code.toLowerCase().includes(prodSearch.toLowerCase()))
  ).slice(0, 20)

  const selectClient = (ca: ClientAcompte) => {
    setSelectedClient(ca)
    setMontant(String(ca.totalAcompte))
    setClientSearch(ca.clientNom)
    setShowClientList(false)
    setLignes([])
    setShowHistorique(false)
  }

  const addLigne = () => {
    if (!selectedProd) return
    const qte = Math.max(0.001, Number(prodQuantite) || 1)
    const existe = lignes.find(l => l.produitId === selectedProd.id)
    if (existe) {
      setLignes(lignes.map(l =>
        l.produitId === selectedProd.id
          ? { ...l, quantite: l.quantite + qte }
          : l
      ))
    } else {
      setLignes([...lignes, {
        produitId: selectedProd.id,
        designation: selectedProd.designation,
        code: selectedProd.code,
        quantite: qte,
        prixUnitaire: selectedProd.prixVente || 0,
        stockDispo: selectedProd.stocks?.reduce((s, st) => s + st.quantite, 0) || 0,
      }])
    }
    setSelectedProd(null)
    setProdSearch('')
    setProdQuantite('1')
  }

  const removeLigne = (produitId: number) => {
    setLignes(lignes.filter(l => l.produitId !== produitId))
  }

  const totalProduits = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0)
  const montantNum = Number(montant) || 0
  const montantRembNum = Number(montantRembourse) || 0
  const montantProduits = Math.max(0, montantNum - montantRembNum)
  const diff = Math.abs(totalProduits - montantProduits)
  const isValid = montantNum > 0 && lignes.length > 0 && diff <= 100 && (
    clientType === 'counter' ? clientLibre.trim().length > 0 : !!selectedClient
  )

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        clientId: clientType === 'counter' ? 66 : selectedClient!.clientId,
        montant: montantNum,
        montantRembourse: montantRembNum || undefined,
        dateReglement: dateReglement,
        lignes: lignes.map(l => ({
          produitId: l.produitId,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
        })),
      }
      if (clientType === 'counter') {
        body.clientLibre = clientLibre.trim()
      }
      const res = await fetch('/api/enlevements-acomptes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (res.ok) {
        toastSuccess(`Enlèvement #${json.vente.numero} enregistré.`)
        setSelectedClient(null)
        setMontant('')
        setMontantRembourse('')
        setDateReglement(today)
        setClientSearch('')
        setClientLibre('')
        setClientType('registered')
        setLignes([])
        setSelectedProd(null)
        setProdSearch('')
        setShowHistorique(false)
        router.refresh()
        fetch('/api/clients/acomptes').then(r => r.json()).then(d => {
          setClientsAcomptes(Array.isArray(d) ? d : [])
        })
      } else {
        toastError(json.error || 'Erreur lors de l\'enlèvement.')
      }
    } catch {
      toastError('Erreur de connexion.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingInit) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    )
  }

  const totalDisponible = selectedClient?.totalAcompte || 0

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Enlèvements sur acomptes</h1>
          <p className="text-white/80 font-medium">
            Client remet son reçu papier → vous saisissez le montant et les produits → sortie stock + compta immédiate.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLONNE GAUCHE : Client + montant */}
        <div className="lg:col-span-1 space-y-4">
          {/* Sélection Client */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
            <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-3">1. Client</h2>

            {/* Toggle Client enregistré / Au comptoir */}
            <div className="flex rounded-xl border border-gray-200 p-1 mb-4">
              <button
                type="button"
                onClick={() => {
                  setClientType('registered')
                  setSelectedClient(null)
                  setClientSearch('')
                  setClientLibre('')
                  setMontant('')
                  setMontantRembourse('')
                  setDateReglement(today)
                  setLignes([])
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  clientType === 'registered'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Client
              </button>
              <button
                type="button"
                onClick={() => {
                  setClientType('counter')
                  setSelectedClient(null)
                  setClientSearch('')
                  setMontant('')
                  setMontantRembourse('')
                  setDateReglement(today)
                  setLignes([])
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  clientType === 'counter'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Au comptoir
              </button>
            </div>

            {clientType === 'registered' ? (
              <div className="relative" ref={clientRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un client..."
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); if (!e.target.value) setSelectedClient(null); setShowClientList(true) }}
                    onFocus={() => setShowClientList(true)}
                    className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                {showClientList && clientSearch.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                    {clientsFiltres.length === 0 ? (
                      <div className="p-4 text-sm text-gray-400 text-center">Aucun client avec acompte</div>
                    ) : (
                      clientsFiltres.map(ca => (
                        <button
                          key={ca.clientId}
                          type="button"
                          onMouseDown={e => { e.preventDefault(); selectClient(ca) }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 transition-colors text-left"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-sm">{ca.clientNom}</span>
                            <span className="text-xs text-gray-400">{ca.clientCode || 'Sans code'}</span>
                          </div>
                          <span className="text-sm font-black text-emerald-600">{ca.totalAcompte.toLocaleString('fr-FR')} F</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">Nom du client (pour le reçu)</label>
                <input
                  type="text"
                  placeholder="Ex : Mamadou Diallo..."
                  value={clientLibre}
                  onChange={e => setClientLibre(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            )}

            {(selectedClient || clientType === 'counter') && (
              <>
                {clientType === 'registered' && selectedClient && (
                  <>
                    {/* Infos acompte */}
                    <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-bold text-gray-900 text-sm">{selectedClient.clientNom}</span>
                        <span className="text-xs text-gray-400 ml-auto">{selectedClient.clientCode || ''}</span>
                      </div>
                      <div className="mt-3 flex justify-between items-center border-t border-emerald-200/60 pt-3">
                        <span className="text-xs font-semibold text-gray-600">Acompte disponible</span>
                        <span className="text-lg font-black text-emerald-600">{totalDisponible.toLocaleString('fr-FR')} F</span>
                      </div>
                    </div>

                    {/* Bouton historique */}
                    <button
                      onClick={() => setShowHistorique(!showHistorique)}
                      className="mt-2 w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Versements ({selectedClient.paiements.length})
                      </span>
                      {showHistorique ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {showHistorique && (
                      <div className="mt-2 bg-gray-50 rounded-xl border border-gray-200 p-3 max-h-48 overflow-y-auto space-y-2">
                        {selectedClient.paiements.map((p, i) => {
                          const reste = selectedClient.paiements
                            .slice(0, i + 1)
                            .reduce((s, pp) => s + (selectedClient.paiements.find(x => x.id === pp.id)?.montant || 0), 0)
                          return (
                            <div key={p.id} className="flex items-center justify-between text-xs border-b border-gray-100 pb-1.5 last:border-0">
                              <div className="flex items-center gap-2">
                                <Wallet className="h-3 w-3 text-gray-400" />
                                <span className="font-medium text-gray-700">{new Date(p.date).toLocaleDateString('fr-FR')}</span>
                                <span className="text-gray-400">{p.modePaiement}</span>
                              </div>
                              <span className="font-bold text-gray-900">{p.montant.toLocaleString('fr-FR')} F</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Montant */}
                <div className="mt-4">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                    2. Montant total (acompte)
                  </label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      value={montant}
                      onChange={e => setMontant(e.target.value)}
                      min="1"
                      max={clientType === 'registered' ? totalDisponible : undefined}
                      className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  {clientType === 'registered' && selectedClient && (
                    <p className="text-xs text-gray-400 mt-1">
                      Max : {totalDisponible.toLocaleString('fr-FR')} F
                      {montantNum > totalDisponible && (
                        <span className="text-red-500 ml-2">Dépasse le disponible !</span>
                      )}
                    </p>
                  )}
                </div>

                {/* Montant remboursé */}
                <div className="mt-3">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                    Dont remboursé en espèces
                  </label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                    <input
                      type="number"
                      value={montantRembourse}
                      onChange={e => setMontantRembourse(e.target.value)}
                      min="0"
                      max={montantNum || 0}
                      className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="0"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Montant à rendre au client en espèces. Le reste ({montantProduits.toLocaleString('fr-FR')} F) sert à acheter les produits.
                  </p>
                </div>

                {/* Date du règlement (sur le reçu) */}
                <div className="mt-3">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                    Date du règlement (reçu)
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={dateReglement}
                      onChange={e => setDateReglement(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Date inscrite sur le reçu papier du client.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* COLONNE DROITE : Produits + panier */}
        <div className="lg:col-span-2 space-y-4">
          {(selectedClient || clientType === 'counter') ? (
            <>
              {/* Ajout produit */}
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
                <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-3">3. Produits à retirer</h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="relative sm:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Taper le nom ou code produit..."
                      value={prodSearch}
                      onChange={e => { setProdSearch(e.target.value); setSelectedProd(null); setShowProdList(true) }}
                      onFocus={() => setShowProdList(true)}
                      onBlur={() => setTimeout(() => setShowProdList(false), 200)}
                      className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    {selectedProd && (
                      <button
                        onClick={() => { setSelectedProd(null); setProdSearch('') }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {showProdList && produitsFiltres.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                        {produitsFiltres.map(p => {
                          const stock = p.stocks?.reduce((s, st) => s + st.quantite, 0) || 0
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={e => { e.preventDefault(); setSelectedProd(p); setProdSearch(p.designation); setShowProdList(false) }}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 transition-colors border-b border-gray-50 last:border-0"
                            >
                              <div className="flex flex-col items-start">
                                <span className="font-bold text-gray-900 text-sm">{p.designation}</span>
                                <span className="text-[10px] text-gray-400 font-mono">{p.code}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  Stk: {stock}
                                </span>
                                <span className="text-sm font-black text-gray-700">{p.prixVente?.toLocaleString('fr-FR')} F</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Qté</label>
                      <input
                        type="number"
                        value={prodQuantite}
                        onChange={e => setProdQuantite(e.target.value)}
                        min="0.001"
                        step="1"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-center"
                      />
                    </div>
                    <button
                      onClick={addLigne}
                      disabled={!selectedProd || !Number(prodQuantite) || Number(prodQuantite) <= 0}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 transition-all disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>

              {/* Panier */}
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-emerald-600" />
                    <h3 className="font-black text-gray-700 text-sm uppercase tracking-wider">Panier</h3>
                  </div>
                  <span className="text-xs text-gray-400">{lignes.length} ligne(s)</span>
                </div>

                {lignes.length === 0 ? (
                  <div className="p-12 text-center">
                    <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-500">Aucun produit ajouté</p>
                    <p className="text-xs text-gray-400 mt-1">Recherchez et ajoutez les produits à retirer.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-4 py-3 font-bold text-gray-600 text-[10px] uppercase tracking-wider">Produit</th>
                            <th className="text-center px-2 py-3 font-bold text-gray-600 text-[10px] uppercase tracking-wider">Qté</th>
                            <th className="text-right px-2 py-3 font-bold text-gray-600 text-[10px] uppercase tracking-wider">P.U.</th>
                            <th className="text-right px-2 py-3 font-bold text-gray-600 text-[10px] uppercase tracking-wider">Total</th>
                            <th className="px-2 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {lignes.map(l => (
                            <tr key={l.produitId} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900">{l.designation}</span>
                                  <span className="text-[10px] text-gray-400">{l.code}</span>
                                </div>
                              </td>
                              <td className="px-2 py-3 text-center font-bold text-gray-700">{l.quantite}</td>
                              <td className="px-2 py-3 text-right font-bold text-gray-700">{l.prixUnitaire.toLocaleString('fr-FR')}</td>
                              <td className="px-2 py-3 text-right font-black text-gray-900">{(l.quantite * l.prixUnitaire).toLocaleString('fr-FR')} F</td>
                              <td className="px-2 py-3 text-right">
                                <button
                                  onClick={() => removeLigne(l.produitId)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totaux */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 font-semibold">Total produits</span>
                        <span className="font-black text-gray-900">{totalProduits.toLocaleString('fr-FR')} F</span>
                      </div>
                      {montantRembNum > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 font-semibold">Remboursé espèces</span>
                          <span className="font-black text-amber-600">-{montantRembNum.toLocaleString('fr-FR')} F</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm border-t border-gray-200 pt-2">
                        <span className="text-gray-500 font-semibold">Acompte déduit</span>
                        <span className="font-black text-emerald-600">{montantProduits.toLocaleString('fr-FR')} F</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 font-semibold">Total acompte</span>
                        <span className="font-black text-gray-900">{montantNum.toLocaleString('fr-FR')} F</span>
                      </div>
                      {diff > 100 && lignes.length > 0 && montantNum > 0 && (
                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          Différence de {diff.toLocaleString('fr-FR')} F entre le montant déduit et le total des produits.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Bouton validation */}
              <button
                onClick={handleSubmit}
                disabled={!isValid || submitting}
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-black text-white hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200/50"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                {submitting
                  ? 'Traitement en cours...'
                  : `Valider l'enlèvement — ${montantProduits.toLocaleString('fr-FR')} F ${montantRembNum > 0 ? `(dont ${montantRembNum.toLocaleString('fr-FR')} F remboursés)` : ''}`
                }
              </button>
            </>
          ) : (
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-12 text-center">
              <Banknote className="h-14 w-14 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-black text-gray-700 uppercase italic tracking-tight">Enlèvement sur acompte</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                Sélectionnez un client ou passez en mode <strong>Au comptoir</strong>. Vérifiez le reçu papier, saisissez le montant et les produits retirés.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
