import { prisma } from './db'

interface MouvementCaisseParams {
  magasinId: number
  type: 'ENTREE' | 'SORTIE'
  motif: string
  montant: number
  utilisateurId: number
  entiteId?: number
  date?: Date
}

/**
 * Enregistre un mouvement de caisse si le montant est > 0
 */
export async function enregistrerMouvementCaisse({
  magasinId,
  type,
  motif,
  montant,
  utilisateurId,
  entiteId = 1,
  date = new Date()
}: MouvementCaisseParams) {
  if (montant <= 0) return null

  try {
    return await prisma.caisse.create({
      data: {
        magasinId,
        type,
        motif: motif.toUpperCase(),
        montant,
        utilisateurId,
        entiteId,
        date
      }
    })
  } catch (error) {
    console.error('Erreur enregistrerMouvementCaisse:', error)
    return null
  }
}

export function estModeEspeces(mode: string): boolean {
  const m = mode?.toUpperCase() || ''
  // SEULEMENT l'argent physique (Cash) doit impacter la table Caisse
  return m === 'ESPECES' || m === 'CASH'
}
