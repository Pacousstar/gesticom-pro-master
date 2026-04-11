'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Users, Edit, Trash2, Shield, Loader2, CheckCircle2, XCircle, Eye, EyeOff, Lock, X, Save, Printer } from 'lucide-react'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'
import { ROLE_PERMISSIONS, type Role, type Permission } from '@/lib/roles-permissions'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'

type Utilisateur = {
  id: number
  login: string
  nom: string
  email: string | null
  role: string
  permissionsPersonnalisees: string | null
  actif: boolean
  entite: {
    id: number
    nom: string
  }
  createdAt: string
}

// Obtenir toutes les permissions possibles
const getAllPermissions = (): Permission[] => {
  const allPerms = new Set<Permission>()
  Object.values(ROLE_PERMISSIONS).forEach(perms => {
    perms.forEach(p => allPerms.add(p))
  })
  return Array.from(allPerms).sort()
}

export default function UtilisateursPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string>('Utilisateur créé avec succès !')
  const { success: showSuccessToast, error: showErrorToast } = useToast()
  const [showEdit, setShowEdit] = useState(false)
  const [editingUser, setEditingUser] = useState<Utilisateur | null>(null)
  const [editForm, setEditForm] = useState({
    nom: '',
    email: '',
    role: 'ASSISTANTE' as 'SUPER_ADMIN' | 'ADMIN' | 'COMPTABLE' | 'GESTIONNAIRE' | 'MAGASINIER' | 'ASSISTANTE',
    permissionsPersonnalisees: [] as Permission[],
    useCustomPermissions: false,
    entiteId: 0,
    actif: true,
    motDePasse: '',
    confirmPassword: '',
    changePassword: false,
  })
  const [entites, setEntites] = useState<{ id: number; nom: string }[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  /** Rôles supplémentaires (droits en plus du rôle principal), ex. ASSISTANTE + COMPTABLE */
  const [editRolesSupplementaires, setEditRolesSupplementaires] = useState<Role[]>([])
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  useEffect(() => {
    if (success === 'created') {
      setSuccessMessage('Utilisateur créé avec succès !')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      router.replace('/dashboard/utilisateurs')
    }
    loadUtilisateurs()
    loadEntites()
  }, [success, router])

  async function loadEntites() {
    try {
      const res = await fetch('/api/entites')
      if (res.ok) {
        const data = await res.json()
        setEntites(data)
      }
    } catch (err) {
      console.error('Erreur chargement entités:', err)
    }
  }

  async function loadUtilisateurs() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/utilisateurs')
      const data = await res.json()
      if (res.ok) {
        setUtilisateurs(data)
      } else {
        setError(data.error || 'Erreur lors du chargement des utilisateurs.')
      }
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err)
      setError('Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'COMPTABLE':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'GESTIONNAIRE':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'MAGASINIER':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'ASSISTANTE':
        return 'bg-pink-100 text-pink-800 border-pink-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      SUPER_ADMIN: 'Super Admin',
      ADMIN: 'Administrateur',
      COMPTABLE: 'Comptable',
      GESTIONNAIRE: 'Gestionnaire',
      MAGASINIER: 'Magasinier',
      ASSISTANTE: 'Assistante',
    }
    return labels[role] || role
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const handleEdit = (user: Utilisateur) => {
    setEditingUser(user)
    let customPerms: Permission[] = []
    if (user.permissionsPersonnalisees) {
      try {
        customPerms = JSON.parse(user.permissionsPersonnalisees) as Permission[]
      } catch (e) {
        console.error('Erreur parsing permissions:', e)
        customPerms = []
      }
    }
    setEditForm({
      nom: user.nom,
      email: user.email || '',
      role: user.role as any,
      permissionsPersonnalisees: customPerms,
      useCustomPermissions: customPerms.length > 0,
      entiteId: user.entite.id,
      actif: user.actif,
      motDePasse: '',
      confirmPassword: '',
      changePassword: false,
    })
    setEditRolesSupplementaires([])
    setShowEdit(true)
    setError(null)
  }

  const handleSave = async () => {
    if (!editingUser) return

    setError(null)

    // Validations
    if (!editForm.nom.trim()) {
      setError('Le nom est requis.')
      return
    }

    if (editForm.changePassword) {
      if (editForm.motDePasse.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères.')
        return
      }
      if (editForm.motDePasse !== editForm.confirmPassword) {
        setError('Les mots de passe ne correspondent pas.')
        return
      }
    }

    if (!editForm.entiteId) {
      setError('Veuillez sélectionner une entité.')
      return
    }

    setSaving(true)
    try {
      // Priorité 1 : si "Utiliser des permissions personnalisées" est coché, on envoie la liste cochée (sinon les ajouts ne sont pas pris en compte)
      // Priorité 2 : si "Droits supplémentaires" (rôles en plus) sans permissions personnalisées, on envoie la fusion rôle + supplémentaires
      // Sinon : null = uniquement les permissions du rôle
      let permissionsPersonnalisees: Permission[] | null = null
      if (editForm.useCustomPermissions) {
        permissionsPersonnalisees = editForm.permissionsPersonnalisees
      } else if (editRolesSupplementaires.length > 0) {
        const base = ROLE_PERMISSIONS[editForm.role] || []
        const supplementaires = editRolesSupplementaires.flatMap((r) => ROLE_PERMISSIONS[r] || [])
        permissionsPersonnalisees = [...new Set([...base, ...supplementaires])]
      }

      const updateData: any = {
        nom: editForm.nom.trim(),
        email: editForm.email.trim() || undefined,
        role: editForm.role,
        entiteId: editForm.entiteId,
        actif: editForm.actif,
        permissionsPersonnalisees,
      }

      if (editForm.changePassword) {
        updateData.motDePasse = editForm.motDePasse
      }

      const res = await fetch(`/api/utilisateurs/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la modification de l\'utilisateur.')
        return
      }

      setShowEdit(false)
      setEditingUser(null)
      setSuccessMessage('Utilisateur modifié avec succès.')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      loadUtilisateurs()
      showSuccessToast('Utilisateur modifié avec succès.')
    } catch (err) {
      console.error('Erreur modification utilisateur:', err)
      const errorMsg = formatApiError(err)
      setError(errorMsg)
      showErrorToast(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (userId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir désactiver cet utilisateur ?')) {
      return
    }

    setDeleting(userId)
    setError(null)
    try {
      const res = await fetch(`/api/utilisateurs/${userId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const errorMsg = formatApiError(data?.error || 'Erreur lors de la désactivation de l\'utilisateur.')
        setError(errorMsg)
        showErrorToast(errorMsg)
        return
      }

      setSuccessMessage('Utilisateur désactivé avec succès.')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      setUtilisateurs((prev) => prev.filter((u) => u.id !== userId))
      showSuccessToast('Utilisateur désactivé avec succès.')
    } catch (err) {
      console.error('Erreur suppression utilisateur:', err)
      const errorMsg = formatApiError(err)
      setError(errorMsg)
      showErrorToast(errorMsg)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestion des utilisateurs</h1>
          <p className="text-white/90 mt-1">Créer et gérer les utilisateurs du système</p>
        </div>
        <div className="flex items-center gap-2">
                <div className="hidden print:block absolute inset-0 bg-white">
                    {chunkArray(utilisateurs, ITEMS_PER_PRINT_PAGE).map((chunk: Utilisateur[], index: number, allChunks: Utilisateur[][]) => (
                        <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
                            <ListPrintWrapper
                                title="Répertoire du Personnel"
                                subtitle={`Organigramme et Accès Système - ${utilisateurs.length} Utilisateurs`}
                                pageNumber={index + 1}
                                totalPages={allChunks.length}
                                hideHeader={index > 0}
                                hideVisa={index < allChunks.length - 1}
                            >
                                <table className="w-full text-[14px] border-collapse border-2 border-black">
                                    <thead>
                                        <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                            <th className="border-r-2 border-black px-3 py-3 text-left">Nom & Prénom</th>
                                            <th className="border-r-2 border-black px-3 py-3 text-left">Identifiant</th>
                                            <th className="border-r-2 border-black px-3 py-3 text-left">Rôle Système</th>
                                            <th className="border-r-2 border-black px-3 py-3 text-left">Affectation</th>
                                            <th className="px-3 py-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chunk.map((u: Utilisateur, idx: number) => (
                                            <tr key={idx} className="border-b border-black">
                                                <td className="border-r-2 border-black px-3 py-2 font-bold uppercase">{u.nom}</td>
                                                <td className="border-r-2 border-black px-3 py-2 font-mono text-xs">{u.login}</td>
                                                <td className="border-r-2 border-black px-3 py-2 font-black">{getRoleLabel(u.role)}</td>
                                                <td className="border-r-2 border-black px-3 py-2 italic">{u.entite.nom}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`font-black uppercase text-[10px] ${u.actif ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                        {u.actif ? 'OPÉRATIONNEL' : 'SUSPENDU'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {index === allChunks.length - 1 && (
                                        <tfoot>
                                            <tr className="bg-gray-50 font-black text-[15px] border-t-2 border-black uppercase italic">
                                                <td colSpan={3} className="border-r-2 border-black px-3 py-4 text-right bg-white shadow-inner">Total Effectif Système</td>
                                                <td colSpan={2} className="px-3 py-4 bg-white text-blue-900 underline decoration-double">{utilisateurs.length} Agents répertoriés</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </ListPrintWrapper>
                        </div>
                    ))}
                </div>

                {/* MODALE D'APERÇU IMPRESSION RÉPERTOIRE PERSONNEL */}
                {isPreviewOpen && (
                  <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter">
                    <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
                        <div className="flex items-center gap-6">
                           <div>
                             <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Répertoire Personnel</h2>
                             <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                               Contrôle des Accès et Identités Système
                             </p>
                           </div>
                           <div className="h-10 w-px bg-gray-200" />
                           <div className="flex items-center gap-2">
                             <span className="rounded-full bg-orange-100 px-4 py-2 text-xs font-black text-orange-600 uppercase">
                               {utilisateurs.length} Profils
                             </span>
                           </div>
                        </div>
                        <div className="flex gap-4">
                          <button
                            onClick={() => setIsPreviewOpen(false)}
                            className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase"
                          >
                            Fermer
                          </button>
                          <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 rounded-xl bg-orange-600 px-10 py-2 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 uppercase"
                          >
                            <Printer className="h-4 w-4" />
                            Lancer l'impression
                          </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
                        <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-4 text-slate-900 not-italic tracking-normal">
                            {chunkArray(utilisateurs, ITEMS_PER_PRINT_PAGE).map((chunk: Utilisateur[], index: number, allChunks: Utilisateur[][]) => (
                                <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0">
                                    <ListPrintWrapper
                                        title="RÉPERTOIRE DU PERSONNEL"
                                        subtitle="Audit des Accès et Droits Utilisateurs"
                                        pageNumber={index + 1}
                                        totalPages={allChunks.length}
                                        hideHeader={index > 0}
                                        hideVisa={index < allChunks.length - 1}
                                    >
                                        <table className="w-full text-[14px] border-collapse border-2 border-black">
                                            <thead>
                                                <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                                    <th className="border-r-2 border-black px-3 py-3 text-left">Agent / Identité</th>
                                                    <th className="border-r-2 border-black px-3 py-3 text-left">Login</th>
                                                    <th className="border-r-2 border-black px-3 py-3 text-left">Rôle</th>
                                                    <th className="border-r-2 border-black px-3 py-3 text-left">Affectation</th>
                                                    <th className="px-3 py-3 text-center">Statut</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {chunk.map((u: Utilisateur, idx: number) => (
                                                    <tr key={idx} className="border-b border-black">
                                                        <td className="border-r-2 border-black px-3 py-2 font-bold uppercase">{u.nom}</td>
                                                        <td className="border-r-2 border-black px-3 py-2 font-mono text-xs">{u.login}</td>
                                                        <td className="border-r-2 border-black px-3 py-2 font-black">{getRoleLabel(u.role)}</td>
                                                        <td className="border-r-2 border-black px-3 py-2 italic tabular-nums">{u.entite.nom}</td>
                                                        <td className="px-3 py-2 text-center font-black text-[10px]">
                                                            {u.actif ? 'ACTIF' : 'INACTIF'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            {index === allChunks.length - 1 && (
                                                <tfoot>
                                                    <tr className="bg-gray-50 font-black text-[15px] border-t-2 border-black uppercase italic">
                                                        <td colSpan={3} className="border-r-2 border-black px-3 py-4 text-right bg-white">Volume Personnel Répertorié</td>
                                                        <td colSpan={2} className="px-3 py-4 bg-white text-blue-900 underline decoration-double shadow-inner">{utilisateurs.length} Utilisateurs</td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </ListPrintWrapper>
                                </div>
                            ))}
                        </div>
                    </div>
                  </div>
                )}
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-2 border-2 border-slate-800 bg-slate-100 text-slate-900 hover:bg-slate-200 font-black px-4 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl uppercase text-xs no-print"
          >
            <Printer className="h-5 w-5" />
            Aperçu Impression
          </button>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-black px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl uppercase text-xs no-print"
          >
            <UserPlus className="h-5 w-5" />
            Nouveau
          </Link>
        </div>
      </div>

      {showSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : utilisateurs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 mb-4">Aucun utilisateur trouvé</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
          >
            <UserPlus className="h-5 w-5" />
            Créer le premier utilisateur
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Utilisateur</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Rôle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Entité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Créé le</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {utilisateurs.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-semibold">
                          {user.nom.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.nom}</div>
                          <div className="text-xs text-gray-500">{user.login}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.entite.nom}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.actif ? (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                          Actif
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={deleting === user.id}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Désactiver"
                        >
                          {deleting === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de modification */}
      {showEdit && editingUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEdit(false)
              setEditingUser(null)
              setError(null)
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Modifier l'utilisateur</h2>
              <button
                onClick={() => {
                  setShowEdit(false)
                  setEditingUser(null)
                  setError(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-5">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Login (non modifiable)
                </label>
                <input
                  type="text"
                  value={editingUser.login}
                  disabled
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom complet <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.nom}
                  onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                  placeholder="email@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Rôle <span className="text-red-500">*</span>
                   </label>
                   <select
                     value={editForm.role}
                     onChange={(e) => {
                       const newRole = e.target.value as Role
                       setEditForm({ 
                         ...editForm, 
                         role: newRole,
                         // Réinitialiser les permissions personnalisées si on change de rôle
                         permissionsPersonnalisees: editForm.useCustomPermissions 
                           ? editForm.permissionsPersonnalisees 
                           : [...(ROLE_PERMISSIONS[newRole] || [])]
                       })
                     }}
                     className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                   >
                     <option value="SUPER_ADMIN">Super Administrateur</option>
                     <option value="ADMIN">Administrateur</option>
                     <option value="COMPTABLE">Comptable</option>
                     <option value="GESTIONNAIRE">Gestionnaire</option>
                     <option value="MAGASINIER">Magasinier</option>
                     <option value="ASSISTANTE">Assistante</option>
                   </select>
                 </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entité <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editForm.entiteId}
                    onChange={(e) => setEditForm({ ...editForm, entiteId: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                    required
                  >
                    <option value="0">Sélectionner une entité</option>
                    {entites.map((entite) => (
                      <option key={entite.id} value={entite.id}>
                        {entite.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="actif"
                  checked={editForm.actif}
                  onChange={(e) => setEditForm({ ...editForm, actif: e.target.checked })}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="actif" className="text-sm font-medium text-gray-700">
                  Compte actif
                </label>
              </div>

              {/* Droits supplémentaires : attribuer des rôles en plus du rôle principal */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Droits supplémentaires</h3>
                <p className="text-sm text-gray-600 mb-3">
                  En plus du rôle <strong>{getRoleLabel(editForm.role)}</strong>, vous pouvez attribuer les droits d&apos;un ou plusieurs autres rôles (ex. Comptable pour une assistante).
                </p>
                <div className="flex flex-wrap gap-3">
                  {(['ADMIN', 'COMPTABLE', 'GESTIONNAIRE', 'MAGASINIER', 'ASSISTANTE'] as Role[]).filter((r) => r !== editForm.role).map((role) => {
                    const isChecked = editRolesSupplementaires.includes(role)
                    return (
                      <label key={role} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditRolesSupplementaires((prev) => [...prev, role])
                            } else {
                              setEditRolesSupplementaires((prev) => prev.filter((x) => x !== role))
                            }
                          }}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">{getRoleLabel(role)}</span>
                      </label>
                    )
                  })}
                  {editForm.role !== 'SUPER_ADMIN' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editRolesSupplementaires.includes('SUPER_ADMIN')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditRolesSupplementaires((prev) => [...prev, 'SUPER_ADMIN'])
                          } else {
                            setEditRolesSupplementaires((prev) => prev.filter((x) => x !== 'SUPER_ADMIN'))
                          }
                        }}
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700">{getRoleLabel('SUPER_ADMIN')}</span>
                    </label>
                  )}
                </div>
                {editRolesSupplementaires.length > 0 && (
                  <p className="text-xs text-blue-600 mt-2">
                    Droits fusionnés : {editForm.role} + {editRolesSupplementaires.join(', ')}
                  </p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Permissions</h3>
                
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="useCustomPermissions"
                    checked={editForm.useCustomPermissions}
                    onChange={(e) => {
                      const useCustom = e.target.checked
                      setEditForm({ 
                        ...editForm, 
                        useCustomPermissions: useCustom,
                        permissionsPersonnalisees: useCustom 
                          ? [...(ROLE_PERMISSIONS[editForm.role as Role] || [])]
                          : []
                      })
                    }}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="useCustomPermissions" className="text-sm font-medium text-gray-700">
                    Utiliser des permissions personnalisées (au lieu des permissions du rôle)
                  </label>
                </div>

                {editForm.useCustomPermissions ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800 mb-3 font-medium">
                      Permissions personnalisées — Cochez les permissions à attribuer à cet utilisateur
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                      {getAllPermissions().map((perm) => {
                        const [module, action] = perm.split(':')
                        const isChecked = editForm.permissionsPersonnalisees.includes(perm)
                        return (
                          <div key={perm} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`perm-${perm}`}
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditForm({
                                    ...editForm,
                                    permissionsPersonnalisees: [...editForm.permissionsPersonnalisees, perm]
                                  })
                                } else {
                                  setEditForm({
                                    ...editForm,
                                    permissionsPersonnalisees: editForm.permissionsPersonnalisees.filter(p => p !== perm)
                                  })
                                }
                              }}
                              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                            />
                            <label htmlFor={`perm-${perm}`} className="text-sm text-gray-700 cursor-pointer">
                              <span className="font-medium">{module}</span>
                              <span className="text-gray-500">:{action}</span>
                            </label>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-blue-700 mt-3">
                      Total: {editForm.permissionsPersonnalisees.length} permission(s) sélectionnée(s)
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Les permissions sont définies par le rôle <strong>{editForm.role}</strong>. 
                      Activez les permissions personnalisées ci-dessus pour modifier individuellement.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                      {ROLE_PERMISSIONS[editForm.role as Role]?.map((perm) => {
                        const [module, action] = perm.split(':')
                        return (
                          <div key={perm} className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-gray-700">
                              <span className="font-medium">{module}</span>
                              <span className="text-gray-500">:{action}</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Total: {ROLE_PERMISSIONS[editForm.role as Role]?.length || 0} permission(s)
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="changePassword"
                    checked={editForm.changePassword}
                    onChange={(e) => setEditForm({ ...editForm, changePassword: e.target.checked, motDePasse: '', confirmPassword: '' })}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="changePassword" className="text-sm font-medium text-gray-700">
                    Modifier le mot de passe
                  </label>
                </div>

                {editForm.changePassword && (
                  <div className="space-y-4 pl-7">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nouveau mot de passe <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={editForm.motDePasse}
                          onChange={(e) => setEditForm({ ...editForm, motDePasse: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 pl-10 pr-12 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                          placeholder="Minimum 8 caractères"
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirmer le mot de passe <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={editForm.confirmPassword}
                          onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                          placeholder="Confirmer le mot de passe"
                          minLength={8}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowEdit(false)
                    setEditingUser(null)
                    setError(null)
                  }}
                  className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold px-6 py-3 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      Enregistrer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
