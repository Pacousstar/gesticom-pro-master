'use client'

import { memo } from 'react'
import {
  DollarSign, Wallet, Eye, RotateCcw, XCircle, Trash2, Loader2, Pencil, Truck, ShoppingBag,
} from 'lucide-react'
import { formatDate } from '@/lib/format-date'
import { getStatutPaiementLabel, getStatutPaiementColors } from '@/lib/enums-commerce'

interface VenteTableRowProps {
  v: any
  userRole: string
  annulant: number | null
  supprimant: number | null
  loadingDetail: number | null
  livrant: number | null
  onEdit: (v: any) => void
  onPay?: (payload: { id: number; numero: string; reste: number }) => void
  onView: (id: number) => void
  onReturn: (v: any) => void
  onCancel: (v: any) => void
  onDelete: (v: any) => void
  onEditModal?: (v: any) => void
  onDeliver?: (v: any) => void
  onRetrait?: (v: any) => void
  retraitant?: number | null
}

function VenteTableRowInner({
  v, userRole, annulant, supprimant, loadingDetail, livrant,
  onEdit, onPay, onView, onReturn, onCancel, onDelete, onEditModal, onDeliver, onRetrait, retraitant,
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
      <td className="px-4 py-3 text-sm text-gray-600">{v.magasin?.code || '—'}</td>
      <td className="px-4 py-3 text-right font-medium text-gray-900">
        {Number(v.montantTotal).toLocaleString('fr-FR')} F
      </td>
      <td className="px-4 py-3">
        {v.typeVente === 'COMMANDE' ? (() => {
          const lignesList = v.lignes || []
          const totalQte = lignesList.reduce((s: number, l: any) => s + Number(l.quantite || 0), 0)
          const totalLivree = lignesList.reduce((s: number, l: any) => s + Number(l.quantiteLivree || 0), 0)
          const reste = totalQte - totalLivree
          if (v.dateLivraison || reste <= 0) {
            return <span className="rounded px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700">Soldée</span>
          }
          if (totalLivree > 0) {
            return (
              <div className="flex flex-col gap-0.5">
                <span className="rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">Commande</span>
                <span className="text-[10px] text-gray-500 font-medium">Livré: {totalLivree} / Reste: {reste}</span>
              </div>
            )
          }
          return <span className="rounded px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">Commande</span>
        })() : v.retraitDiffere ? (() => {
          const lignesList = v.lignes || []
          const totalQte = lignesList.reduce((s: number, l: any) => s + Number(l.quantite || 0), 0)
          const totalLivree = lignesList.reduce((s: number, l: any) => s + Number(l.quantiteLivree || 0), 0)
          const reste = totalQte - totalLivree
          if (reste <= 0) {
            return <span className="rounded px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700">Retiré</span>
          }
          if (totalLivree > 0) {
            return (
              <div className="flex flex-col gap-0.5">
                <span className="rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">Retrait partiel</span>
                <span className="text-[10px] text-gray-500 font-medium">Retiré: {totalLivree} / Reste: {reste}</span>
              </div>
            )
          }
          return (
            <div className="flex flex-col gap-0.5">
              <span className="rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">À retirer</span>
              <span className="text-[10px] text-gray-500 font-medium">Payé, retrait en attente</span>
            </div>
          )
        })() : (
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
          {(v.modePaiement || '').replace('_', ' ')}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${(() => { const c = getStatutPaiementColors(v.statutPaiement); return `${c.bg} ${c.text} ${c.border}` })()}`}>
          {getStatutPaiementLabel(v.statutPaiement)}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-medium text-gray-900">
        {resteAPayer > 0 ? `${resteAPayer.toLocaleString('fr-FR')} F` : '-'}
      </td>
      <td className="px-4 py-3">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
          v.statutPaiement === 'REMBOURSE' ? 'bg-purple-100 text-purple-700' :
          v.statut === 'ANNULEE' ? 'bg-gray-200 text-gray-700' :
            'bg-green-100 text-green-800'
        }`}>
          {v.statutPaiement === 'REMBOURSE' ? 'Remboursé' :
           v.statut === 'ANNULEE' ? 'Annulée' : 'Validée'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {onPay && v.statutPaiement !== 'PAYE' && v.statut !== 'ANNULEE' && v.statutPaiement !== 'REMBOURSE' && (
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
          {v.retraitDiffere && v.statut !== 'ANNULEE' && onRetrait && (() => {
            const lignesList = v.lignes || []
            const totalQte = lignesList.reduce((s: number, l: any) => s + Number(l.quantite || 0), 0)
            const totalLivree = lignesList.reduce((s: number, l: any) => s + Number(l.quantiteLivree || 0), 0)
            if (totalLivree >= totalQte) return null
            return (
              <button
                onClick={() => onRetrait(v)}
                disabled={retraitant === v.id}
                className="rounded p-1.5 text-amber-600 hover:bg-amber-100 disabled:opacity-50"
                title="Retirer la marchandise"
              >
                {retraitant === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
              </button>
            )
          })()}
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
          {v.statut === 'VALIDEE' && v.statutPaiement !== 'REMBOURSE' && (
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
          {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && v.statutPaiement !== 'PAYE' && v.statutPaiement !== 'REMBOURSE' && (
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
