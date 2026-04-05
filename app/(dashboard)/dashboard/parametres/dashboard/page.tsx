'use client'

import { useState, useEffect } from 'react'
import { LayoutDashboard, GripVertical, X, Save, Loader2, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'

type Widget = {
  id: string
  name: string
  icon: string
  visible: boolean
  order: number
}

const AVAILABLE_WIDGETS: Widget[] = [
  { id: 'caJour', name: 'CA du Jour', icon: '💵', visible: true, order: 1 },
  { id: 'soldeCaisse', name: 'Solde Caisse', icon: '💼', visible: true, order: 2 },
  { id: 'soldeBanque', name: 'Solde Banque', icon: '🏦', visible: true, order: 3 },
  { id: 'transactions', name: 'Transactions du jour', icon: '💰', visible: true, order: 4 },
  { id: 'produits', name: 'Produits en stock', icon: '📦', visible: true, order: 5 },
  { id: 'mouvements', name: 'Mouvements du jour', icon: '🔄', visible: true, order: 6 },
  { id: 'clients', name: 'Clients actifs', icon: '👥', visible: true, order: 7 },
  { id: 'ca', name: 'Évolution CA', icon: '📈', visible: true, order: 8 },
  { id: 'stock', name: 'Mouvements de stock', icon: '📊', visible: true, order: 9 },
  { id: 'repartition', name: 'Répartition par catégorie', icon: '🥧', visible: true, order: 10 },
  { id: 'topProduits', name: 'Top produits', icon: '🏆', visible: true, order: 11 },
  { id: 'actions', name: 'Actions rapides', icon: '⚡', visible: true, order: 12 },
]

export default function DashboardPreferencesPage() {
  const [widgets, setWidgets] = useState<Widget[]>(AVAILABLE_WIDGETS)
  const [periode, setPeriode] = useState('30')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draggedWidget, setDraggedWidget] = useState<Widget | null>(null)
  const { success: showSuccess, error: showError } = useToast()

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/preferences')
      if (res.ok) {
        const data = await res.json()
        if (data.widgets && Array.isArray(data.widgets)) {
          // Fusionner avec les widgets disponibles
          const merged = AVAILABLE_WIDGETS.map((w) => {
            const saved = data.widgets.find((sw: Widget) => sw.id === w.id)
            return saved ? { ...w, ...saved } : w
          })
          // Trier par order
          merged.sort((a, b) => a.order - b.order)
          setWidgets(merged)
        }
        if (data.periode) {
          setPeriode(data.periode)
        }
      }
    } catch (e) {
      console.error('Erreur chargement préférences:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/dashboard/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgets: widgets.map((w, index) => ({ ...w, order: index + 1 })),
          periode,
        }),
      })

      if (res.ok) {
        showSuccess('Préférences sauvegardées avec succès.')
        setEditing(false)
      } else {
        const data = await res.json()
        showError(formatApiError(data.error || 'Erreur lors de la sauvegarde.'))
      }
    } catch (e) {
      showError(formatApiError(e))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleWidget = (widgetId: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, visible: !w.visible } : w))
    )
  }

  const handleDragStart = (widget: Widget) => {
    setDraggedWidget(widget)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetWidget: Widget) => {
    if (!draggedWidget || draggedWidget.id === targetWidget.id) return

    const draggedIndex = widgets.findIndex((w) => w.id === draggedWidget.id)
    const targetIndex = widgets.findIndex((w) => w.id === targetWidget.id)

    const newWidgets = [...widgets]
    const [removed] = newWidgets.splice(draggedIndex, 1)
    newWidgets.splice(targetIndex, 0, removed)

    setWidgets(newWidgets)
    setDraggedWidget(null)
  }

  const handleReset = () => {
    if (confirm('Réinitialiser les préférences aux valeurs par défaut ?')) {
      setWidgets(AVAILABLE_WIDGETS)
      setPeriode('30')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Personnalisation du Tableau de Bord</h1>
          <p className="mt-1 text-white/90">Configurez l'affichage et l'ordre des widgets</p>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
            >
              <LayoutDashboard className="h-5 w-5" />
              Modifier
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                Enregistrer
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  loadPreferences()
                }}
                className="flex items-center gap-2 rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300"
              >
                Annuler
              </button>
            </>
          )}
        </div>
      </div>

      {/* Paramètres généraux */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Paramètres généraux</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Période par défaut</label>
            <select
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              disabled={!editing}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none disabled:bg-gray-100"
            >
              <option value="7">7 derniers jours</option>
              <option value="30">30 derniers jours</option>
              <option value="90">90 derniers jours</option>
              <option value="mois">12 derniers mois</option>
            </select>
          </div>
        </div>
      </div>

      {/* Widgets */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Widgets du tableau de bord</h2>
          {editing && (
            <button
              onClick={handleReset}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Réinitialiser
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <p className="mb-4 text-sm text-gray-600">
              Glissez-déposez pour réorganiser. Cliquez sur l'icône œil pour afficher/masquer.
            </p>
            {widgets.map((widget) => (
              <div
                key={widget.id}
                draggable
                onDragStart={() => handleDragStart(widget)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(widget)}
                className={`flex items-center gap-3 rounded-lg border-2 p-4 transition-all ${draggedWidget?.id === widget.id
                    ? 'border-orange-500 bg-orange-50 opacity-50'
                    : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-md cursor-move'
                  }`}
              >
                <GripVertical className="h-5 w-5 text-gray-400" />
                <span className="text-2xl">{widget.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{widget.name}</p>
                </div>
                <button
                  onClick={() => handleToggleWidget(widget.id)}
                  className={`rounded-lg p-2 transition-colors ${widget.visible
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  title={widget.visible ? 'Masquer' : 'Afficher'}
                >
                  {widget.visible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {widgets
              .filter((w) => w.visible)
              .map((widget) => (
                <div
                  key={widget.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <span className="text-2xl">{widget.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{widget.name}</p>
                    <p className="text-xs text-gray-500">Ordre: {widget.order}</p>
                  </div>
                  {widget.visible && (
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  )}
                </div>
              ))}
            {widgets.filter((w) => !w.visible).length > 0 && (
              <div className="col-span-full mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-700">
                  {widgets.filter((w) => !w.visible).length} widget(s) masqué(s)
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aperçu */}
      {!editing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-start gap-2">
            <LayoutDashboard className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">Aperçu</h3>
              <p className="mt-1 text-sm text-blue-800">
                Cliquez sur "Modifier" pour personnaliser votre tableau de bord. Les modifications seront visibles après sauvegarde.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
