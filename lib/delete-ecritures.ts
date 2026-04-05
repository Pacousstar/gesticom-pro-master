import { prisma } from './db'

/**
 * Supprime toutes les écritures comptables liées à une opération (vente, achat, etc.).
 * À appeler avant de supprimer l'enregistrement métier pour garder la cohérence comptable.
 * @param tx Instance de transaction optionnelle pour éviter les deadlocks SQLite.
 */
export async function deleteEcrituresByReference(
  referenceType: string,
  referenceId: number,
  tx?: any
): Promise<number> {
  const client = tx || prisma
  const result = await client.ecritureComptable.deleteMany({
    where: {
      referenceId,
      OR: [
        { referenceType },
        { referenceType: { startsWith: `${referenceType}_` } }
      ]
    },
  })
  return result.count
}
