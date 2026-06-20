import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { enregistrerOperationBancaire } from '@/lib/banque'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { virementBancaireSchema } from '@/lib/validations'

/**
 * Gère les virements internes : 
 * - Entre deux banques
 * - D'une banque vers la caisse (Consolidation MM)
 * - De la caisse vers une banque (Dépôt)
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'banque:create')
  if (authError) return authError

  try {
    const body = await request.json()
    const validationResult = validateApiRequest(virementBancaireSchema, body)
    if (!validationResult.success) return validationResult.response
    const data = validationResult.data
    const sourceId = body?.sourceId
    const sourceIdType = String(body?.sourceIdType || '').toUpperCase()
    const destId = body?.destId
    const destIdType = String(body?.destIdType || '').toUpperCase()
    const motif = body?.motif ? String(body.motif).trim() : ''

    if (!sourceId || !destId) return NextResponse.json({ error: 'Source et destination requises.' }, { status: 400 })

    const entiteId = await getEntiteId(session)
    const dateVirement = data.date ? new Date(data.date) : new Date()
    const fraisMontant = Math.max(0, Number(body?.frais) || 0)

    const result = await prisma.$transaction(async (tx) => {
      // 1. DÉBIT DE LA SOURCE
      if (sourceIdType === 'BANQUE') {
await enregistrerOperationBancaire({
          banqueId: Number(sourceId),
          entiteId,
          date: dateVirement,
          type: 'VIREMENT_SORTANT',
          libelle: `Virement Interne => ${destIdType === 'CAISSE' ? 'Caisse' : 'Banque ' + destId}`,
          montant: data.montant + fraisMontant,
          utilisateurId: session.userId,
          reference: `VIR-${Date.now()}`,
          observation: motif
        }, tx)
      } else if (sourceIdType === 'CAISSE') {
        await enregistrerMouvementCaisse({
          magasinId: Number(sourceId),
          type: 'SORTIE',
          motif: `Virement Interne => ${destIdType === 'BANQUE' ? 'Banque ' + destId : 'Caisse ' + destId}`,
          montant: data.montant + fraisMontant,
          utilisateurId: session.userId,
          entiteId,
          date: dateVirement,
        }, tx)
        await recalculerSoldeCaisse(Number(sourceId), tx)
      }

      // 2. ENREGISTREMENT DES FRAIS (Si applicables)
      if (fraisMontant > 0) {
        await tx.charge.create({
          data: {
            date: dateVirement,
            entiteId,
            utilisateurId: session.userId,
            type: 'VARIABLE',
            rubrique: 'FRAIS BANCAIRES / MM',
            beneficiaire: 'Opérateur',
            montant: fraisMontant,
            observation: `Frais sur virement : ${motif || ''}`,
            modePaiement: sourceIdType === 'BANQUE' ? 'VIREMENT' : 'ESPECES',
            banqueId: sourceIdType === 'BANQUE' ? Number(sourceId) : null
          }
        })
      }

      // 3. CRÉDIT DE LA DESTINATION
      if (destIdType === 'BANQUE') {
        await enregistrerOperationBancaire({
          banqueId: Number(destId),
          entiteId,
          date: dateVirement,
          type: 'VIREMENT_ENTRANT',
          libelle: `Virement Interne depuis ${sourceIdType === 'CAISSE' ? 'Caisse' : 'Banque ' + sourceId}`,
          montant: data.montant,
          utilisateurId: session.userId,
          reference: `VIR-${Date.now()}`,
          observation: motif
        }, tx)
      } else if (destIdType === 'CAISSE') {
        await enregistrerMouvementCaisse({
          magasinId: Number(destId),
          type: 'ENTREE',
          motif: `Virement Interne depuis ${sourceIdType === 'BANQUE' ? 'Banque ' + sourceId : 'Caisse ' + sourceId}`,
          montant: data.montant,
          utilisateurId: session.userId,
          entiteId,
          date: dateVirement,
        }, tx)
        await recalculerSoldeCaisse(Number(destId), tx)
      }

      return { success: true }
    }, { timeout: 15000 })

            return NextResponse.json(result)
  } catch (e: any) {
    await apiCatch(e, 'api/banques/virement')
    return NextResponse.json({ error: e.message || 'Erreur lors du virement.' }, { status: 500 })
  }
}
