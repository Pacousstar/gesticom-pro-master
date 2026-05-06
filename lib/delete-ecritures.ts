import { prisma } from './db'
import type { PrismaClient } from '@prisma/client'

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/**
 * Supprime toutes les écritures comptables liées à une opération (vente, achat, etc.).
 * @param tx Instance de transaction optionnelle pour éviter les deadlocks SQLite.
 */
export async function deleteEcrituresByReference(
  referenceType: string,
  referenceId: number,
  tx?: TxClient
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

/**
 * Supprime toutes les écritures comptables liées à une liste d'IDs.
 * Utilisé pour VENTE_REGLEMENT où referenceId = reglementId.
 */
export async function deleteEcrituresByReferenceForIds(
  referenceType: string,
  referenceIds: number[],
  tx?: TxClient
): Promise<number> {
  if (referenceIds.length === 0) return 0
  const client = tx || prisma
  const result = await client.ecritureComptable.deleteMany({
    where: {
      referenceId: { in: referenceIds },
      OR: [
        { referenceType },
        { referenceType: { startsWith: `${referenceType}_` } }
      ]
    },
  })
  return result.count
}
