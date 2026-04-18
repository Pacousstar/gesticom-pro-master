'use client'

import { Eye, Edit2, XCircle, Trash2, Wallet, DollarSign } from 'lucide-react'
import { Vente } from './types'
import { formatDate } from '@/lib/format-date'
import Pagination from '@/components/ui/Pagination'

interface VenteTableProps {
  ventes: Vente[]
  loading: boolean
  pagination: { page: number; limit: number; total: number; totalPages: number } | null
  totals: { montantTotal: number; montantPaye: number; resteAPayer: number } | null
  userRole: string
  loadingDetail: number | null
  annulant: number | null
  supprimant: number | null
  onPageChange: (page: number) => void
  onVoirDetail: (id: number) => void
  onModifier: (v: Vente) => void
  onAnnuler: (v: Vente) => void
  onSupprimer: (v: Vente) => void
  onReglement: (v: Vente) => void
}

export default function VenteTable({
  ventes,
  loading,
  pagination,
  totals,
  userRole,
  loadingDetail,
  annulant,
  supprimant,
  onPageChange,
  onVoirDetail,
  onModifier,
  onAnnuler,
  onSupprimer,
  onReglement
}: VenteTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  if (ventes.length === 0) {
    return <p className="py-12 text-center text-gray-500">Aucune vente.</p>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">N°</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-orange-600">Bon N°</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 text-blue-600">Code Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Magasin</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Montant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Paiement</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Statut paiement</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Reste à payer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ventes.map((v) => {
              const resteAPayer = Math.max(0, Number(v.montantTotal) - (Number(v.montantPaye) || 0))
              return (
                <tr key={v.id} className={v.statut === 'ANNULEE' ? 'bg-gray-100' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 font-mono text-sm text-gray-900">{v.numero}</td>
                  <td className="px-4 py-3 text-sm font-bold text-orange-600">{(v as any).numeroBon || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(v.date, { includeTime: true })}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-blue-600 uppercase">
                    {(v as any).client?.code || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                    {(v as any).client?.nom || (v as any).clientLibre || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{v.magasin.code}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {Number(v.montantTotal).toLocaleString('fr-FR')} F
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5" title={(v.modePaiement || 'ESPECES') === 'ESPECES' ? "Espèces" : v.modePaiement}>
                      {(v.modePaiement || 'ESPECES') === 'ESPECES' ? (
                        <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Wallet className="h-3.5 w-3.5 text-blue-500" />
                      )}
                      {(v.modePaiement || '').replace('_', ' ')}
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
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${v.statut === 'ANNULEE' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>
                      {v.statut === 'ANNULEE' ? 'Annulée' : 'Validée'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {v.statutPaiement !== 'PAYE' && v.statut !== 'ANNULEE' && (
                        <button
                          onClick={() => onReglement(v)}
                          className="rounded p-1.5 text-orange-600 hover:bg-orange-100"
                          title="Enregistrer un règlement"
                        >
                          <Wallet className="h-4 w-4" />
                        </button>
                      )}
                      {v.statut !== 'ANNULEE' && (
                        <button
                          onClick={() => onModifier(v)}
                          className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                          title="Modifier la facture"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onVoirDetail(v.id)}
                        disabled={loadingDetail === v.id}
                        className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                        title="Voir le détail"
                      >
                        {loadingDetail === v.id ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div> : <Eye className="h-4 w-4" />}
                      </button>
                      {v.statut === 'VALIDEE' && (
                        <button
                          onClick={() => onAnnuler(v)}
                          disabled={annulant === v.id}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Annuler la vente"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                        <button
                          onClick={() => onSupprimer(v)}
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
            })}
          </tbody>
          {totals && (
            <tfoot className="bg-orange-50 font-bold text-gray-900 border-t-2 border-orange-200">
              <tr>
                <td colSpan={6} className="px-4 py-3 uppercase text-[10px] tracking-wider text-orange-800 font-black italic">Total de la Période</td>
                <td className="px-4 py-3 text-right text-orange-700 bg-orange-100/50">
                  {totals.montantTotal.toLocaleString('fr-FR')} F
                </td>
                <td colSpan={2} className="px-4 py-3 bg-gray-50/30"></td>
                <td className="px-4 py-3 text-right text-red-700 bg-red-50/50">
                  {totals.resteAPayer.toLocaleString('fr-FR')} F
                </td>
                <td colSpan={2} className="px-4 py-3 bg-gray-50/30"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {pagination && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
}
