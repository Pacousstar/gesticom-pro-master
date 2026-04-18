'use client'

import { X, Loader2, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

interface ClientCreateModalProps {
  onClose: () => void
  onSave: (data: any) => void
  saving: boolean
  err?: string
}

export function ClientCreateModal({ onClose, onSave, saving, err }: ClientCreateModalProps) {
  const [form, setForm] = useState({ nom: '', telephone: '', type: 'CASH', plafondCredit: '' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-orange-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nouveau client</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nom *</label>
            <input required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Téléphone</label>
            <input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2">
              <option value="CASH">CASH</option>
              <option value="CREDIT">CREDIT</option>
            </select>
          </div>
          {form.type === 'CREDIT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Plafond crédit (FCFA)</label>
              <input type="number" min="0" value={form.plafondCredit} onChange={e => setForm(f => ({ ...f, plafondCredit: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 rounded bg-orange-500 py-2 text-white font-bold hover:bg-orange-600 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Créer le client'}
            </button>
            <button type="button" onClick={onClose} className="rounded border px-4 py-2 hover:bg-gray-50">Annuler</button>
          </div>
        </form>
        {err && <p className="mt-2 text-sm text-red-600 font-medium">{err}</p>}
      </div>
    </div>
  )
}

interface ReglementModalProps {
  data: { id: number; numero: string; reste: number }
  onClose: () => void
  onSave: (id: number, montant: number, mode: string, date: string) => void
  saving: boolean
}

export function ReglementModal({ data, onClose, onSave, saving }: ReglementModalProps) {
  const [form, setForm] = useState({ montant: String(data.reste), mode: 'ESPECES', date: new Date().toISOString().split('T')[0] })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-orange-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Règlement {data.numero}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="mb-4 bg-orange-50 p-3 rounded-lg border border-orange-100">
           <span className="text-xs text-orange-700 font-bold uppercase">Reste à percevoir</span>
           <div className="text-xl font-black text-orange-600">{data.reste.toLocaleString()} F</div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(data.id, Number(form.montant), form.mode, form.date); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Montant versé *</label>
            <input type="number" required max={data.reste} value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Mode de paiement</label>
            <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2">
              <option value="ESPECES">Espèces</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="VIREMENT">Virement</option>
              <option value="CHEQUE">Chèque</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving || Number(form.montant) <= 0} className="flex-1 rounded bg-orange-500 py-2 text-white font-bold hover:bg-orange-600 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Enregistrer'}
            </button>
            <button type="button" onClick={onClose} className="rounded border px-4 py-2 hover:bg-gray-50">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface StockInsuffisantModalProps {
  data: { produitId: number; produitDesignation: string; quantiteDemandee: number; quantiteDisponible: number; magasinId: number; lignes: any[] }
  onClose: () => void
  onSave: (quantite: number) => void
  saving: boolean
}

export function StockInsuffisantModal({ data, onClose, onSave, saving }: StockInsuffisantModalProps) {
  const [qte, setQte] = useState(String(data.quantiteDemandee - data.quantiteDisponible))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b pb-4">
          <h3 className="text-lg font-bold text-red-600 flex items-center gap-2"><AlertTriangle /> Stock insuffisant</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X /></button>
        </div>
        <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-100 text-sm text-red-800">
          <p>Vous essayez de vendre <strong>{data.quantiteDemandee}</strong> unités de <strong>{data.produitDesignation}</strong>.</p>
          <p className="mt-1">Cependant, seulement <strong>{data.quantiteDisponible}</strong> sont disponibles en stock informatique.</p>
          <p className="mt-3 italic font-medium">Si vous avez le produit physiquement en main, ajoutez le stock manquant ci-dessous pour débloquer la vente :</p>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(Number(qte)); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Quantité à ajouter maintenant</label>
            <input type="number" min="1" required value={qte} onChange={e => setQte(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 focus:ring-red-500" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 rounded bg-red-600 py-2 text-white font-bold hover:bg-red-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Ajouter et Continuer'}
            </button>
            <button type="button" onClick={onClose} className="rounded border px-4 py-2 hover:bg-gray-50">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  )
}
