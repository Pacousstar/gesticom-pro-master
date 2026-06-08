'use client'

import { useState } from 'react'
import { AlertTriangle, X, Loader2, Trash2 } from 'lucide-react'

interface SuppressionDetail {
  label: string
  count?: number
  description: string
}

interface SuppressionConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  titre: string
  message: string
  details: SuppressionDetail[]
  isLoading?: boolean
}

export default function SuppressionConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  titre,
  message,
  details,
  isLoading: externalLoading,
}: SuppressionConfirmModalProps) {
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
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-red-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{titre}</h2>
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
          <p className="text-sm text-gray-600">{message}</p>

          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-700">
              Récapitulatif des données impactées
            </p>
            <ul className="space-y-2">
              {details.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 text-red-500">•</span>
                  <span className="text-gray-700">
                    <strong>{d.label}</strong>
                    {d.count != null && (
                      <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-200 px-2 py-0.5 text-xs font-bold text-red-700">
                        {d.count}
                      </span>
                    )}
                    <span className="text-gray-500"> — {d.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-xs font-bold text-red-600">Cette action est IRRÉVERSIBLE.</p>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Tapez <span className="font-bold text-red-600">SUPPRIMER</span> pour confirmer
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Tapez SUPPRIMER ici..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
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
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={typedText !== 'SUPPRIMER' || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {loading ? 'Suppression...' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}
