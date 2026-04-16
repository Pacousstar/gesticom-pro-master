/**
 * Système de synchronisation hors-ligne pour GestiCom PWA
 * Gère la file d'attente des modifications créées hors-ligne
 */

export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE'
export type SyncEntity = 'VENTE' | 'ACHAT' | 'PRODUIT' | 'CLIENT' | 'FOURNISSEUR' | 'STOCK' | 'DEPENSE' | 'CHARGE' | 'CAISSE' | 'BANQUE' | 'OPERATION_BANQUE' | 'TRANSFERT' | 'STOCK_ENTREE' | 'STOCK_SORTIE'

export interface PendingSync {
  id: string // UUID généré localement
  action: SyncAction
  entity: SyncEntity
  entityId?: number // ID de l'entité (si UPDATE ou DELETE)
  data: Record<string, any> // Données à synchroniser
  endpoint: string // Endpoint API (ex: /api/ventes)
  method: 'POST' | 'PATCH' | 'DELETE'
  timestamp: number // Date de création (timestamp)
  retries: number // Nombre de tentatives
  lastError?: string // Dernière erreur
}

const SYNC_QUEUE_KEY = 'gesticom_sync_queue'
const MAX_RETRIES = 50 // Augmenté pour éviter la perte de données

/**
 * Ajouter une opération à la file d'attente
 */
export function addToSyncQueue(pending: Omit<PendingSync, 'id' | 'timestamp' | 'retries'>): string {
  const queue = getSyncQueue()
  const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const pendingSync: PendingSync = {
    ...pending,
    id,
    timestamp: Date.now(),
    retries: 0,
  }

  queue.push(pendingSync)
  saveSyncQueue(queue)

  return id
}

/**
 * Récupérer la file d'attente
 */
export function getSyncQueue(): PendingSync[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(SYNC_QUEUE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (e) {
    console.error('Erreur lecture file sync:', e)
    return []
  }
}

/**
 * Sauvegarder la file d'attente
 */
function saveSyncQueue(queue: PendingSync[]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
  } catch (e) {
    console.error('Erreur sauvegarde file sync:', e)
  }
}

/**
 * Retirer une opération de la file d'attente
 */
export function removeFromSyncQueue(id: string): void {
  const queue = getSyncQueue()
  const filtered = queue.filter((p) => p.id !== id)
  saveSyncQueue(filtered)
}

/**
 * Synchroniser toutes les opérations en attente
 */
export async function syncAll(): Promise<{ success: number; failed: number; errors: string[] }> {
  const queue = getSyncQueue()
  if (queue.length === 0) {
    return { success: 0, failed: 0, errors: [] }
  }

  let success = 0
  let failed = 0
  const errors: string[] = []
  const remaining: PendingSync[] = []

  for (const pending of queue) {
    try {
      // Si on a déjà dépassé le nombre d'essais pour une erreur bloquante (ex 400), on garde mais on ne retente pas forcement
      // Pour l'instant on retente tout tant que < MAX_RETRIES

      const response = await fetch(pending.endpoint, {
        method: pending.method,
        headers: { 'Content-Type': 'application/json' },
        body: pending.method !== 'DELETE' ? JSON.stringify(pending.data) : undefined,
      })

      if (response.ok || response.status === 409) {
        success++
        // Succès ou Déjà existant (idempotence) : on ne l'ajoute plus à remaining
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }))
        pending.lastError = errorData.error || 'Erreur serveur'
        pending.retries++

        // On garde TOUJOURS l'élément en cas d'échec, même si MAX_RETRIES atteint
        remaining.push(pending)

        failed++
        errors.push(`${pending.entity} ${pending.action}: ${pending.lastError}`)
      }
    } catch (error) {
      pending.lastError = error instanceof Error ? error.message : 'Erreur réseau'
      pending.retries++

      // On garde TOUJOURS l'élément en cas d'échec
      remaining.push(pending)

      failed++
      // Ne pas spammer les erreurs réseau dans le tableau de retour si on est juste offline
      // Mais on compte quand même comme failed
    }
  }

  // Sauvegarder les opérations restantes (échecs + non traités)
  saveSyncQueue(remaining)

  return { success, failed, errors }
}

/**
 * Vérifier si on est en ligne
 */
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true
  // navigator.onLine n'est pas fiable pour un serveur local. 
  // On renvoie true par défaut, la boucle syncAll gérera les échecs réels de fetch.
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/**
 * Écouter les changements de connexion
 */
export function onOnlineChange(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => { }

  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

/**
 * Obtenir le nombre d'opérations en attente
 */
export function getPendingCount(): number {
  return getSyncQueue().length
}

/**
 * Vider la file d'attente (après synchronisation réussie)
 */
export function clearSyncQueue(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SYNC_QUEUE_KEY)
}
