'use client'

import { Printer, Edit2, Wallet, X, Loader2 } from 'lucide-react'
import { VenteDetail } from './types'

interface VenteDetailModalProps {
  detailVente: VenteDetail
  userRole: string
  onClose: () => void
  onImprimer: () => void
  onModifier: (v: VenteDetail) => void
  onReglement: (id: number, numero: string, reste: number) => void
}

export default function VenteDetailModal({
  detailVente,
  userRole,
  onClose,
  onImprimer,
  onModifier,
  onReglement
}: VenteDetailModalProps) {
  const resteAPayer = Number(detailVente.montantTotal) - (Number(detailVente.montantPaye) || 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Détail vente {detailVente.numero}</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onImprimer} className="rounded-lg border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1.5" title="Imprimer le reçu">
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
            {detailVente.statut !== 'ANNULEE' && (
              <button
                onClick={() => onModifier(detailVente)}
                className="rounded-lg border-2 border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 flex items-center gap-1.5"
                title="Modifier cette facture"
              >
                <Edit2 className="h-4 w-4" />
                Modifier
              </button>
            )}
            {detailVente.statutPaiement !== 'PAYE' && detailVente.statut !== 'ANNULEE' && (
              <button
                onClick={() => onReglement(detailVente.id, detailVente.numero, resteAPayer)}
                className="rounded-lg border-2 border-orange-300 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 flex items-center gap-1.5"
                title="Enregistrer un nouveau règlement"
              >
                <Wallet className="h-4 w-4" />
                Régler
              </button>
            )}
            <button onClick={onClose} className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div><span className="font-medium text-gray-700">Date :</span> <span className="text-gray-900">{new Date(detailVente.date).toLocaleString('fr-FR')}</span></div>
            <div><span className="font-medium text-gray-700">Magasin :</span> <span className="text-gray-900">{detailVente.magasin.code} – {detailVente.magasin.nom}</span></div>
            <div><span className="font-medium text-gray-700">Client :</span> <span className="text-gray-900">{detailVente.client?.nom || detailVente.clientLibre || '—'}</span></div>
            <div><span className="font-medium text-gray-700">Paiement :</span> <span className="text-gray-900">{detailVente.modePaiement}</span></div>
            <div><span className="font-medium text-gray-700">Statut paiement :</span>
              <span className={`ml-1 rounded px-2 py-0.5 text-xs font-medium ${detailVente.statutPaiement === 'PAYE' ? 'bg-green-100 text-green-800' :
                detailVente.statutPaiement === 'PARTIEL' ? 'bg-amber-100 text-amber-800' :
                  detailVente.statutPaiement === 'CREDIT' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700'
                }`}>
                {detailVente.statutPaiement === 'PAYE' ? 'Payé' : detailVente.statutPaiement === 'PARTIEL' ? 'Partiel' : detailVente.statutPaiement === 'CREDIT' ? 'Crédit' : '—'}
              </span>
            </div>
            <div><span className="font-medium text-gray-700">Montant payé (avance) :</span> <span className="text-gray-900">{(Number(detailVente.montantPaye) || 0).toLocaleString('fr-FR')} FCFA</span></div>
            <div><span className="font-medium text-gray-700">Reste à payer :</span> <strong className="text-amber-800">{resteAPayer.toLocaleString('fr-FR')} FCFA</strong></div>
            <div><span className="font-medium text-gray-700">Statut :</span>
              <span className={`ml-1 rounded px-2 py-0.5 text-xs font-medium ${detailVente.statut === 'ANNULEE' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>
                {detailVente.statut === 'ANNULEE' ? 'Annulée' : 'Validée'}
              </span>
            </div>
            {detailVente.numeroBon && (
              <div><span className="font-medium text-orange-600">Numéro de BON :</span> <span className="text-gray-900 font-bold">{detailVente.numeroBon}</span></div>
            )}
          </div>
          {detailVente.observation && <p className="text-sm"><span className="font-medium text-gray-700">Observation :</span> <span className="text-gray-900">{detailVente.observation}</span></p>}
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-left text-gray-800"><th className="px-4 py-2">Désignation</th><th className="px-4 py-2 text-right">Qté</th><th className="px-4 py-2 text-right">P.U.</th><th className="px-4 py-2 text-right">Remise</th><th className="px-4 py-2 text-right">TVA</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {detailVente.lignes.map((l: any, i: number) => (
                  <tr key={i}><td className="px-4 py-2 text-gray-900">{l.designation}</td><td className="px-4 py-2 text-right text-gray-900">{l.quantite}</td><td className="px-4 py-2 text-right text-gray-900">{(l.prixUnitaire).toLocaleString('fr-FR')} F</td><td className="px-4 py-2 text-right text-red-600">{(l.remise ? `-${l.remise}` : '0')} F</td><td className="px-4 py-2 text-right text-gray-900">{l.tvaPerc || 0}%</td><td className="px-4 py-2 text-right font-medium text-emerald-700">{(l.montant || 0).toLocaleString('fr-FR')} F</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-right font-semibold text-gray-900">Montant total : {Number(detailVente.montantTotal).toLocaleString('fr-FR')} FCFA</p>
        </div>
      </div>
    </div>
  )
}
