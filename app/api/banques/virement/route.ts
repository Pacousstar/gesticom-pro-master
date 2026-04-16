import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { enregistrerOperationBancaire } from '@/lib/banque'
import { enregistrerMouvementCaisse } from '@/lib/caisse'
import { revalidatePath } from 'next/cache'

/**
 * Gère les virements internes : 
 * - Entre deux banques
 * - D'une banque vers la caisse (Consolidation MM)
 * - De la caisse vers une banque (Dépôt)
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json()
    const { sourceId, sourceIdType, destId, destIdType, montant, frais, date, motif } = body
    
    if (!montant || montant <= 0) return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 })
    if (!sourceId || !destId) return NextResponse.json({ error: 'Source et destination requises.' }, { status: 400 })

    const entiteId = await getEntiteId(session)
    const dateVirement = date ? new Date(date) : new Date()
    const fraisMontant = Math.max(0, Number(frais) || 0)

    const result = await prisma.$transaction(async (tx) => {
      // 1. DÉBIT DE LA SOURCE
      if (sourceIdType === 'BANQUE') {
        await enregistrerOperationBancaire({
          banqueId: Number(sourceId),
          entiteId,
          date: dateVirement,
          type: 'VIREMENT_SORTANT',
          libelle: `Virement Interne => ${destIdType === 'CAISSE' ? 'Caisse' : 'Banque ' + destId}`,
          montant: montant + fraisMontant, // On retire aussi les frais du compte source
          utilisateurId: session.userId,
          observation: motif
        }, tx)
      } else if (sourceIdType === 'CAISSE') {
        await tx.caisse.create({
          data: {
            date: dateVirement,
            magasinId: Number(sourceId),
            entiteId,
            type: 'SORTIE',
            motif: `Virement Interne => ${destIdType === 'BANQUE' ? 'Banque ' + destId : 'Caisse ' + destId}`,
            montant: montant + fraisMontant,
            utilisateurId: session.userId,
          }
        })
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
          montant: montant,
          utilisateurId: session.userId,
          observation: motif
        }, tx)
      } else if (destIdType === 'CAISSE') {
        await tx.caisse.create({
          data: {
            date: dateVirement,
            magasinId: Number(destId),
            entiteId,
            type: 'ENTREE',
            motif: `Virement Interne depuis ${sourceIdType === 'BANQUE' ? 'Banque ' + sourceId : 'Caisse ' + sourceId}`,
            montant: montant,
            utilisateurId: session.userId,
          }
        })
      }

      return { success: true }
    }, { timeout: 15000 })

    revalidatePath('/dashboard/banques')
    revalidatePath('/dashboard/caisse')

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[API VIREMENT ERROR]', e)
    return NextResponse.json({ error: e.message || 'Erreur lors du virement.' }, { status: 500 })
  }
}
