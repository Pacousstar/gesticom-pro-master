'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, Lock, User } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/dashboard'
  const errorParam = searchParams.get('error')
  const [login, setLogin] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(errorParam === 'config' ? 'Configuration serveur manquante (SESSION_SECRET).' : null)
  const [loading, setLoading] = useState(false)
  const [hwid, setHwid] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [lockTime, setLockTime] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  // HWID non nécessaire en version déverrouillée
  useEffect(() => {
    setHwid(null)
  }, [])

  // Limiter les tentatives de connexion
  useEffect(() => {
    const stored = sessionStorage.getItem('loginAttempts')
    const storedLockTime = sessionStorage.getItem('lockTime')
    
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed)) {
        setAttempts(parsed)
      }
    }
    
    if (storedLockTime) {
      const lockTimestamp = parseInt(storedLockTime, 10)
      const now = Date.now()
      const elapsed = now - lockTimestamp
      const lockDuration = 5 * 60 * 1000 // 5 minutes en millisecondes
      
      if (elapsed < lockDuration) {
        setLockTime(lockTimestamp)
        setTimeRemaining(Math.ceil((lockDuration - elapsed) / 1000))
      } else {
        // Le verrouillage a expiré
        sessionStorage.removeItem('loginAttempts')
        sessionStorage.removeItem('lockTime')
        setAttempts(0)
        setLockTime(null)
      }
    }
  }, [])

  // Compte à rebours
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Le verrouillage a expiré
            sessionStorage.removeItem('loginAttempts')
            sessionStorage.removeItem('lockTime')
            setAttempts(0)
            setLockTime(null)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [timeRemaining])

  const resetLock = () => {
    sessionStorage.removeItem('loginAttempts')
    sessionStorage.removeItem('lockTime')
    setAttempts(0)
    setLockTime(null)
    setTimeRemaining(0)
    setError(null)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Vérifier les tentatives
    if (isLocked) {
      setError(`Trop de tentatives de connexion. Veuillez patienter ${formatTime(timeRemaining)} avant de réessayer, ou cliquez sur "Débloquer".`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, motDePasse, redirect: from }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        sessionStorage.setItem('loginAttempts', newAttempts.toString())
        
        // Si on atteint 5 tentatives, enregistrer l'heure du verrouillage
        if (newAttempts >= 5) {
          sessionStorage.setItem('lockTime', Date.now().toString())
          setLockTime(Date.now())
          setTimeRemaining(5 * 60) // 5 minutes
        }
        
        const err = data.error || 'Identifiants incorrects.'
        setError(data.hint ? `${err}\n\n${data.hint}` : err)
        return
      }
      
      // Réinitialiser les tentatives en cas de succès
      sessionStorage.removeItem('loginAttempts')
      setAttempts(0)
      
      router.push(data.redirect || from)
      router.refresh()
    } catch {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      sessionStorage.setItem('loginAttempts', newAttempts.toString())
      
      // Si on atteint 5 tentatives, enregistrer l'heure du verrouillage
      if (newAttempts >= 5) {
        sessionStorage.setItem('lockTime', Date.now().toString())
        setLockTime(Date.now())
        setTimeRemaining(5 * 60) // 5 minutes
      }
      
      setError('Erreur de connexion au serveur local.')
    } finally {
      setLoading(false)
    }
  }

  const isLocked = attempts >= 5 && timeRemaining > 0

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 flex items-center justify-center p-4">
      {/* Animations de fond */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-400/50 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-400/50 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/50 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob animation-delay-4000"></div>
      </div>

      {/* Grille animée */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite',
        }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 transform transition-all duration-700 hover:scale-[1.02]">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-orange-500 to-orange-700 rounded-full p-6 shadow-lg">
                <Image 
                  src="/logo.png" 
                  alt="GestiCom - Gestion de Commerce" 
                  width={200} 
                  height={52} 
                  className="h-12 md:h-16 w-auto object-contain" 
                  priority 
                />
              </div>
            </div>
          </div>
          <p className="text-orange-700 mt-4 font-semibold text-lg">
            Connexion sécurisée
          </p>
          <p className="text-sm mt-2 font-semibold text-[#0D6B0D]">Accédez à votre espace de travail</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm whitespace-pre-line flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">{error}</div>
            </div>
          )}

          {isLocked && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <strong>Compte temporairement verrouillé</strong>
                  <p className="mt-1">
                    Trop de tentatives de connexion. Veuillez patienter{' '}
                    {timeRemaining > 0 && (
                      <span className="font-bold">{formatTime(timeRemaining)}</span>
                    )}{' '}
                    avant de réessayer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetLock}
                  className="text-xs text-orange-600 hover:text-orange-700 underline font-medium whitespace-nowrap"
                  title="Réinitialiser le verrouillage"
                >
                  Débloquer
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-2">
              Identifiant
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
            <input
              id="login"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
                disabled={isLocked}
              autoComplete="username"
                className="w-full rounded-xl border-2 border-gray-300 pl-10 pr-4 py-3 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none transition-all duration-300 disabled:bg-gray-100 disabled:cursor-not-allowed hover:border-orange-400"
                placeholder="Votre identifiant"
            />
            </div>
          </div>

          <div>
            <label htmlFor="motDePasse" className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
            <input
              id="motDePasse"
                type={showPassword ? 'text' : 'password'}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
                disabled={isLocked}
              autoComplete="current-password"
                className="w-full rounded-xl border-2 border-gray-300 pl-10 pr-12 py-3 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none transition-all duration-300 disabled:bg-gray-100 disabled:cursor-not-allowed hover:border-orange-400"
              placeholder="••••••••"
            />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLocked}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {attempts > 0 && attempts < 5 && (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              ⚠️ Tentative {attempts} sur 5. Après 5 tentatives, votre compte sera temporairement verrouillé.
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full rounded-xl bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-semibold py-3.5 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-orange-500/50 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100 transform"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connexion en cours...
              </span>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-500">
            <Link href="/" className="text-orange-600 hover:text-orange-700 hover:underline font-medium transition-colors duration-200 inline-flex items-center gap-1 group">
              <span className="group-hover:-translate-x-1 transition-transform">←</span>
              <span>Retour à l&apos;accueil</span>
          </Link>
        </p>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            🔒 Connexion sécurisée par JWT
          </p>
        </div>

        {/* Affichage HWID retiré en version déverrouillée */}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 text-center text-gray-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4">Chargement…</p>
        </div>
      </div>
    }>
      <LoginForm />
      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        @keyframes gridMove {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </Suspense>
  )
}
