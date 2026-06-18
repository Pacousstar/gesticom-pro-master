'use client'

import { useEffect, useRef } from 'react'

export default function PwaRegister() {
  const done = useRef(false)
  useEffect(() => {
    if (done.current || typeof window === 'undefined') return
    done.current = true

    if (!('serviceWorker' in navigator)) return

    // === Étape 1 : forcer le nettoyage de TOUS les caches ===
    const cleanup = async () => {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const reg of registrations) {
        await reg.unregister()
      }
    }

    const setup = async () => {
      await cleanup()

      // Dev : ne pas réenregistrer
      if (process.env.NODE_ENV === 'development') return

      // Production : enregistrer le SW avec cache busting
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })

      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        // Si le SW est en attente, forcer l'activation immédiate
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
        // Surveiller l'arrivée d'un SW en attente
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' })
              }
            })
          }
        })
      } catch {}

      // Vérification périodique des mises à jour (toutes les 5 min)
      setInterval(async () => {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) await reg.update()
      }, 300_000)
    }

    setup()
  }, [])

  return null
}
