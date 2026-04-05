'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, Lock, User, Mail, Shield, Building2, UserPlus } from 'lucide-react'
import { getSession } from '@/lib/auth'

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'COMPTABLE' | 'GESTIONNAIRE' | 'MAGASINIER' | 'ASSISTANTE'

const ROLES: { value: Role; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Administrateur' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'COMPTABLE', label: 'Comptable' },
  { value: 'GESTIONNAIRE', label: 'Gestionnaire' },
  { value: 'MAGASINIER', label: 'Magasinier' },
  { value: 'ASSISTANTE', label: 'Assistante' },
]

function RegisterForm() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<Role>('ASSISTANTE')
  const [entiteId, setEntiteId] = useState<number>(0)
  const [entites, setEntites] = useState<{ id: number; nom: string }[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [authorized, setAuthorized] = useState<boolean | null>(null)

  // Vérifier l'autorisation
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/check')
        if (res.ok) {
          const data = await res.json()
          if (data.role === 'SUPER_ADMIN' || data.role === 'ADMIN') {
            setAuthorized(true)
            // Charger les entités
            const entitesRes = await fetch('/api/entites')
            if (entitesRes.ok) {
              const entitesData = await entitesRes.json()
              setEntites(entitesData)
              if (entitesData.length > 0) {
                setEntiteId(entitesData[0].id)
              }
            }
          } else {
            setAuthorized(false)
          }
        } else {
          setAuthorized(false)
        }
      } catch {
        setAuthorized(false)
      }
    }
    checkAuth()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validations
    if (motDePasse !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    if (motDePasse.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    if (!entiteId) {
      setError('Veuillez sélectionner une entité.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          nom,
          email: email || undefined,
          motDePasse,
          role,
          entiteId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création de l\'utilisateur.')
        return
      }
      
      // Rediriger vers la liste des utilisateurs ou le dashboard
      router.push('/dashboard/utilisateurs?success=created')
      router.refresh()
    } catch {
      setError('Erreur de connexion. Vérifiez votre connexion internet.')
    } finally {
      setLoading(false)
    }
  }

  if (authorized === null) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center text-gray-500">
          Vérification des autorisations...
        </div>
      </div>
    )
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-4">
            <Shield className="h-16 w-16 text-red-500 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h1>
          <p className="text-gray-600 mb-6">Vous n'avez pas les permissions nécessaires pour créer un utilisateur.</p>
          <Link href="/dashboard" className="text-orange-500 hover:underline font-medium">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700">
      {/* Animations de fond */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-400/30 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-400/30 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/30 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>
      {/* Grille animée */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite',
        }}></div>
      </div>
      <div className="relative z-10 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-orange-100 rounded-full p-3">
              <UserPlus className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <Image src="/logo.png" alt="GestiCom - Gestion de Commerce" width={200} height={52} className="mx-auto h-12 w-auto object-contain" priority />
          <p className="text-gray-600 mt-3 font-medium">Créer un nouvel utilisateur</p>
          <p className="text-gray-400 text-sm mt-1">Ajoutez un nouveau collaborateur au système</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-2">
                Identifiant <span className="text-red-500">*</span>
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
                  autoComplete="username"
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                  placeholder="identifiant"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Lettres, chiffres, tirets et underscores uniquement</p>
            </div>

            <div>
              <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">
                Nom complet <span className="text-red-500">*</span>
              </label>
              <input
                id="nom"
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                placeholder="Nom complet"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email (optionnel)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                placeholder="email@exemple.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Rôle <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shield className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  required
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none appearance-none bg-white"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="entiteId" className="block text-sm font-medium text-gray-700 mb-2">
                Entité <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  id="entiteId"
                  value={entiteId}
                  onChange={(e) => setEntiteId(Number(e.target.value))}
                  required
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none appearance-none bg-white"
                >
                  <option value={0}>Sélectionner une entité</option>
                  {entites.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="motDePasse" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe <span className="text-red-500">*</span>
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
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-12 py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">Minimum 8 caractères</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmer le mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-12 py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Création en cours...
              </span>
            ) : (
              'Créer l\'utilisateur'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-500">
            <Link href="/dashboard" className="text-orange-500 hover:text-orange-600 hover:underline font-medium">
              ← Retour au tableau de bord
            </Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 text-center text-gray-500">
          Chargement...
        </div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
