'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function InitButton() {
  const [loading, setLoading] = useState(false)

  const handleInit = async () => {
    if (!confirm('Initialiser le plan de comptes et les journaux SYSCOHADA par défaut ?')) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/comptabilite/init', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Initialisation réussie')
      } else {
        alert(data.error || 'Erreur lors de l\'initialisation')
      }
    } catch (e) {
      alert('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleInit}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Initialiser SYSCOHADA
    </button>
  )
}
