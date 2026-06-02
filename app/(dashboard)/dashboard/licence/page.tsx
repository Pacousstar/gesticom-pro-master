'use client'

import { useState, useEffect } from 'react'
import { Shield, Info, Key, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'

export default function LicencePage() {
  const [licence, setLicence] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cle, setCle] = useState('')
  const [activationLoading, setActivationLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchLicence()
  }, [])

  async function fetchLicence() {
    try {
      const res = await fetch('/api/license')
      const data = await res.json()
      setLicence(data)
    } catch {
      setLicence({ active: false, statut: 'ERROR' })
    } finally {
      setLoading(false)
    }
  }

  async function activerLicence() {
    if (!cle.trim()) return
    setActivationLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cle: cle.trim() }),
      })
      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: data.message })
        setCle('')
        await fetchLicence()
      } else {
        setMessage({ type: 'error', text: data.error || "Erreur d'activation" })
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur de connexion au serveur' })
    } finally {
      setActivationLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl mt-20 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
      </div>
    )
  }

  const statutBadge = (statut: string) => {
    const variants: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800 border-green-300',
      ABSENTE: 'bg-gray-100 text-gray-700 border-gray-300',
      EXPIREE: 'bg-red-100 text-red-800 border-red-300',
      INVALIDE: 'bg-orange-100 text-orange-800 border-orange-300',
      VERSION_INCOMPATIBLE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
    return variants[statut] || 'bg-gray-100 text-gray-700 border-gray-300'
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-emerald-900">Licence</h1>
          <p className="text-sm text-gray-500">Gérez votre licence GestiCom Pro</p>
        </div>
        <Shield className="h-8 w-8 text-gray-400" />
      </div>

      {/* Statut actuel */}
      <div className="rounded-2xl border border-white/10 bg-gray-900/40 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-orange-500" />
          <h2 className="font-black text-white uppercase tracking-wider text-sm">Statut de la licence</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${statutBadge(licence?.statut)}`}>
              {licence?.statut === 'ACTIVE' ? 'Active' :
               licence?.statut === 'ABSENTE' ? 'Non installée' :
               licence?.statut === 'EXPIREE' ? 'Expirée' :
               licence?.statut === 'INVALIDE' ? 'Invalide' :
               licence?.statut === 'VERSION_INCOMPATIBLE' ? 'Version incompatible' : 'Inconnu'}
            </span>
            {licence?.active && <CheckCircle2 className="h-5 w-5 text-green-400" />}
            {licence?.statut === 'EXPIREE' && <AlertCircle className="h-5 w-5 text-red-400" />}
          </div>

          {licence?.clientNom && (
            <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-white/10">
              <div>
                <span className="text-gray-400">Client :</span>
                <p className="font-bold text-white">{licence.clientNom}</p>
              </div>
              {licence.finValidite && (
                <div>
                  <span className="text-gray-400">Expire le :</span>
                  <p className="font-bold text-white">{new Date(licence.finValidite).toLocaleDateString('fr-FR')}</p>
                </div>
              )}
              {!licence.finValidite && licence.active && (
                <div>
                  <span className="text-gray-400">Validité :</span>
                  <p className="font-bold text-blue-400">Perpétuelle</p>
                </div>
              )}
              <div>
                <span className="text-gray-400">Installée le :</span>
                <p className="font-bold text-white">
                  {licence.debutValidite ? new Date(licence.debutValidite).toLocaleDateString('fr-FR') : '-'}
                </p>
              </div>
            </div>
          )}

          {licence?.features?.length > 0 && licence.features[0] !== 'all' && (
            <div className="pt-4 border-t border-white/10">
              <span className="text-sm text-gray-400">Fonctionnalités :</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {licence.features.map((f: string) => (
                  <span key={f} className="px-2 py-1 rounded-md bg-orange-500/20 text-orange-400 text-xs font-bold border border-orange-500/30">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {licence?.erreur && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-xl p-3 border border-red-500/20">
              <AlertTriangle className="h-4 w-4" />
              {licence.erreur}
            </div>
          )}
        </div>
      </div>

      {/* Activer une licence */}
      <div className="rounded-2xl border border-white/10 bg-gray-900/40 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-orange-500" />
          <h2 className="font-black text-white uppercase tracking-wider text-sm">Activer une licence</h2>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Saisissez votre clé de licence pour activer GestiCom Pro
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Collez votre clé de licence ici..."
            value={cle}
            onChange={(e) => setCle(e.target.value)}
            className="flex-1 rounded-xl border border-white/10 bg-gray-900/50 px-4 py-3 text-sm text-white font-mono focus:border-orange-500 outline-none transition-all placeholder:text-white/20"
          />
          <button
            onClick={activerLicence}
            disabled={activationLoading || !cle.trim()}
            className="px-6 py-3 rounded-xl bg-orange-500 text-white font-black text-xs uppercase hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {activationLoading ? 'Activation...' : 'Activer'}
          </button>
        </div>

        {message && (
          <div className={`flex items-center gap-2 text-sm p-3 rounded-xl mt-4 ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}
      </div>
    </div>
  )
}
