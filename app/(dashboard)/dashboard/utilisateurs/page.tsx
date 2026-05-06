'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Users, Edit, Ban, Shield, Loader2, CheckCircle2, XCircle, Eye, EyeOff, Lock, X, Save, Printer, Search, Filter, UserCheck, ChevronDown, ChevronUp, Download } from 'lucide-react'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { paginateForPrint } from '@/lib/print-helpers'
import { ROLE_PERMISSIONS, ROLE_DESCRIPTIONS, type Role, type Permission } from '@/lib/roles-permissions'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'

type Utilisateur = {
  id: number
  login: string
  nom: string
  email: string | null
  role: string
  permissionsPersonnalisees: string | null
  rolesSupplementaires: string | null
  actif: boolean
  entite: {
    id: number
    nom: string
  }
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

const getAllPermissions = (): Permission[] => {
  const allPerms = new Set<Permission>()
  Object.values(ROLE_PERMISSIONS).forEach(perms => {
    perms.forEach(p => allPerms.add(p))
  })
  return Array.from(allPerms).sort()
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
  ADMIN: 'bg-blue-100 text-blue-800 border-blue-300',
  COMPTABLE: 'bg-green-100 text-green-800 border-green-300',
  GESTIONNAIRE: 'bg-orange-100 text-orange-800 border-orange-300',
  MAGASINIER: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  ASSISTANTE: 'bg-pink-100 text-pink-800 border-pink-300',
}

const ROLE_AVATAR_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'from-purple-500 to-purple-600',
  ADMIN: 'from-blue-500 to-blue-600',
  COMPTABLE: 'from-green-500 to-green-600',
  GESTIONNAIRE: 'from-orange-500 to-orange-600',
  MAGASINIER: 'from-yellow-500 to-yellow-600',
  ASSISTANTE: 'from-pink-500 to-pink-600',
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrateur',
  COMPTABLE: 'Comptable',
  GESTIONNAIRE: 'Gestionnaire',
  MAGASINIER: 'Magasinier',
  ASSISTANTE: 'Assistante',
}

type SortField = 'nom' | 'login' | 'role' | 'entite' | 'createdAt' | 'actif'
type SortDir = 'asc' | 'desc'

