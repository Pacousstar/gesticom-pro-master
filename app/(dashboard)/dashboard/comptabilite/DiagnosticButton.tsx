'use client'

import { useState } from 'react'
import { Activity, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

type DiagnosticData = {
  planComptes: {
    total: number
    parClasse: Array<{ classe: string; nombre: number }>
    comptesEssentiels: {
      existants: Array<{ numero: string; libelle: string }>
      manquants: Array<{ numero: string; libelle: string }>
    }
  }
  journaux: {
    total: number
    liste: Array<{ code: string; libelle: string; type: string }>
    journauxEssentiels: {
      existants: string[]
      manquants: string[]
    }
  }
  ecritures: {
    total: number
    parJournal: Array<{ journal: string; libelle: string; nombre: number }>
    parType: Array<{ type: string; nombre: number }>
    dernieres: Array<{
      date: string
      journal: string
      compte: string
      libelle: string
      debit: number
      credit: number
    }>
  }
  etat: {
    initialise: boolean
    pret: boolean
    aDesEcritures: boolean
  }
}

export default function DiagnosticButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DiagnosticData | null>(null)
  const [error, setError] = useState('')

  const fetchDiagnostic = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/comptabilite/diagnostic')
      if (!res.ok) throw new Error('Erreur lors du diagnostic')
      const diagnostic = await res.json()
      setData(diagnostic)
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={fetchDiagnostic}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Activity className="h-4 w-4" />
        )}
        Diagnostic
      </button>

      {open && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Diagnostic Comptabilité SYSCOHADA</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-900 hover:text-gray-900"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* État général */}
              <div className="rounded-lg border-2 p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-3 mb-3">
                  <Activity className="h-6 w-6 text-blue-600" />
                  <h3 className="text-lg font-bold text-gray-900">État du système</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    {data.etat.initialise ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {data.etat.initialise ? 'Initialisé' : 'Non initialisé'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {data.etat.pret ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {data.etat.pret ? 'Prêt' : 'À compléter'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {data.etat.aDesEcritures ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-gray-900" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {data.etat.aDesEcritures ? `${data.ecritures.total} écritures` : 'Aucune écriture'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Plan de Comptes */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Plan de Comptes</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-900">
                    <span className="font-semibold">{data.planComptes.total}</span> comptes actifs
                  </p>
                  {data.planComptes.parClasse.length > 0 && (
                    <div className="text-sm">
                      <span className="font-bold text-gray-900">Par classe :</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {data.planComptes.parClasse.map((c) => (
                          <span key={c.classe} className="px-2 py-1 bg-gray-100 rounded text-gray-900">
                            Classe {c.classe}: {c.nombre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.planComptes.comptesEssentiels.manquants.length > 0 && (
                    <div className="mt-3 p-3 bg-orange-50 rounded border border-orange-200">
                      <p className="text-sm font-medium text-orange-800 mb-1">Comptes manquants :</p>
                      <ul className="text-sm text-orange-700 list-disc list-inside">
                        {data.planComptes.comptesEssentiels.manquants.map((c) => (
                          <li key={c.numero}>{c.numero} - {c.libelle}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Journaux */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Journaux</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-900">
                    <span className="font-semibold">{data.journaux.total}</span> journaux actifs
                  </p>
                  {data.journaux.liste.length > 0 && (
                    <div className="text-sm">
                      <span className="font-bold text-gray-900">Journaux :</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {data.journaux.liste.map((j) => (
                          <span key={j.code} className="px-2 py-1 bg-purple-100 rounded text-purple-700">
                            {j.code} - {j.libelle}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.journaux.journauxEssentiels.manquants.length > 0 && (
                    <div className="mt-3 p-3 bg-orange-50 rounded border border-orange-200">
                      <p className="text-sm font-medium text-orange-800 mb-1">Journaux manquants :</p>
                      <ul className="text-sm text-orange-700 list-disc list-inside">
                        {data.journaux.journauxEssentiels.manquants.map((j) => (
                          <li key={j}>{j}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Écritures */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Écritures Comptables</h3>
                <div className="space-y-3">
                  <p className="text-sm text-gray-900">
                    <span className="font-semibold">{data.ecritures.total}</span> écritures au total
                  </p>
                  {data.ecritures.parJournal.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-1">Par journal :</p>
                      <div className="space-y-1">
                        {data.ecritures.parJournal.map((e) => (
                          <div key={e.journal} className="text-sm text-gray-900">
                            <span className="font-medium">{e.journal}</span> ({e.libelle}): {e.nombre} écritures
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.ecritures.parType.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-1">Par type :</p>
                      <div className="flex flex-wrap gap-2">
                        {data.ecritures.parType.map((e) => (
                          <span key={e.type} className="px-2 py-1 bg-green-100 rounded text-green-700 text-sm">
                            {e.type}: {e.nombre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.ecritures.dernieres.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-2">5 dernières écritures :</p>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-gray-900">
                          <thead className="bg-gray-200 text-gray-900">
                            <tr>
                              <th className="px-2 py-1 text-left font-bold">Date</th>
                              <th className="px-2 py-1 text-left font-bold">Journal</th>
                              <th className="px-2 py-1 text-left font-bold">Compte</th>
                              <th className="px-2 py-1 text-right font-bold">Débit</th>
                              <th className="px-2 py-1 text-right font-bold">Crédit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {data.ecritures.dernieres.map((e, i) => (
                              <tr key={i} className="bg-white text-gray-900 hover:bg-gray-50">
                                <td className="px-2 py-1 text-gray-900">{e.date}</td>
                                <td className="px-2 py-1 text-gray-900">{e.journal}</td>
                                <td className="px-2 py-1 text-gray-900">{e.compte}</td>
                                <td className="px-2 py-1 text-right text-gray-900">{e.debit > 0 ? e.debit.toLocaleString('fr-FR') : '—'}</td>
                                <td className="px-2 py-1 text-right text-gray-900">{e.credit > 0 ? e.credit.toLocaleString('fr-FR') : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommandations */}
              {(!data.etat.pret || !data.etat.aDesEcritures) && (
                <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4">
                  <h3 className="text-lg font-bold text-orange-900 mb-2">Recommandations</h3>
                  <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
                    {!data.etat.initialise && (
                      <li>Cliquez sur "Initialiser SYSCOHADA" pour créer les comptes et journaux de base</li>
                    )}
                    {data.planComptes.comptesEssentiels.manquants.length > 0 && (
                      <li>Initialisez SYSCOHADA pour créer les comptes manquants</li>
                    )}
                    {data.journaux.journauxEssentiels.manquants.length > 0 && (
                      <li>Initialisez SYSCOHADA pour créer les journaux manquants</li>
                    )}
                    {data.etat.pret && !data.etat.aDesEcritures && (
                      <li>Créez des opérations (ventes, achats, dépenses) pour générer automatiquement des écritures</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
    </>
  )
}
