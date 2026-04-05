'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  ShoppingBag,
  Users,
  Truck,
  FileText,
  Menu,
  X,
  Bell,
  Settings,
  LogOut,
  Search,
  Calculator,
  DollarSign,
  Wallet,
  TrendingUp,
  Activity,
  UserPlus,
  AlertTriangle,
  ShoppingBag as ShoppingBagIcon,
  Building2,
  History,
  ChevronDown,
  ChevronRight,
  Loader2,
  CreditCard,
  FileBarChart,
  Archive,
} from 'lucide-react'
import type { Session } from '@/lib/auth'
import { ToastContainer } from '@/components/ui/Toast'
import { useToast } from '@/hooks/useToast'

// Diagnostic DB banner
type DbInfo = { nodeEnv?: string; databaseUrl?: string }

const navigation = [
  {
    section: '🛒 COMMERCE',
    items: [
      { name: 'Ventes', href: '/dashboard/ventes', icon: ShoppingCart, permission: 'ventes:view', key: 'ventes' },
      { name: 'Toutes les Ventes', href: '/dashboard/ventes/toute', icon: History, permission: 'ventes:view' },
      { name: 'Vente Rapide (PRO)', href: '/dashboard/ventes/rapide', icon: CreditCard, permission: 'ventes:view', key: 'ventesRapides' },
      { name: 'Achats', href: '/dashboard/achats', icon: ShoppingBag, permission: 'achats:view', key: 'achats' },
      { name: 'Tous les Achats', href: '/dashboard/achats/toute', icon: History, permission: 'achats:view' },
    ]
  },
  {
    section: '📦 LOGISTIQUE',
    items: [
      { name: 'Produits', href: '/dashboard/produits', icon: Package, permission: 'produits:view', key: 'produits' },
      { name: 'Bons de Commande', href: '/dashboard/commandes-fournisseurs', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN'], permission: 'achats:view', key: 'commandes' },
      { name: 'Stocks', href: '/dashboard/stock', icon: Warehouse, permission: 'stocks:view', key: 'stocks' },
      { name: 'Mouvements de Stock', href: '/dashboard/rapports-inventaire/mouvements', icon: Activity, permission: 'rapports:view', key: 'mouvements' },
      { name: 'Valeur de Stock', href: '/dashboard/rapports-inventaire/valeur', icon: DollarSign, permission: 'rapports:view', key: 'valeurStock' },
    ]
  },
  {
    section: '👥 TIERS',
    items: [
      { name: 'Clients', href: '/dashboard/clients', icon: Users, permission: 'clients:view', key: 'clients' },
      { name: 'Relevés de comptes', href: '/dashboard/clients/releves', icon: FileText, permission: 'clients:view', key: 'relevesClients' },
      { name: 'Soldes Clients', href: '/dashboard/clients/soldes', icon: FileText, permission: 'clients:view', key: 'soldesClients' },
      { name: 'Paiements Clients', href: '/dashboard/clients/paiements', icon: Wallet, permission: 'clients:view', key: 'paiementsClients' },
      { name: 'Fournisseurs', href: '/dashboard/fournisseurs', icon: Truck, permission: 'fournisseurs:view', key: 'fournisseurs' },
      { name: 'Soldes Fournisseurs', href: '/dashboard/fournisseurs/soldes', icon: FileText, permission: 'fournisseurs:view', key: 'soldesFournisseurs' },
      { name: 'Paiements Fournisseurs', href: '/dashboard/fournisseurs/paiements', icon: Wallet, permission: 'fournisseurs:view', key: 'paiementsFournisseurs' },
    ]
  },
  {
    section: '💰 FINANCES',
    items: [
      { name: 'Caisse', href: '/dashboard/caisse', icon: Wallet, permission: 'caisse:view', key: 'caisse' },
      { name: 'Banque', href: '/dashboard/banque', icon: CreditCard, permission: 'banque:view', key: 'banque' },
      { name: 'Dépenses', href: '/dashboard/depenses', icon: DollarSign, permission: 'depenses:view', key: 'depenses' },
      { name: 'Charges', href: '/dashboard/charges', icon: TrendingUp, permission: 'charges:view', key: 'charges' },
      { name: 'Écritures Comptables', href: '/dashboard/comptabilite/ecritures', icon: Calculator, permission: 'comptabilite:view', key: 'ecritures' },
      { name: 'Bilan (Actif/Passif)', href: '/dashboard/comptabilite/bilan', icon: FileBarChart, permission: 'comptabilite:view', key: 'bilan' },
    ]
  },
  {
    section: '📊 ANALYTIQUE & RAPPORTS',
    items: [
      { name: 'Rapports Généraux', href: '/dashboard/rapports', icon: FileText, permission: 'rapports:view', key: 'rapports' },
      { name: 'État des Paiements', href: '/dashboard/rapports-finances', icon: DollarSign, permission: 'rapports:view', key: 'etatPaiements' },
      { name: 'Rentabilité Produits', href: '/dashboard/rapports/rentabilite', icon: TrendingUp, permission: 'rapports:view', key: 'rentabilite' },
    ]
  },
  {
    section: '📂 ARCHIVES',
    items: [
      { name: 'Anciennes Ventes', href: '/dashboard/archives/ventes', icon: History, roles: ['SUPER_ADMIN', 'ADMIN'], permission: 'archives:view' },
      { name: 'Soldes Clients', href: '/dashboard/archives/clients', icon: Wallet, roles: ['SUPER_ADMIN', 'ADMIN'], permission: 'archives:view' },
    ]
  },
  {
    section: '⚙️ SYSTÈME',
    items: [
      { name: 'Utilisateurs', href: '/dashboard/utilisateurs', icon: UserPlus, permission: 'users:view' },
      { name: 'Journal d\'audit', href: '/dashboard/audit', icon: Activity, permission: 'audit:view' },
      { name: 'Paramètres', href: '/dashboard/parametres', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN'], permission: 'parametres:view' },
    ]
  }
]

function initials(nom: string): string {
  const parts = nom.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (nom.slice(0, 2) || '??').toUpperCase()
}

type Notification = {
  id: string
  type: 'STOCK_FAIBLE' | 'VENTE_RECENTE' | 'ALERTE'
  titre: string
  message: string
  date: string
  lien?: string
  lu: boolean
}

type UserWithPermissions = Session & { permissions?: string[] }

export default function DashboardLayoutClient({
  children,
  user,
}: {
  children: React.ReactNode
  user: UserWithPermissions
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [nonLues, setNonLues] = useState(0)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const [entites, setEntites] = useState<Array<{ id: number; code: string; nom: string; type: string }>>([])
  const [entiteActuelle, setEntiteActuelle] = useState<{ id: number; code: string; nom: string } | null>(null)
  const [entiteSelectOpen, setEntiteSelectOpen] = useState(false)
  const [switchingEntite, setSwitchingEntite] = useState(false)
  const entiteSelectRef = useRef<HTMLDivElement>(null)
  const { toasts, removeToast, success: showSuccess, error: showError } = useToast()
  const pathname = usePathname()
  const router = useRouter()
  const [isServerConnected, setIsServerConnected] = useState(true)
  const [syncQueueLength, setSyncQueueLength] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [toutesLues, setToutesLues] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>(['🛒 COMMERCE']) // Commerce ouvert par défaut
  const [dailyPerformance, setDailyPerformance] = useState({ ca: 0, count: 0 })
  const [sidebarCounters, setSidebarCounters] = useState<Record<string, any>>({})

  // Fetch sidebar counters for reassurance in UI
  const fetchSidebarCounters = async () => {
    try {
      const res = await fetch('/api/maintenance/sidebar-counters')
      if (res.ok) {
        const data = await res.json()
        setSidebarCounters(data || {})
      }
    } catch (e) {
      console.error('Erreur fetch sidebar counters:', e)
    }
  }

  // MODIF POINT 8 : États pour la recherche globale
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([])
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false)
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const fetchDailyPerformance = async () => {
    try {
      const res = await fetch('/api/dashboard/bilan-journalier')
      if (res.ok) {
        const data = await res.json()
        setDailyPerformance({ 
          ca: data.ca || 0, 
          count: data.count || 0
        })
      }
    } catch (e) {
      console.error('Erreur fetch performance:', e)
    }
  }

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionName) 
        ? prev.filter(s => s !== sectionName) 
        : [...prev, sectionName]
    )
  }

  useEffect(() => {
    loadNotifications()
    loadEntites()
    fetchDailyPerformance()
    fetchSidebarCounters()
    // Rafraîchir toutes les 5 minutes unqiuement si l'onglet est actif
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadNotifications()
        fetchDailyPerformance()
        fetchSidebarCounters()
      }
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Surveiller le statut du serveur local (Heartbeat)
  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch('/api/auth/check', { method: 'GET' });
        setIsServerConnected(res.ok);
      } catch (e) {
        setIsServerConnected(false);
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 10000); // Toutes les 10 secondes

    return () => clearInterval(interval);
  }, [])

  // Vérifier la file d'attente au chargement
  useEffect(() => {
    checkSyncQueue();
  }, []);

  // Vérifier la file d'attente toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      checkSyncQueue();
      if (isServerConnected) {
        syncPendingOperations();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isServerConnected]);

  function checkSyncQueue() {
    if (typeof window === 'undefined') return
    try {
      const queue = JSON.parse(localStorage.getItem('gesticom_sync_queue') || '[]')
      setSyncQueueLength(queue.length)
    } catch (e) {
      setSyncQueueLength(0)
    }
  }

  async function syncPendingOperations() {
    if (typeof window === 'undefined' || !isServerConnected || syncing) return

    try {
      const queueStr = localStorage.getItem('gesticom_sync_queue')
      if (!queueStr || queueStr === '[]') return

      setSyncing(true)
      const { syncAll } = await import('@/lib/offline-sync')

      const { success, failed, errors } = await syncAll()

      if (success > 0) {
        showSuccess(`${success} élément(s) synchronisé(s) avec succès.`)
        checkSyncQueue()
      }

      if (failed > 0) {
        showError(`${failed} élément(s) en échec de synchronisation. Vérifiez votre connexion.`)
        if (errors.length > 0) {
          console.error('Détail erreurs sync:', errors)
        }
      }

      // Mettre à jour le compteur quoi qu'il arrive
      checkSyncQueue()

    } catch (e) {
      console.error('Erreur synchronisation:', e)
    } finally {
      setSyncing(false)
    }
  }

  // Charger l'entité actuelle depuis la session
  useEffect(() => {
    if (user.entiteId) {
      fetch(`/api/entites`)
        .then((r) => (r.ok ? r.json() : []))
        .then((entitesList) => {
          const entite = entitesList.find((e: { id: number }) => e.id === user.entiteId)
          if (entite) {
            setEntiteActuelle({ id: entite.id, code: entite.code, nom: entite.nom })
          }
        })
    }
  }, [user.entiteId])
  // Protection des routes clientes (Route Guard global)
  useEffect(() => {
    if (!pathname || pathname === '/dashboard') return

    const flatNavigation = navigation.flatMap(s => s.items)
    const targetRoute = flatNavigation.find(item =>
      item.href !== '/dashboard' && pathname.startsWith(item.href)
    )

    if (targetRoute) {
      const isSuperAdmin = user.role === 'SUPER_ADMIN'
      const authorized = isSuperAdmin || !(targetRoute as any).permission || (user.permissions && user.permissions.includes((targetRoute as any).permission))
      const roleAuthorized = isSuperAdmin || !(targetRoute as any).roles || (targetRoute as any).roles.includes(user.role)

      if (!authorized || !roleAuthorized) {
        showError("Vous n'avez pas l'autorisation d'accéder à cette page.")
        router.push('/dashboard?error=permission_denied')
      }
    }
  }, [pathname, user.permissions, user.role, router, showError])

  async function loadEntites() {
    try {
      const res = await fetch('/api/entites')
      if (res.ok) {
        const data = await res.json()
        setEntites(data || [])
      }
    } catch (e) {
      console.error('Erreur chargement entités:', e)
    }
  }

  async function switchEntite(entiteId: number) {
    setSwitchingEntite(true)
    try {
      const res = await fetch('/api/auth/switch-entite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entiteId }),
      })
      if (res.ok) {
        const data = await res.json()
        setEntiteActuelle(data.entite)
        setEntiteSelectOpen(false)
        // Recharger la page pour mettre à jour toutes les données
        router.refresh()
        window.location.reload()
      } else {
        const error = await res.json()
        alert(error.error || 'Erreur lors du changement d\'entité')
      }
    } catch (e) {
      console.error('Erreur changement entité:', e)
      alert('Erreur lors du changement d\'entité')
    } finally {
      setSwitchingEntite(false)
    }
  }

  // Fermer les dropdowns si on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
      if (entiteSelectRef.current && !entiteSelectRef.current.contains(event.target as Node)) {
        setEntiteSelectOpen(false)
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchDropdownOpen(false)
      }
    }
    if (notificationsOpen || entiteSelectOpen || searchDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [notificationsOpen, entiteSelectOpen, searchDropdownOpen])

  // MODIF POINT 8 : Logique de recherche
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (globalSearchQuery.length >= 2) {
        performGlobalSearch(globalSearchQuery)
      } else {
        setGlobalSearchResults([])
        setSearchDropdownOpen(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [globalSearchQuery])

  async function performGlobalSearch(q: string) {
    setIsSearchingGlobal(true)
    setSearchDropdownOpen(true)
    try {
      const res = await fetch(`/api/search/global?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setGlobalSearchResults(data.results || [])
      }
    } catch (e) {
      console.error('Erreur recherche globale:', e)
    } finally {
      setIsSearchingGlobal(false)
    }
  }

  async function loadNotifications() {
    setLoadingNotifications(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setNonLues(data.nonLues || 0)
        setToutesLues(false) // Réinitialiser à chaque rechargement
      }
    } catch (e) {
      console.error('Erreur chargement notifications:', e)
    } finally {
      setLoadingNotifications(false)
    }
  }

  async function marquerToutesLues() {
    try {
      await fetch('/api/notifications/marquer-lues', { method: 'PATCH' })
    } catch (e) {
      // Silencieux
    } finally {
      setToutesLues(true)
      setNonLues(0)
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  function getNotificationIcon(type: Notification['type']) {
    switch (type) {
      case 'STOCK_FAIBLE':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'VENTE_RECENTE':
        return <ShoppingBagIcon className="h-4 w-4 text-green-600" />
      default:
        return <Bell className="h-4 w-4 text-blue-600" />
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700">
      {/* Animations de fond */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-400/30 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-400/30 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/30 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob animation-delay-4000"></div>
      </div>

      {/* Grille animée */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite',
        }}></div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-[100] h-full w-72 transform bg-[#006B44] border-r border-emerald-700/30 shadow-[25px_0_60px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-in-out lg:translate-x-0 pointer-events-auto no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center justify-between border-b border-emerald-100 bg-[#FCF6E8] px-5 shadow-sm relative z-50">
            <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
              <Image src="/icon-512x512.png" alt="GestiCom Pro" width={48} height={48} className="h-12 w-12 object-contain drop-shadow-md brightness-105 rounded-lg" priority />
              <span className="font-black text-emerald-900 text-lg tracking-tighter">GestiCom <span className="text-orange-600">Pro</span></span>
            </Link>
            <button className="lg:hidden p-2 rounded-lg hover:bg-emerald-100/50 transition-colors" onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6 text-emerald-950" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-4 custom-scrollbar">
              <nav className="space-y-1">
                {/* Dashboard / Accueil Button */}
                <Link
                  href="/dashboard"
                  title="Dashboard - Vue d'ensemble"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-4 px-5 py-4 mx-2 mb-8 rounded-2xl transition-all duration-300 group ${
                    pathname === '/dashboard'
                      ? 'bg-gradient-to-br from-orange-500 to-orange-700 border-2 border-white/30 shadow-[0_10px_40px_rgba(249,115,22,0.4)] scale-[1.02]'
                      : 'bg-white/5 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl transition-all ${pathname === '/dashboard' ? 'bg-white/20' : 'bg-orange-500/10 group-hover:bg-orange-500/20'}`}>
                    <Image src="/logo.png" alt="Dashboard" width={28} height={28} className="h-7 w-7 object-contain" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[17px] font-black uppercase tracking-tighter text-white leading-none brightness-125 drop-shadow-sm">
                      DASHBOARD
                    </span>
                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-tighter mt-1">
                      Vue d'ensemble
                    </span>
                  </div>
                </Link>

                {navigation.map((section) => {
                  const visibleItems = section.items.filter((item) => {
                    const navItem = item as any
                    const isSuperAdmin = user?.role === 'SUPER_ADMIN'
                    const hasRole = isSuperAdmin || !navItem.roles || navItem.roles.includes(user?.role)
                    const hasPermission = isSuperAdmin || !navItem.permission || (user?.permissions && user.permissions.includes(navItem.permission))
                    
                    if (!hasRole || !hasPermission) {
                      // Log de diagnostic pour le client PACO
                      console.log(`[Diagnostic Menu] Élement "${navItem.name}" masqué. Raison : ${!hasRole ? 'Rôle ' + user?.role + ' non autorisé' : 'Permission ' + navItem.permission + ' manquante'}`)
                    }
                    
                    return hasRole && hasPermission
                  })

                  if (visibleItems.length === 0) return null
                  const isExpanded = expandedSections.includes(section.section)

                  return (
                    <div key={section.section} className="mb-2">
                      <button
                        onClick={() => toggleSection(section.section)}
                        title={`Ouvrir ${section.section}`}
                        className={`flex w-full items-center justify-between px-4 py-3.5 mx-2 mb-1 rounded-xl transition-all duration-300 border ${
                          isExpanded 
                            ? 'bg-white/10 border-white/20 shadow-lg' 
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-[13.5px] font-black uppercase tracking-[0.18em] text-white brightness-150 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                          {section.section}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-orange-500 brightness-110" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-orange-500 brightness-110" />
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="mx-2 mb-5 space-y-1 bg-black/20 rounded-2xl p-2 border border-orange-500/40 shadow-[0_10px_30px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in-95 duration-200">
                          {visibleItems.map((item) => {
                            const navItem = item as any
                            const isActive = pathname === navItem.href
                            const Icon = navItem.icon
                            return (
                              <Link
                                key={navItem.name}
                                href={navItem.href}
                                title={navItem.name}
                                className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300 ${
                                  isActive
                                    ? 'bg-orange-600 text-white shadow-[0_4px_20px_rgba(249,115,22,0.4)] scale-[1.02]'
                                    : 'text-white hover:bg-white/10 hover:pl-5'
                                }`}
                                onClick={() => setSidebarOpen(false)}
                              >
                                <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
                                <span className="truncate group-hover:whitespace-normal uppercase tracking-tight">{navItem.name}</span>
                                
                                {navItem.key && sidebarCounters[navItem.key] !== undefined && (
                                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-black ${isActive ? 'bg-white text-orange-600' : 'bg-orange-500/20 text-orange-400 group-hover:bg-orange-500 group-hover:text-white'}`}>
                                    {sidebarCounters[navItem.key]}
                                  </span>
                                )}

                                {isActive && !navItem.key && (
                                  <div className="ml-auto h-2 w-2 rounded-full bg-white shadow-[0_0_12px_white] animate-pulse" />
                                )}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Performance & Status Pod */}
                <div className="mt-14 mx-2 mb-10 p-5 rounded-2xl bg-white/5 border-2 border-orange-500 shadow-2xl relative overflow-hidden group hover:bg-white/10 transition-all duration-500">
                  <div className="absolute top-0 right-0 p-2 opacity-30">
                    <TrendingUp className="h-12 w-12 text-orange-500" />
                  </div>
                  
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-3">
                    Bilan du Jour
                  </h4>
                  
                  <div className="space-y-1 mb-4">
                    <div className="text-xl font-black text-white brightness-125 tabular-nums">
                      {dailyPerformance.ca.toLocaleString('fr-FR')} <span className="text-[10px] font-bold text-emerald-300">FCFA</span>
                    </div>
                    <div className="text-[11px] font-bold text-orange-500 flex items-center gap-1.5">
                      <ShoppingCart className="h-3 w-3" />
                      <span>{dailyPerformance.count} Ventes enregistrées</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                        <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-orange-500 animate-ping opacity-75" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Serveur Local OK</span>
                    </div>
                    <div className="text-[9px] font-black text-white/20 uppercase tracking-widest">
                      v4.2 PRO
                    </div>
                  </div>
                </div>
              </nav>
            </div>

          <div className="border-t border-emerald-100 bg-[#FCF6E8] p-5 shadow-[0_-4px_15px_rgba(0,0,0,0.02)] relative z-50">
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-3.5 shadow-xl ring-2 ring-white/20">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-base font-black text-orange-600 shadow-inner ring-2 ring-emerald-500/10">
                {initials(user.nom)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-black text-white truncate uppercase tracking-tight drop-shadow-sm">{user.nom}</p>
                <p className="text-[10px] text-emerald-50/90 truncate font-black uppercase tracking-[0.15em]">{user.role === 'ADMIN' ? 'Administrateur admin' : user.login}</p>
              </div>
            </div>
            <form action="/api/auth/logout" method="POST" className="mt-4">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-3 text-[11px] font-black text-white transition-all duration-300 shadow-lg hover:shadow-orange-500/30 uppercase tracking-[0.2em]"
              >
                <LogOut className="h-4 w-4 text-[#006B44]" />
                DÉCONNEXION
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="relative z-10 lg:pl-72 print:pl-0">
        <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-xl shadow-sm no-print">
          <div className="flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-6 w-6 text-gray-600" />
              </button>
              <Link href="/dashboard" className="hidden sm:flex items-center gap-2">
                <Image src="/icon-512x512.png" alt="GestiCom Pro" width={40} height={40} className="h-10 w-10 object-contain drop-shadow-sm rounded-md" />
                <span className="font-bold text-gray-900 text-sm tracking-tight">GestiCom <span className="text-orange-500">Pro</span></span>
              </Link>
              <div className="relative hidden sm:block" ref={searchContainerRef}>
                <div className="relative flex items-center">
                  <Search className={`absolute left-3 h-5 w-5 transition-colors ${isSearchingGlobal ? 'text-orange-500 animate-pulse' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    onFocus={() => globalSearchQuery.length >= 2 && setSearchDropdownOpen(true)}
                    placeholder="Rechercher partout (Produit, Facture, Client...)"
                    className="w-80 rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm font-medium focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-500/5 transition-all shadow-inner"
                  />
                  {isSearchingGlobal && (
                    <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-orange-400" />
                  )}
                </div>

                {/* Dropdown de résultats (Point 8) */}
                {searchDropdownOpen && (globalSearchResults.length > 0 || isSearchingGlobal) && (
                  <div className="absolute left-0 top-full mt-2 w-[28rem] rounded-2xl border border-gray-100 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[32rem] overflow-y-auto p-2">
                      {isSearchingGlobal && globalSearchResults.length === 0 ? (
                        <div className="p-8 text-center">
                          <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-2" />
                          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Recherche en cours...</p>
                        </div>
                      ) : globalSearchResults.length > 0 ? (
                        <div className="space-y-1">
                          {globalSearchResults.map((res: any, idx: number) => (
                            <Link
                              key={idx}
                              href={res.link}
                              onClick={() => {
                                setSearchDropdownOpen(false)
                                setGlobalSearchQuery('')
                              }}
                              className="flex items-center gap-4 p-3 rounded-xl hover:bg-orange-50 group transition-all"
                            >
                              <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-xs font-black shadow-sm group-hover:scale-110 transition-transform ${
                                res.type === 'PRODUIT' ? 'bg-blue-100 text-blue-600' :
                                res.type === 'VENTE' ? 'bg-emerald-100 text-emerald-600' :
                                res.type === 'CLIENT' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'
                              }`}>
                                {res.type[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-black text-gray-800 truncate uppercase tracking-tight">{res.title}</p>
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400 group-hover:bg-orange-200 group-hover:text-orange-700 transition-colors">
                                    {res.type}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 font-bold truncate">{res.subtitle || 'Aucun détail'}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <AlertTriangle className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                          <p className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">Aucun résultat pour "{globalSearchQuery}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* MESSAGE DÉFILANT (Point 2) */}
            <div className="hidden xl:flex flex-1 mx-8 overflow-hidden bg-gray-50 border border-gray-100 rounded-lg py-1 shadow-inner relative group">
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-50 to-transparent z-10" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 to-transparent z-10" />
              <div className="animate-marquee inline-block text-sm font-black text-emerald-800 uppercase tracking-widest py-1 px-4">
                <span className="text-orange-500">◆</span> GestiCom Pro votre Gestionnaire de Commerce Professionnel <span className="text-orange-500">◆</span>
                <span className="mx-12"></span>
                <span className="text-orange-500">◆</span> GestiCom Pro votre Gestionnaire de Commerce Professionnel <span className="text-orange-500">◆</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Indicateur de statut du serveur local */}
              {!isServerConnected && (
                <div className="flex items-center gap-2 rounded-lg bg-red-100 px-3 py-1.5 text-sm text-red-800">
                  <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse"></div>
                  <span>Serveur Déconnecté</span>
                </div>
              )}
              {isServerConnected && syncQueueLength > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1.5 text-sm text-blue-800">
                  {syncing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Synchronisation...</span>
                    </>
                  ) : (
                    <>
                      <span>{syncQueueLength} en attente</span>
                      <button
                        onClick={syncPendingOperations}
                        className="ml-1 rounded px-2 py-0.5 text-xs hover:bg-blue-200"
                      >
                        Sync
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Sélecteur d'entité (visible si SUPER_ADMIN ou plusieurs entités) */}
              {(user.role === 'SUPER_ADMIN' || entites.length > 1) && (
                <div className="relative" ref={entiteSelectRef}>
                  <button
                    onClick={() => {
                      setEntiteSelectOpen(!entiteSelectOpen)
                      if (!entiteSelectOpen) {
                        loadEntites()
                      }
                    }}
                    disabled={switchingEntite}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    title="Changer d'entité"
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {entiteActuelle ? `${entiteActuelle.code} - ${entiteActuelle.nom}` : 'Entité...'}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {/* Dropdown Entités */}
                  {entiteSelectOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-2xl z-50 max-h-96 overflow-hidden">
                      <div className="border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100 px-4 py-3">
                        <h3 className="font-semibold text-gray-900">Sélectionner une entité</h3>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {entites.length === 0 ? (
                          <div className="px-4 py-8 text-center text-gray-500">
                            <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">Aucune entité disponible</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {entites.map((entite) => {
                              const isActive = entiteActuelle?.id === entite.id
                              return (
                                <button
                                  key={entite.id}
                                  onClick={() => {
                                    if (!isActive) {
                                      switchEntite(entite.id)
                                    } else {
                                      setEntiteSelectOpen(false)
                                    }
                                  }}
                                  disabled={switchingEntite || isActive}
                                  className={`w-full px-4 py-3 text-left transition-colors ${isActive
                                    ? 'bg-orange-50 text-orange-900 font-medium'
                                    : 'hover:bg-gray-50 text-gray-900'
                                    } disabled:opacity-50`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium">{entite.nom}</p>
                                      <p className="text-xs text-gray-500">{entite.code} · {entite.type}</p>
                                    </div>
                                    {isActive && (
                                      <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen)
                    if (!notificationsOpen) {
                      loadNotifications()
                    }
                  }}
                  className="relative rounded-lg p-2 hover:bg-gray-100 transition-colors"
                  title="Notifications"
                >
                  <Bell className="h-5 w-5 text-gray-600" />
                  {nonLues > 0 && !toutesLues && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                      {nonLues > 9 ? '9+' : nonLues}
                    </span>
                  )}
                </button>

                {/* Dropdown Notifications */}
                {notificationsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-2xl z-50 max-h-96 overflow-hidden">
                    <div className="border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        <div className="flex items-center gap-2">
                          {nonLues > 0 && !toutesLues && (
                            <span className="rounded-full bg-orange-600 px-2 py-0.5 text-xs font-bold text-white">
                              {nonLues} nouvelle{nonLues > 1 ? 's' : ''}
                            </span>
                          )}
                          {notifications.length > 0 && !toutesLues && (
                            <button
                              onClick={marquerToutesLues}
                              className="text-xs text-orange-600 hover:text-orange-800 font-medium underline"
                              title="Marquer toutes comme lues"
                            >
                              Tout lire
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {loadingNotifications ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500">
                          <Bell className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm">Aucune notification</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {notifications.map((notif) => (
                            <button
                              key={notif.id}
                              onClick={() => {
                                if (notif.lien) {
                                  router.push(notif.lien)
                                  setNotificationsOpen(false)
                                }
                              }}
                              className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${!notif.lu ? 'bg-orange-50/50' : ''
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex-shrink-0">
                                  {getNotificationIcon(notif.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">{notif.titre}</p>
                                  <p className="mt-1 text-xs text-gray-600 line-clamp-2">{notif.message}</p>
                                  <p className="mt-1 text-xs text-gray-400">{formatDate(notif.date)}</p>
                                </div>
                                {!notif.lu && (
                                  <div className="mt-1 flex-shrink-0">
                                    <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
                        <button
                          onClick={() => {
                            router.push('/dashboard')
                            setNotificationsOpen(false)
                          }}
                          className="text-xs font-medium text-orange-600 hover:text-orange-700"
                        >
                          Voir toutes les notifications
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Paramètres */}
              <button
                onClick={() => {
                  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
                    router.push('/dashboard/parametres')
                  }
                }}
                className="rounded-lg p-2 hover:bg-gray-100 transition-colors"
                title="Paramètres"
                disabled={user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN'}
              >
                <Settings className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:px-8 relative z-10 w-full overflow-y-auto">
          {children}
        </main>

        {/* Footer GestiCom App - Affiché uniquement sur Dashboard et Paramètres */}
        {pathname === '/dashboard' && (
          <footer className="h-10 border-t border-gray-200 bg-white flex items-center justify-center relative z-10 w-full shrink-0 no-print">
            <p className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
              <span className="text-orange-500">GestiCom — tous droits réservés</span>
              <span className="text-gray-300 mx-1">—</span>
              <span className="text-emerald-600">Pacousstar 05 44 81 49 24</span>
            </p>
          </footer>
        )}
      </div>
      <style jsx global>{`
        @media print {
          .no-print, nav, aside, header, footer, button, .lucide {
            display: none !important;
          }
          body, .min-h-screen {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .lg\\:pl-72 {
            padding-left: 0 !important;
          }
        }
      `}</style>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