export default function UtilisateursPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [showSuccess, setShowSuccess] = useState(false)
  const { success: showSuccessToast, error: showErrorToast } = useToast()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<string>('')
  const [filterEntite, setFilterEntite] = useState<string>('')
  const [filterActif, setFilterActif] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showFilters, setShowFilters] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editingUser, setEditingUser] = useState<Utilisateur | null>(null)
  const [editTab, setEditTab] = useState<'general' | 'permissions' | 'security'>('general')
  const [editForm, setEditForm] = useState({
    nom: '',
    email: '',
    role: 'ASSISTANTE' as Role,
    permissionsPersonnalisees: [] as Permission[],
    useCustomPermissions: false,
    rolesSupplementaires: [] as Role[],
    entiteId: 0,
    actif: true,
    motDePasse: '',
    confirmPassword: '',
    changePassword: false,
  })
  const [entites, setEntites] = useState<{ id: number; nom: string }[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reactivating, setReactivating] = useState<number | null>(null)
  const [deactivating, setDeactivating] = useState<number | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [currentSession, setCurrentSession] = useState<{ role: string; userId: number } | null>(null)
  const [exporting, setExporting] = useState(false)

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/utilisateurs/export')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `utilisateurs_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
      } else {
        const data = await res.json()
        showErrorToast(data.error || 'Erreur lors de l\'export.')
      }
    } catch (err) {
      showErrorToast('Erreur lors de l\'export.')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    if (success === 'created') {
      setSuccessMessage('Utilisateur créé avec succès !')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      router.replace('/dashboard/utilisateurs')
    } else if (success === 'reactivated') {
      setSuccessMessage('Utilisateur réactivé avec succès.')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
      router.replace('/dashboard/utilisateurs')
    }
    loadUtilisateurs()
    loadEntites()
    loadSession()
  }, [success, router])

  async function loadSession() {
    try {
      const res = await fetch('/api/auth/check')
      if (res.ok) {
        const data = await res.json()
        setCurrentSession({ role: data.role, userId: data.userId })
      }
    } catch {}
  }

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

  const getRoleColor = (role: string) => ROLE_COLORS[role] || 'bg-gray-100 text-gray-800 border-gray-300'
  const getRoleLabel = (role: string) => ROLE_LABELS[role] || role
  const getAvatarColor = (role: string) => ROLE_AVATAR_COLORS[role] || 'from-gray-500 to-gray-600'

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />
  }

  const filteredUtilisateurs = utilisateurs
    .filter(u => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!u.nom.toLowerCase().includes(q) && !u.login.toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) return false
      }
      if (filterRole && u.role !== filterRole) return false
      if (filterEntite && String(u.entite.id) !== filterEntite) return false
      if (filterActif === 'actif' && !u.actif) return false
      if (filterActif === 'inactif' && u.actif) return false
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'nom': cmp = a.nom.localeCompare(b.nom); break
        case 'login': cmp = a.login.localeCompare(b.login); break
        case 'role': cmp = a.role.localeCompare(b.role); break
        case 'entite': cmp = a.entite.nom.localeCompare(b.entite.nom); break
        case 'actif': cmp = Number(b.actif) - Number(a.actif); break
        case 'createdAt': default: cmp = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

  const handleEdit = (user: Utilisateur) => {
    setEditingUser(user)
    let customPerms: Permission[] = []
    if (user.permissionsPersonnalisees) {
      try {
        customPerms = JSON.parse(user.permissionsPersonnalisees) as Permission[]
      } catch { customPerms = [] }
    }
    let supRoles: Role[] = []
    if (user.rolesSupplementaires) {
      try {
        supRoles = JSON.parse(user.rolesSupplementaires) as Role[]
      } catch { supRoles = [] }
    }
    setEditForm({
      nom: user.nom,
      email: user.email || '',
      role: user.role as Role,
      permissionsPersonnalisees: customPerms,
      useCustomPermissions: customPerms.length > 0,
      rolesSupplementaires: supRoles,
      entiteId: user.entite.id,
      actif: user.actif,
      motDePasse: '',
      confirmPassword: '',
      changePassword: false,
    })
    setEditTab('general')
    setShowEdit(true)
    setError(null)
  }

  const handleSave = async () => {
    if (!editingUser) return
    setError(null)

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
      let permissionsPersonnalisees: Permission[] | null = null
      if (editForm.useCustomPermissions) {
        permissionsPersonnalisees = editForm.permissionsPersonnalisees
      }

      const updateData: any = {
        nom: editForm.nom.trim(),
        email: editForm.email.trim() || undefined,
        role: editForm.role,
        entiteId: editForm.entiteId,
        actif: editForm.actif,
        permissionsPersonnalisees,
        rolesSupplementaires: editForm.rolesSupplementaires.length > 0 ? editForm.rolesSupplementaires : null,
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
      showSuccessToast('Utilisateur modifié avec succès.')
      loadUtilisateurs()
    } catch (err) {
      console.error('Erreur modification utilisateur:', err)
      const errorMsg = formatApiError(err)
      setError(errorMsg)
      showErrorToast(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (userId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir désactiver cet utilisateur ? Sa session sera immédiatement invalidée.')) return
    setDeactivating(userId)
    setError(null)
    try {
      const res = await fetch(`/api/utilisateurs/${userId}`, { method: 'DELETE', credentials: 'same-origin' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const errorMsg = formatApiError(data?.error || 'Erreur lors de la désactivation.')
        setError(errorMsg)
        showErrorToast(errorMsg)
        return
      }
      showSuccessToast('Utilisateur désactivé avec succès.')
      setUtilisateurs(prev => prev.map(u => u.id === userId ? { ...u, actif: false } : u))
    } catch (err) {
      console.error('Erreur désactivation utilisateur:', err)
      const errorMsg = formatApiError(err)
      setError(errorMsg)
      showErrorToast(errorMsg)
    } finally {
      setDeactivating(null)
    }
  }

  const handleReactivate = async (userId: number) => {
    setReactivating(userId)
    setError(null)
    try {
      const res = await fetch(`/api/utilisateurs/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errorMsg = data.error || 'Erreur lors de la réactivation.'
        setError(errorMsg)
        showErrorToast(errorMsg)
        return
      }
      showSuccessToast('Utilisateur réactivé avec succès.')
      setUtilisateurs(prev => prev.map(u => u.id === userId ? { ...u, actif: true } : u))
    } catch (err) {
      console.error('Erreur réactivation utilisateur:', err)
      const errorMsg = formatApiError(err)
      setError(errorMsg)
      showErrorToast(errorMsg)
    } finally {
      setReactivating(null)
    }
  }

  const isSuperAdmin = currentSession?.role === 'SUPER_ADMIN'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestion des utilisateurs</h1>
          <p className="text-white/90 mt-1">Créer, gérer et administrer les utilisateurs du système</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-2 border-2 border-slate-800 bg-slate-100 text-slate-900 hover:bg-slate-200 font-black px-4 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl uppercase text-xs no-print"
          >
            <Printer className="h-5 w-5" />
            Impression
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting || filteredUtilisateurs.length === 0}
            className="inline-flex items-center gap-2 border-2 border-slate-800 bg-slate-100 text-slate-900 hover:bg-slate-200 font-black px-4 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl uppercase text-xs no-print disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            CSV
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

      {showSuccess && successMessage && (
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

      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, login ou email..."
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${showFilters ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            <Filter className="h-4 w-4" />
            Filtres
          </button>
          <div className="text-sm text-gray-500 flex items-center">
            {filteredUtilisateurs.length} utilisateur{filteredUtilisateurs.length > 1 ? 's' : ''} sur {utilisateurs.length}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-200">
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
            >
              <option value="">Tous les rôles</option>
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filterEntite}
              onChange={e => setFilterEntite(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
            >
              <option value="">Toutes les entités</option>
              {entites.map(e => (
                <option key={e.id} value={String(e.id)}>{e.nom}</option>
              ))}
            </select>
            <select
              value={filterActif}
              onChange={e => setFilterActif(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
            >
              <option value="">Tous les statuts</option>
              <option value="actif">Actifs</option>
              <option value="inactif">Inactifs</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : filteredUtilisateurs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 mb-4">Aucun utilisateur trouvé</p>
          {!searchQuery && !filterRole && !filterEntite && !filterActif && (
            <Link href="/register" className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium">
              <UserPlus className="h-5 w-5" />
              Créer le premier utilisateur
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nom')}>
                    Utilisateur <SortIcon field="nom" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('role')}>
                    Rôle <SortIcon field="role" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('entite')}>
                    Entité <SortIcon field="entite" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('actif')}>
                    Statut <SortIcon field="actif" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('createdAt')}>
                    Créé le <SortIcon field="createdAt" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUtilisateurs.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${!user.actif ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(user.role)} flex items-center justify-center text-white font-semibold text-sm`}>
                          {user.nom.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.nom}</div>
                          <div className="text-xs text-gray-500 font-mono">{user.login}</div>
                          {user.lastLoginAt && (
                            <div className="text-[10px] text-gray-400">Dernière connexion : {formatDateTime(user.lastLoginAt)}</div>
                          )}
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
                      {user.email || '—'}
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
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {user.actif ? (
                          <button
                            onClick={() => handleDeactivate(user.id)}
                            disabled={deactivating === user.id}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Désactiver"
                          >
                            {deactivating === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Ban className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(user.id)}
                            disabled={reactivating === user.id}
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Réactiver"
                          >
                            {reactivating === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showEdit && editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowEdit(false); setEditingUser(null); setError(null) } }}
        >
          <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Modifier l'utilisateur</h2>
              <button onClick={() => { setShowEdit(false); setEditingUser(null); setError(null) }} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex gap-2 mb-6 border-b border-gray-200">
              <button onClick={() => setEditTab('general')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${editTab === 'general' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                Informations
              </button>
              <button onClick={() => setEditTab('permissions')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${editTab === 'permissions' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                Rôles & Permissions
              </button>
              <button onClick={() => setEditTab('security')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${editTab === 'security' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                Sécurité
              </button>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-4">{error}</div>
            )}

            {editTab === 'general' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Login (non modifiable)</label>
                  <input type="text" value={editingUser.login} disabled className="w-full rounded-lg border border-gray-300 px-4 py-2 bg-gray-50 text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet <span className="text-red-500">*</span></label>
                  <input type="text" value={editForm.nom} onChange={e => setEditForm({ ...editForm, nom: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none" placeholder="email@example.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rôle <span className="text-red-500">*</span></label>
                    <select value={editForm.role} onChange={e => { const newRole = e.target.value as Role; setEditForm({ ...editForm, role: newRole, rolesSupplementaires: editForm.rolesSupplementaires.filter(r => r !== newRole) }) }} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none">
                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Entité <span className="text-red-500">*</span></label>
                    <select value={editForm.entiteId} onChange={e => setEditForm({ ...editForm, entiteId: parseInt(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none" required>
                      <option value="0">Sélectionner une entité</option>
                      {entites.map(entite => (
                        <option key={entite.id} value={entite.id}>{entite.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="actif" checked={editForm.actif} onChange={e => setEditForm({ ...editForm, actif: e.target.checked })} className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500" />
                  <label htmlFor="actif" className="text-sm font-medium text-gray-700">Compte actif</label>
                </div>
                {editForm.actif === false && editingUser.actif === true && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    <strong>Attention :</strong> Désactiver cet utilisateur invalidera immédiatement sa session active.
                  </div>
                )}
              </div>
            )}

            {editTab === 'permissions' && (
              <div className="space-y-5">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  <strong>Rôle principal :</strong> {getRoleLabel(editForm.role)} — {ROLE_DESCRIPTIONS[editForm.role as Role]?.description}
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Droits supplémentaires</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    En plus du rôle <strong>{getRoleLabel(editForm.role)}</strong>, attribuez les droits d&apos;un ou plusieurs autres rôles.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {Object.keys(ROLE_LABELS).filter(r => r !== editForm.role).map(role => {
                      if (role === 'SUPER_ADMIN' && !isSuperAdmin) return null
                      const isChecked = editForm.rolesSupplementaires.includes(role as Role)
                      return (
                        <label key={role} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={isChecked} onChange={e => {
                            if (e.target.checked) setEditForm(prev => ({ ...prev, rolesSupplementaires: [...prev.rolesSupplementaires, role as Role] }))
                            else setEditForm(prev => ({ ...prev, rolesSupplementaires: prev.rolesSupplementaires.filter(r => r !== role) }))
                          }} className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500" />
                          <span className="text-sm text-gray-700">{getRoleLabel(role)}</span>
                        </label>
                      )
                    })}
                  </div>
                  {editForm.rolesSupplementaires.length > 0 && (
                    <p className="text-xs text-blue-600 mt-2">
                      Droits fusionnés : {editForm.role} + {editForm.rolesSupplementaires.join(', ')}
                    </p>
                  )}
                  {!isSuperAdmin && editForm.rolesSupplementaires.includes('SUPER_ADMIN') && (
                    <p className="text-xs text-red-600 mt-2 font-semibold">Seul un Super Administrateur peut attribuer les droits Super Administrateur.</p>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <input type="checkbox" id="useCustomPermissions" checked={editForm.useCustomPermissions} onChange={e => {
                      const useCustom = e.target.checked
                      setEditForm(prev => ({
                        ...prev,
                        useCustomPermissions: useCustom,
                        permissionsPersonnalisees: useCustom ? [...(ROLE_PERMISSIONS[prev.role] || [])] : [],
                      }))
                    }} className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500" />
                    <label htmlFor="useCustomPermissions" className="text-sm font-medium text-gray-700">
                      Utiliser des permissions personnalisées (remplace le rôle et les droits supplémentaires)
                    </label>
                  </div>

                  {editForm.useCustomPermissions ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800 mb-3 font-medium">Permissions personnalisées — Cochez les permissions à attribuer</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                        {getAllPermissions().map(perm => {
                          const [module, action] = perm.split(':')
                          const isChecked = editForm.permissionsPersonnalisees.includes(perm)
                          return (
                            <div key={perm} className="flex items-center gap-2">
                              <input type="checkbox" id={`perm-${perm}`} checked={isChecked} onChange={e => {
                                if (e.target.checked) setEditForm(prev => ({ ...prev, permissionsPersonnalisees: [...prev.permissionsPersonnalisees, perm] }))
                                else setEditForm(prev => ({ ...prev, permissionsPersonnalisees: prev.permissionsPersonnalisees.filter(p => p !== perm) }))
                              }} className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500" />
                              <label htmlFor={`perm-${perm}`} className="text-sm text-gray-700 cursor-pointer">
                                <span className="font-medium">{module}</span>
                                <span className="text-gray-500">:{action}</span>
                              </label>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-blue-700 mt-3">{editForm.permissionsPersonnalisees.length} permission(s) sélectionnée(s)</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-3">
                        Les permissions sont définies par le rôle <strong>{getRoleLabel(editForm.role)}</strong>
                        {editForm.rolesSupplementaires.length > 0 && <> et les droits supplémentaires</>}
                        . Activez les permissions personnalisées pour modifier individuellement.
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                        {(() => {
                          const basePerms = ROLE_PERMISSIONS[editForm.role as Role] || []
                          const suppPerms = editForm.rolesSupplementaires.flatMap(r => ROLE_PERMISSIONS[r] || [])
                          const allPerms = [...new Set([...basePerms, ...suppPerms])]
                          return allPerms.map(perm => {
                            const [module, action] = perm.split(':')
                            const isBase = basePerms.includes(perm)
                            return (
                              <div key={perm} className="flex items-center gap-2 text-sm">
                                <div className={`w-2 h-2 rounded-full ${isBase ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                <span className="text-gray-700">
                                  <span className="font-medium">{module}</span>
                                  <span className="text-gray-500">:{action}</span>
                                </span>
                              </div>
                            )
                          })
                        })()}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Rôle principal</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Droits supplémentaires</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {editTab === 'security' && (
              <div className="space-y-5">
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  <strong>Attention :</strong> La modification du mot de passe prendra effet immédiatement. L&apos;utilisateur concerné devra se reconnecter.
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <input type="checkbox" id="changePassword" checked={editForm.changePassword} onChange={e => setEditForm({ ...editForm, changePassword: e.target.checked, motDePasse: '', confirmPassword: '' })} className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500" />
                  <label htmlFor="changePassword" className="text-sm font-medium text-gray-700">Modifier le mot de passe</label>
                </div>
                {editForm.changePassword && (
                  <div className="space-y-4 pl-7">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau mot de passe <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                        <input type={showPassword ? 'text' : 'password'} value={editForm.motDePasse} onChange={e => setEditForm({ ...editForm, motDePasse: e.target.value })} className="w-full rounded-lg border border-gray-300 pl-10 pr-12 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none" placeholder="Minimum 8 caractères" minLength={8} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer le mot de passe <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                        <input type={showPassword ? 'text' : 'password'} value={editForm.confirmPassword} onChange={e => setEditForm({ ...editForm, confirmPassword: e.target.value })} className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none" placeholder="Confirmer le mot de passe" minLength={8} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-gray-200 mt-6">
              <button onClick={() => { setShowEdit(false); setEditingUser(null); setError(null) }} className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold px-6 py-3 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="h-5 w-5 animate-spin" /> Enregistrement...</> : <><Save className="h-5 w-5" /> Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
            <div className="flex items-center gap-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Répertoire Personnel</h2>
                <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">Contrôle des Accès et Identités Système</p>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-orange-100 px-4 py-2 text-xs font-black text-orange-600 uppercase">{filteredUtilisateurs.length} Profils</span>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setIsPreviewOpen(false)} className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase">Fermer</button>
              <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-orange-600 px-10 py-2 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 uppercase"><Printer className="h-4 w-4" /> Lancer l&apos;impression</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
            <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-4 text-slate-900 not-italic tracking-normal">
              {paginateForPrint(filteredUtilisateurs).map((chunk: Utilisateur[], index: number, allChunks: Utilisateur[][]) => (
                <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0">
                  <ListPrintWrapper title="RÉPERTOIRE DU PERSONNEL" subtitle="Audit des Accès et Droits Utilisateurs" pageNumber={index + 1} totalPages={allChunks.length} hideHeader={index > 0} hideVisa={index < allChunks.length - 1}>
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
                            <td className="px-3 py-2 text-center font-black text-[10px]">{u.actif ? 'ACTIF' : 'INACTIF'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ListPrintWrapper>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}