import { prisma } from './db'

interface MouvementCaisseParams {
  magasinId: number
  type: 'ENTREE' | 'SORTIE'
  motif: string
  montant: number
  utilisateurId: number
  entiteId?: number
  date?: Date
  observation?: string
  sousType?: string
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
  date = new Date(),
  observation,
  sousType,
}: MouvementCaisseParams, tx?: any) {
  if (montant <= 0) return null

  const prismaClient = tx || prisma

  try {
    return await prismaClient.caisse.create({
      data: {
        magasinId,
        type,
        motif: motif.toUpperCase(),
        montant,
        utilisateurId,
        entiteId,
        date,
        observation: observation || null,
        sousType: sousType || 'MANUEL',
      }
    })
  } catch (error) {
    console.error('Erreur enregistrerMouvementCaisse:', error)
    return null
  }
}

/**
 * Calcule le solde de caisse d'un magasin à partir des mouvements réels, SANS modifier la base.
 */
export async function calculerSoldeCaisse(magasinId: number, tx?: any): Promise<number> {
  const prismaClient = tx || prisma
  const entrees = (await prismaClient.caisse.aggregate({
    where: { magasinId, type: 'ENTREE' },
    _sum: { montant: true },
  }))._sum.montant || 0
  const sorties = (await prismaClient.caisse.aggregate({
    where: { magasinId, type: 'SORTIE' },
    _sum: { montant: true },
  }))._sum.montant || 0
  return entrees - sorties
}

/**
 * Recalcule le soldeCaisse du magasin à partir des mouvements réels.
 * À appeler après chaque mouvement de caisse pour maintenir la cohérence.
 */
export async function recalculerSoldeCaisse(magasinId: number, tx?: any) {
  const prismaClient = tx || prisma
  const solde = await calculerSoldeCaisse(magasinId, tx)
  await prismaClient.magasin.update({
    where: { id: magasinId },
    data: { soldeCaisse: solde },
  })
  return solde
}