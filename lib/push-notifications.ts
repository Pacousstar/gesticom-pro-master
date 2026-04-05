/**
 * Système de notifications push pour GestiCom PWA
 * Permet d'envoyer des notifications push aux utilisateurs
 */

export type NotificationType = 
  | 'STOCK_FAIBLE'
  | 'VENTE_IMPORTANTE'
  | 'RAPPEL_PAIEMENT'
  | 'ALERTE_GENERALE'

export interface PushNotification {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, any>
  tag?: string
  requireInteraction?: boolean
}

/**
 * Demander la permission pour les notifications push
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    return 'denied'
  }

  const permission = await Notification.requestPermission()
  return permission
}

/**
 * Envoyer une notification push
 */
export async function sendNotification(notification: PushNotification): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return
  }

  if (Notification.permission !== 'granted') {
    const permission = await requestNotificationPermission()
    if (permission !== 'granted') {
      return
    }
  }

  const serviceWorkerRegistration = await navigator.serviceWorker.ready

  await serviceWorkerRegistration.showNotification(notification.title, {
    body: notification.body,
    icon: notification.icon || '/icon-192x192.png',
    badge: notification.badge || '/icon-192x192.png',
    data: notification.data,
    tag: notification.tag,
    requireInteraction: notification.requireInteraction || false,
  })
}

/**
 * Vérifier si les notifications sont supportées
 */
export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'Notification' in window && 'serviceWorker' in navigator
}

/**
 * Vérifier si les notifications sont autorisées
 */
export function isNotificationGranted(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  return Notification.permission === 'granted'
}

/**
 * Créer une notification pour stock faible
 */
export function createStockLowNotification(produit: { code: string; designation: string }, magasin: { code: string; nom: string }): PushNotification {
  return {
    title: '⚠️ Stock faible',
    body: `${produit.code} - ${produit.designation} en rupture au magasin ${magasin.code}`,
    tag: `stock-${produit.code}-${magasin.code}`,
    data: {
      type: 'STOCK_FAIBLE',
      produitCode: produit.code,
      magasinCode: magasin.code,
    },
  }
}

/**
 * Créer une notification pour vente importante
 */
export function createImportantSaleNotification(montant: number, numero: string): PushNotification {
  return {
    title: '💰 Vente importante',
    body: `Vente ${numero} : ${montant.toLocaleString('fr-FR')} FCFA`,
    tag: `vente-${numero}`,
    data: {
      type: 'VENTE_IMPORTANTE',
      numero,
      montant,
    },
  }
}

/**
 * Créer une notification pour rappel de paiement
 */
export function createPaymentReminderNotification(client: { nom: string }, montant: number): PushNotification {
  return {
    title: '💳 Rappel de paiement',
    body: `${client.nom} : ${montant.toLocaleString('fr-FR')} FCFA à recevoir`,
    tag: `paiement-${client.nom}`,
    data: {
      type: 'RAPPEL_PAIEMENT',
      clientNom: client.nom,
      montant,
    },
  }
}
