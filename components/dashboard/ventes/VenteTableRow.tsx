'use client'

import { memo } from 'react'
import {
  DollarSign, Wallet, Eye, RotateCcw, XCircle, Trash2, Loader2, Pencil, Truck,
} from 'lucide-react'
import { formatDate } from '@/lib/format-date'

interface VenteTableRowProps {
  v: any
  userRole: string
  annulant: number | null
  supprimant: number | null
  loadingDetail: number | null
  livrant: number | null
  onEdit: (v: any) => void
  onPay: (payload: { id: number; numero: string; reste: number }) => void
  onView: (id: number) => void
  onReturn: (v: any) => void
  onCancel: (v: any) => void
  onDelete: (v: any) => void
  onEditModal?: (v: any) => void
  onDeliver?: (v: any) => void
}

function VenteTableRowInner({
  v, userRole, annulant, supprimant, loadingDetail, livrant,
  onEdit, onPay, onView, onReturn, onCancel, onDelete, onEditModal, onDeliver,
}: VenteTableRowProps) {
  const resteAPayer = Math.max(0, Number(v.montantTotal) - (Number(v.montantPaye) || 0))

  return (
    <tr key={v.id} className={v.statut === 'ANNULEE' ? 'bg-gray-100' : 'hover:bg-gray-50'}>
      <td className="px-4 py-3 font-mono text-sm text-gray-900">{v.numero}</td>
      <td className="px-4 py-3 text-sm font-bold text-orange-600">{v.numeroBon || '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatDate(v.date, { includeTime: true })}
      </td>
      <td className="px-4 py-3 text-sm font-mono font-bold text-blue-600 uppercase">
        {v.client?.code || '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 font-medium">
        {v.client?.nom || v.clientLibre || <span className="text-gray-400 italic">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{v.magasin.code}</td>
      <td className="px-4 py-3 text-right font-medium text-gray-900">
        {Number(v.montantTotal).toLocaleString('fr-FR')} F
      </td>
      <td className="px-4 py-3">
        {v.typeVente === 'COMMANDE' ? (
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${
            v.dateLivraison ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
          }`}>
            {v.dateLivraison ? 'Livrée' : 'Commande'}
          </span>
        ) : (
          <span className="rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
            Directe
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        <div className="flex items-center gap-1.5" title={v.modePaiement === 'ESPECES' ? "Espèces" : v.modePaiement}>
          {v.modePaiement === 'ESPECES' ? (
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Wallet className="h-3.5 w-3.5 text-blue-500" />
          )}
          {v.modePaiement.replace('_', ' ')}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${v.statutPaiement === 'PAYE' ? 'bg-green-100 text-green-800' :
          v.statutPaiement === 'PARTIEL' ? 'bg-yellow-100 text-yellow-800' :
            'bg-orange-100 text-orange-800'
        }`}>
          {v.statutPaiement === 'PAYE' ? 'Payé' :
            v.statutPaiement === 'PARTIEL' ? 'Partiel' :
              'Crédit'}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-medium text-gray-900">
        {resteAPayer > 0 ? `${resteAPayer.toLocaleString('fr-FR')} F` : '-'}
      </td>
      <td className="px-4 py-3">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
          v.statut === 'ANNULEE' ? 'bg-gray-200 text-gray-700' :
            'bg-green-100 text-green-800'
        }`}>
          {v.statut === 'ANNULEE' ? 'Annulée' : 'Validée'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {v.statutPaiement !== 'PAYE' && v.statut !== 'ANNULEE' && (
            <button
              onClick={() => onPay({ id: v.id, numero: v.numero, reste: resteAPayer })}
              className="rounded p-1.5 text-orange-600 hover:bg-orange-100"
              title="Enregistrer un règlement"
            >
              <Wallet className="h-4 w-4" />
            </button>
          )}
          {v.typeVente === 'COMMANDE' && !v.dateLivraison && v.statut !== 'ANNULEE' && onDeliver && (
            <button
              onClick={() => onDeliver(v)}
              disabled={livrant === v.id}
              className="rounded p-1.5 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
              title="Livrer la commande"
            >
              {livrant === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            </button>
          )}
          {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && v.statut !== 'ANNULEE' && onEditModal && (
            <button
              onClick={() => onEditModal(v)}
              className="rounded p-1.5 text-orange-600 hover:bg-orange-100"
              title="Modifier la facture complète"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => onView(v.id)}
            disabled={loadingDetail === v.id}
            className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            title="Voir le détail"
          >
            {loadingDetail === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          </button>
          {v.statut === 'VALIDEE' && (
            <>
              <button
                onClick={() => onReturn(v)}
                className="rounded p-1.5 text-amber-600 hover:bg-amber-50"
                title="Retour de marchandise"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => onCancel(v)}
                disabled={annulant === v.id}
                className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                title="Annuler la vente"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
          {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
            <button
              onClick={() => onDelete(v)}
              disabled={supprimant === v.id}
              className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
              title="Supprimer définitivement"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export const VenteTableRow = memo(VenteTableRowInner)
