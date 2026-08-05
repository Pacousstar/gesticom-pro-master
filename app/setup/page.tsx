'use client'

import { useState, useEffect } from 'react'
import { Server, Database, CheckCircle2, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function SetupPage() {
  const [mode, setMode] = useState<'MODE_1' | 'MODE_2' | 'MODE_2_AUTO' | null>(null)
  const [pgHost, setPgHost] = useState('localhost')
  const [pgPort, setPgPort] = useState('5432')
  const [pgDb, setPgDb] = useState('gesticom')
  const [pgUser, setPgUser] = useState('gesticom')
  const [pgPassword, setPgPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/setup/status').then(r => r.json()).then(data => {
      if (data.configured) window.location.href = '/login'
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mode) return
    setSaving(true)
    setError('')

    try {
      const body: any = { mode: mode === 'MODE_2_AUTO' ? 'MODE_3' : mode }
      if (mode === 'MODE_2') {
        if (!pgPassword || pgPassword.length < 8) {
          setError('Le mot de passe PostgreSQL doit contenir au moins 8 caractères')
          setSaving(false)
          return
        }
        body.postgres = { host: pgHost, port: Number(pgPort), database: pgDb, user: pgUser, password: pgPassword }
      }
      if (mode === 'MODE_2_AUTO') {
        body.autoInstall = true
      }

      const res = await fetch('/api/setup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
      } else {
        setError(data.error || 'Erreur lors de la configuration')
      }
    } catch (e) {
      setError('Erreur réseau: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-orange-600 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-300" />
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">Configuration terminée</h1>
          <p className="text-orange-100 text-sm">
            {mode === 'MODE_1'
              ? 'GestiCom Pro est prêt en mode mono-poste.'
              : mode === 'MODE_2_AUTO'
              ? 'PostgreSQL installé et configuré automatiquement. Redémarrez l\'application.'
              : 'GestiCom Pro est configuré pour PostgreSQL. Redémarrez l\'application pour appliquer la configuration.'}
          </p>
          <button
            onClick={() => {
              if (mode === 'MODE_1') {
                window.location.href = '/login'
              } else {
                try { (window as any).electronAPI?.restartApp() } catch {}
                window.location.href = '/login'
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-4 font-black text-white text-sm uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/30"
          >
            {mode === 'MODE_1' ? 'Aller à la connexion' : 'Redémarrer l\'application'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-orange-600 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white uppercase tracking-tight mb-2">
            Configuration
          </h1>
          <p className="text-orange-100 text-sm">
            Première installation de GestiCom Pro
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!mode ? (
            <div className="grid grid-cols-1 gap-4">
              <button
                type="button"
                onClick={() => setMode('MODE_1')}
                className="group relative overflow-hidden rounded-2xl border-2 border-emerald-400/60 bg-emerald-500/10 p-8 text-left hover:bg-emerald-500/20 transition-all"
              >
                <div className="absolute top-3 right-3 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black text-white uppercase tracking-wider shadow-lg shadow-emerald-500/30">
                  Recommandé
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/20 shrink-0">
                    <Database className="h-6 w-6 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1">Mono-poste</h3>
                    <p className="text-orange-100 text-xs leading-relaxed">
                      Installation sur un seul ordinateur. Base de données locale (SQLite).<br />
                      Simple et rapide, aucun serveur requis.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('MODE_2')}
                className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-8 text-left hover:bg-white/20 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/20 shrink-0">
                    <Server className="h-6 w-6 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1">Multi-poste (Réseau)</h3>
                    <p className="text-orange-100 text-xs leading-relaxed">
                      Plusieurs postes connectés à une base PostgreSQL centralisée.<br />
                      Serveur PostgreSQL existant requis.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('MODE_2_AUTO')}
                className="group relative overflow-hidden rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-8 text-left hover:bg-emerald-500/20 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/20 shrink-0">
                    <Server className="h-6 w-6 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1">Multi-poste (Auto)</h3>
                    <p className="text-orange-100 text-xs leading-relaxed">
                      Installation clé en main.<br />
                      PostgreSQL sera téléchargé et configuré automatiquement.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/20 bg-white/10 p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {mode === 'MODE_1' ? (
                    <>
                      <div className="p-2 rounded-lg bg-emerald-500/20"><Database className="h-5 w-5 text-emerald-300" /></div>
                      <span className="text-lg font-black text-white uppercase tracking-tight">Mono-poste</span>
                    </>
                  ) : mode === 'MODE_2_AUTO' ? (
                    <>
                      <div className="p-2 rounded-lg bg-emerald-500/20"><Server className="h-5 w-5 text-emerald-300" /></div>
                      <span className="text-lg font-black text-white uppercase tracking-tight">Multi-poste (Auto)</span>
                    </>
                  ) : (
                    <>
                      <div className="p-2 rounded-lg bg-emerald-500/20"><Server className="h-5 w-5 text-emerald-300" /></div>
                      <span className="text-lg font-black text-white uppercase tracking-tight">Multi-poste</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="text-xs text-orange-200 hover:text-white uppercase tracking-widest font-bold transition-all"
                >
                  Modifier
                </button>
              </div>

              {mode === 'MODE_2_AUTO' && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-4 text-center">
                  <p className="text-emerald-200 text-sm font-bold">
                    PostgreSQL sera téléchargé et installé automatiquement.
                  </p>
                  <p className="text-orange-200/70 text-xs mt-1">
                    Téléchargement ~350 Mo · Configuration automatique
                  </p>
                </div>
              )}

              {mode === 'MODE_2' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-orange-200 uppercase tracking-wider mb-1 ml-1">Hôte</label>
                      <input
                        type="text"
                        value={pgHost}
                        onChange={(e) => setPgHost(e.target.value)}
                        placeholder="localhost"
                        className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white font-bold focus:border-emerald-400 outline-none transition-all placeholder:text-orange-200/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-orange-200 uppercase tracking-wider mb-1 ml-1">Port</label>
                      <input
                        type="text"
                        value={pgPort}
                        onChange={(e) => setPgPort(e.target.value)}
                        placeholder="5432"
                        className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white font-bold focus:border-emerald-400 outline-none transition-all placeholder:text-orange-200/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-orange-200 uppercase tracking-wider mb-1 ml-1">Nom de la base</label>
                    <input
                      type="text"
                      value={pgDb}
                      onChange={(e) => setPgDb(e.target.value)}
                      placeholder="gesticom"
                      className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white font-bold focus:border-emerald-400 outline-none transition-all placeholder:text-orange-200/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-orange-200 uppercase tracking-wider mb-1 ml-1">Utilisateur</label>
                      <input
                        type="text"
                        value={pgUser}
                        onChange={(e) => setPgUser(e.target.value)}
                        placeholder="gesticom"
                        className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white font-bold focus:border-emerald-400 outline-none transition-all placeholder:text-orange-200/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-orange-200 uppercase tracking-wider mb-1 ml-1">Mot de passe</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={pgPassword}
                          onChange={(e) => setPgPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white font-bold focus:border-emerald-400 outline-none transition-all placeholder:text-orange-200/50 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-emerald-300 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/20 border border-red-500/30">
                  <AlertCircle className="h-5 w-5 text-red-300 shrink-0 mt-0.5" />
                  <p className="text-red-200 text-xs font-bold">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-emerald-600 px-8 py-4 font-black text-white text-sm uppercase tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/30"
              >
                {saving ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Configuration en cours...</>
                ) : (
                  <><CheckCircle2 className="h-5 w-5" /> {mode === 'MODE_1' ? 'Confirmer mono-poste' : mode === 'MODE_2_AUTO' ? 'Installer PostgreSQL' : 'Tester et configurer'}</>
                )}
              </button>

              {mode === 'MODE_2' && (
                <p className="text-[10px] text-orange-200/60 italic text-center">
                  La connexion sera testée et la base de données initialisée automatiquement.
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
