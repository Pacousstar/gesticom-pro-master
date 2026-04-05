'use client'

import { useState } from 'react'
import { X, DollarSign, CreditCard, Wallet, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  type: 'VENTE' | 'ACHAT'
  tierId: number
  tierNom: string
  totalDu: number
  invoices: any[] // Liste des factures non soldées
}

export default function PaymentModal({ isOpen, onClose, onSuccess, type, tierId, tierNom, totalDu, invoices }: PaymentModalProps) {
  const [loading, setLoading] = useState(false)
  const [magasins, setMagasins] = useState<{ id: number, nom: string }[]>([])
  const [selectedMagasinId, setSelectedMagasinId] = useState<string>('')
  const [selectedInvoceId, setSelectedInvoiceId] = useState<string>('')
  const [montant, setMontant] = useState<string>('')
  const [modePaiement, setModePaiement] = useState('ESPECES')
  const [observation, setObservation] = useState('')
  const { success: showSuccess, error: showError } = useToast()

  useState(() => {
    fetch('/api/magasins').then(r => r.ok ? r.json() : []).then(setMagasins)
  })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!montant) return showError('Veuillez saisir un montant.')
    if (Number(montant) <= 0) return showError('Le montant doit être supérieur à zéro.')

    setLoading(true)
    try {
      const endpoint = type === 'VENTE' ? '/api/reglements/ventes' : '/api/reglements/achats'
      const payload: any = { 
        montant: Number(montant), 
        modePaiement, 
        observation,
        magasinId: selectedMagasinId ? Number(selectedMagasinId) : null 
      }
      
      if (type === 'VENTE') payload.venteId = selectedInvoceId || null
      else payload.achatId = selectedInvoceId || null

      if (!selectedInvoceId && !selectedMagasinId && modePaiement === 'ESPECES') {
         setLoading(false)
         return showError('Veuillez sélectionner un magasin (Caisse) pour ce règlement libre.')
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        showSuccess('Règlement enregistré avec succès.')
        onSuccess()
        onClose()
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors de l\'enregistrement.')
      }
    } catch (e) {
      showError('Erreur serveur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl">
        <div className={`flex items-center justify-between p-6 border-b ${type === 'VENTE' ? 'bg-green-600' : 'bg-orange-600'} rounded-t-2xl text-white`}>
          <div>
            <h2 className="text-xl font-bold">Encaisser / Régler</h2>
            <p className="text-xs opacity-80">{tierNom} - Solde total: {totalDu.toLocaleString()} F</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Facture à solder</label>
            <select
              value={selectedInvoceId}
              onChange={(e) => {
                setSelectedInvoiceId(e.target.value)
                const inv = invoices.find(i => String(i.id) === e.target.value)
                if (inv) setMontant(String(inv.montantTotal - inv.montantPaye))
                else setMontant('')
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:outline-none"
            >
              <option value="">Règlement sur compte (Acompte / Avance)</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.numero} - Du {new Date(inv.date).toLocaleDateString()} (Reste: {(inv.montantTotal - inv.montantPaye).toLocaleString()} F)
                </option>
              ))}
            </select>
          </div>

          {!selectedInvoceId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caisse / Magasin {modePaiement === 'ESPECES' ? '*' : ''}</label>
              <select
                value={selectedMagasinId}
                required={modePaiement === 'ESPECES'}
                onChange={(e) => setSelectedMagasinId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:outline-none"
              >
                <option value="">Sélectionner un magasin...</option>
                {magasins.map(m => (
                  <option key={m.id} value={m.id}>{m.nom}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant du versement (F)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                required
                min="1"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
            <div className="grid grid-cols-3 gap-2">
              {['ESPECES', 'MOBILE_MONEY', 'CHEQUE'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModePaiement(m)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] font-bold transition-all ${
                    modePaiement === m 
                    ? (type === 'VENTE' ? 'bg-green-50 border-green-600 text-green-700' : 'bg-orange-50 border-orange-600 text-orange-700')
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {m === 'ESPECES' && <Wallet className="h-4 w-4" />}
                  {m === 'MOBILE_MONEY' && <CreditCard className="h-4 w-4" />}
                  {m === 'CHEQUE' && <FileText className="h-4 w-4 text-gray-400" />}
                  {m.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 rounded-lg py-2 text-sm font-bold text-white transition-all shadow-md ${
                type === 'VENTE' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
              } disabled:opacity-50`}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Confirmer le règlement'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200 transition-all"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FileText({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
    )
}
