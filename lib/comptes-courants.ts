import { prisma } from './db'

const RETRAIT_PREFIX = 'RETRAIT CC'

export function estRetrait(observation: string | null | undefined): boolean {
  return (observation || '').trim().toUpperCase().startsWith(RETRAIT_PREFIX)
}

/**
 * Somme des montants des retraits CC (observation commençant par "Retrait CC").
 * À soustraire deux fois d'une agrégation brute pour inverser le signe des retraits
 * (le total brut les compte déjà avec le signe positif du règlement).
 */
export function sousTotalRetraits(regDate: { montant: number; observation: string | null }[]): number {
  return regDate.reduce((s, r) => s + (estRetrait(r.observation) ? r.montant : 0), 0)
}

/**
 * Somme des règlements d'un fournisseur en tenant compte du sens des retraits.
 * Un retrait (observation commençant par "Retrait CC") inverse le signe :
 * il réduit le montant payé au lieu de l'augmenter.
 */
export async function totalReglementsAchat(fournisseurId: number): Promise<number> {
  const regs = await prisma.reglementAchat.findMany({
    where: { fournisseurId, statut: 'VALIDE', modePaiement: { not: 'CREDIT' } },
    select: { montant: true, observation: true },
  })
  return regs.reduce((s, r) => s + (estRetrait(r.observation) ? -r.montant : r.montant), 0)
}

/**
 * Somme des encaissements d'un client en tenant compte du sens des retraits.
 * Un retrait (observation commençant par "Retrait CC") inverse le signe :
 * il augmente la créance au lieu de la réduire.
 */
export async function totalEncaissementsClient(clientId: number): Promise<number> {
  const regs = await prisma.reglementVente.findMany({
    where: { clientId, statut: 'VALIDE', modePaiement: { not: 'CREDIT' } },
    select: { montant: true, observation: true },
  })
  return regs.reduce((s, r) => s + (estRetrait(r.observation) ? -r.montant : r.montant), 0)
}
