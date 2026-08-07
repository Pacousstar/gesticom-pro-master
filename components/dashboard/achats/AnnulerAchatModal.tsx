'use client'

import { useState } from 'react'
import { AlertTriangle, X, Loader2, RotateCcw } from 'lucide-react'

interface AnnulerDetail {
  label: string
  count?: number
  description: string
}

interface AnnulerAchatModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  numero: string
  montantTotal: number
  montantPaye: number
  details: AnnulerDetail[]
  isLoading?: boolean
}

export default function AnnulerAchatModal({
  isOpen,
  onClose,
  onConfirm,
  numero,
  montantTotal,
  montantPaye,
  details,
  isLoading: externalLoading,
}: AnnulerAchatModalProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const [typedText, setTypedText] = useState('')
  const loading = externalLoading || internalLoading

  if (!isOpen) return null

  const handleConfirm = async () => {
    setInternalLoading(true)
    try {
      await onConfirm()
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-amber-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Annuler l'achat {numero} ?</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-gray-600">
            L'achat <strong>{numero}</strong>{montantTotal > 0 ? <> de <strong>{montantTotal.toLocaleString('fr-FR')} F</strong></> : ''} sera annulé
            {montantPaye > 0 ? <> (dont {montantPaye.toLocaleString('fr-FR')} F déjà réglés)</> : ''}. Les stocks achetés seront restitués et les écritures comptables supprimées.
          </p>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-700">
              Conséquences de l'annulation
            </p>
            <ul className="space-y-2">
              {details.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 text-amber-500">•</span>
                  <span className="text-gray-700">
                    <strong>{d.label}</strong>
                    {d.count != null && (
                      <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-700">
                        {d.count}
                      </span>
                    )}
                    <span className="text-gray-500"> — {d.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-xs font-bold text-amber-600">
            L'achat sera marqué « Annulé » mais conservé dans l'historique.
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Tapez <span className="font-bold text-amber-600">ANNULER</span> pour confirmer
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Tapez ANNULER ici..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 p-5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={typedText !== 'ANNULER' || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {loading ? 'Annulation en cours...' : "Annuler l'achat"}
          </button>
        </div>
      </div>
    </div>
  )
}