'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Server, Database, AlertTriangle, RefreshCw, Clock,
  Activity, HardDrive, Users, ShoppingCart, ShoppingBag,
  Cpu, Globe, BarChart3, Wifi, ShieldCheck, Loader2,
} from 'lucide-react'

type MonitoringData = {
  uptime: { seconds: number; human: string; startedAt: string }
  database: { sizeBytes: number; sizeHuman: string; path: string }
  errors: { total: number; today: number; logPath: string }
  activity: { ventesToday: number; achatsToday: number }
  system: {
    users: number; entities: number
    nodeVersion: string; platform: string; arch: string
    memoryUsage: { heapUsed: number; heapTotal: number; rss: number }
    hostname: string; cpus: number; uptime: string
  }
  app: { version: string; environment: string }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring')
      if (!res.ok) throw new Error('Erreur chargement')
      const json = await res.json()
      setData(json)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-500 animate-pulse">Chargement du monitoring…</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto" />
          <p className="text-gray-600 font-medium">{error || 'Impossible de charger les données'}</p>
          <button onClick={fetchData} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors">
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
        </div>
      </div>
    )
  }

  const memUsedMb = (data.system.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)
  const memTotalMb = (data.system.memoryUsage.heapTotal / 1024 / 1024).toFixed(1)
  const rssMb = (data.system.memoryUsage.rss / 1024 / 1024).toFixed(1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 p-6 sm:p-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
        </div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Activity className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                Monitoring
              </h1>
              <p className="text-sm text-white/60 mt-0.5">
                v{data.app.version} · {data.app.environment}
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/70 bg-white/10 hover:bg-white/20 transition-all border border-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* KPIs row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={Server} label="Uptime serveur" value={data.uptime.human} sub={`Démarré ${formatDate(data.uptime.startedAt)}`} />
        <KpiCard icon={Database} label="Base de données" value={data.database.sizeHuman} sub={`${data.system.entities} entité(s)`} />
        <KpiCard icon={AlertTriangle} label="Erreurs" value={String(data.errors.total)} sub={`${data.errors.today} aujourd'hui`} warning={data.errors.today > 0} />
        <KpiCard icon={Users} label="Utilisateurs" value={String(data.system.users)} sub={`${data.activity.ventesToday} ventes ajd`} />
      </div>

      {/* Activity row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Activité aujourd'hui
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100">
              <ShoppingCart className="h-5 w-5 text-orange-500 mb-1" />
              <p className="text-2xl font-black text-gray-900 tabular-nums">{data.activity.ventesToday}</p>
              <p className="text-xs font-medium text-gray-500">Ventes</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100">
              <ShoppingBag className="h-5 w-5 text-emerald-500 mb-1" />
              <p className="text-2xl font-black text-gray-900 tabular-nums">{data.activity.achatsToday}</p>
              <p className="text-xs font-medium text-gray-500">Achats</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4" /> Système
          </h3>
          <div className="space-y-2 text-sm">
            <Row label="Node.js" value={data.system.nodeVersion} />
            <Row label="Plateforme" value={`${data.system.platform} (${data.system.arch})`} />
            <Row label="Hôte" value={data.system.hostname} />
            <Row label="CPU" value={`${data.system.cpus} cœurs`} />
            <Row label="Uptime OS" value={data.system.uptime} />
          </div>
        </div>
      </div>

      {/* Memory & DB Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Mémoire
          </h3>
          <div className="space-y-3">
            <MemoryBar label="RSS" current={Number(rssMb)} max={4096} unit="MB" />
            <MemoryBar label="Heap utilisé" current={Number(memUsedMb)} max={Number(memTotalMb)} unit="MB" />
            <MemoryBar label="Heap total" current={Number(memTotalMb)} max={4096} unit="MB" />
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4" /> Erreurs
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <span className="text-sm font-medium text-gray-700">Total erreurs</span>
              <span className="text-lg font-black text-gray-900 tabular-nums">{data.errors.total}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <span className="text-sm font-medium text-gray-700">Aujourd'hui</span>
              <span className={`text-lg font-black tabular-nums ${data.errors.today > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {data.errors.today}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <span className="text-sm font-medium text-gray-700">Taux (24h)</span>
              <span className="text-lg font-black text-gray-900 tabular-nums">
                {data.errors.total > 0
                  ? `${((data.errors.today / (data.errors.total)) * 100).toFixed(1)}%`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, warning }: {
  icon: React.ElementType; label: string; value: string; sub?: string; warning?: boolean
}) {
  return (
    <div className="relative rounded-2xl bg-white border border-gray-200 p-5 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
        <div className={`p-2 rounded-lg ${warning ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-black text-gray-900 tabular-nums truncate">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 font-mono text-xs">{value}</span>
    </div>
  )
}

function MemoryBar({ label, current, max, unit }: { label: string; current: number; max: number; unit: string }) {
  const pct = Math.min(100, (current / max) * 100)
  const color = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs font-mono text-gray-500">{current.toFixed(1)} / {max} {unit}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
