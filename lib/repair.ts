import { prisma } from './db'

/**
 * Fonction de rattrapage pour la visibilité Master.
 * Rattache toutes les données orphelines (entiteId = 0 ou null) à l'entité principale (ID: 1).
 */
export async function repairVisibility() {
  try {
    const entite = await prisma.entite.findFirst({ orderBy: { id: 'asc' } })
    if (!entite) return { error: 'Aucune entité trouvée.' }

    const eid = entite.id

    const results = await Promise.all([
      prisma.depense.updateMany({ where: { OR: [{ entiteId: 0 }] }, data: { entiteId: eid } }),
      prisma.charge.updateMany({ where: { OR: [{ entiteId: 0 }] }, data: { entiteId: eid } }),
      prisma.ecritureComptable.updateMany({ where: { OR: [{ entiteId: 0 }] }, data: { entiteId: eid } }),
      prisma.vente.updateMany({ where: { OR: [{ entiteId: 0 }] }, data: { entiteId: eid } }),
      prisma.achat.updateMany({ where: { OR: [{ entiteId: 0 }] }, data: { entiteId: eid } }),
      prisma.mouvement.updateMany({ where: { OR: [{ entiteId: 0 }] }, data: { entiteId: eid } }),
      prisma.client.updateMany({ where: { OR: [{ entiteId: 0 }] }, data: { entiteId: eid } }),
      prisma.fournisseur.updateMany({ where: { OR: [{ entiteId: 0 }] }, data: { entiteId: eid } }),
      prisma.stock.updateMany({ where: { OR: [{ entiteId: 0 }] }, data: { entiteId: eid } }),
    ])

    return {
      message: 'Réparation visibilité terminée.',
      repaired: {
        depenses: results[0].count,
        charges: results[1].count,
        ecritures: results[2].count,
        ventes: results[3].count,
        achats: results[4].count,
        mouvements: results[5].count,
      }
    }
  } catch (e) {
    console.error('RepairVisibility Error:', e)
    return { error: String(e) }
  }
}
