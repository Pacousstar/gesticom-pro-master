import { prisma } from './db'

interface OperationBancaireParams {
  banqueId?: number | null
  entiteId: number
  date: Date
  type: string
  libelle: string
  montant: number
  utilisateurId: number
  reference?: string | null
  beneficiaire?: string | null
  observation?: string | null
}

/**
 * Enregistre une opération bancaire, met à jour le solde de la banque
 * et assure la traçabilité dans OperationBancaire.
 * Doit être appelé à l'intérieur d'une transaction Prisma tx.
 */
export async function enregistrerOperationBancaire(
  params: OperationBancaireParams,
  tx: any
) {
  const { montant, entiteId, type } = params
  if (montant === 0) return null

  // 1. Déterminer la banque (par défaut: la première active de l'entité)
  let bId = params.banqueId
  if (!bId) {
    const defaultBanque = await tx.banque.findFirst({
      where: { entiteId, actif: true },
      orderBy: { id: 'asc' }
    })
    if (!defaultBanque) {
      throw new Error(`Aucun compte bancaire configuré pour l'entité ${entiteId}.`)
    }
    bId = defaultBanque.id
  }

  // 2. Verrouillage et récupération du solde actuel
  const banque = await tx.banque.findUnique({
    where: { id: bId },
    select: { id: true, soldeActuel: true }
  })
  if (!banque) throw new Error(`Banque ID ${bId} introuvable.`)

  const soldeAvant = banque.soldeActuel
  let soldeApres = soldeAvant

  // Déterminer si c'est une entrée ou sortie
  // Types entrants : DEPOT, VIREMENT_ENTRANT, INTERETS, REGLEMENT_CLIENT
  // Types sortants : RETRAIT, VIREMENT_SORTANT, FRAIS, REGLEMENT_FOURNISSEUR, DEPENSE, CHARGE
  const t = type.toUpperCase()
  const isEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'ENTREE', 'REVENU'].includes(t)
  
  if (isEntree) {
    soldeApres += montant
  } else {
    soldeApres -= montant
  }

  // 3. Créer l'opération de traçabilité
  const operation = await tx.operationBancaire.create({
    data: {
      banqueId: bId,
      date: params.date,
      type: t,
      libelle: params.libelle,
      montant,
      soldeAvant,
      soldeApres,
      reference: params.reference || null,
      beneficiaire: params.beneficiaire || null,
      utilisateurId: params.utilisateurId,
      observation: params.observation || null,
    }
  })

  // 4. Mise à jour du solde de la banque
  await tx.banque.update({
    where: { id: bId },
    data: { soldeActuel: soldeApres }
  })

  return operation
}

/**
 * Helpers pour identifier les modes de paiement bancaires
 */
export function estModeBanque(mode: string): boolean {
  const m = mode?.toUpperCase() || ''
  return ['CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'CARTE'].includes(m)
}
