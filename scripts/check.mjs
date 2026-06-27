import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

const v = await p.vente.findFirst({ where: { numero: 'V1782516046616' }, select: { id: true, numero: true, montantTotal: true, montantPaye: true } })
if (!v) { console.log('NOT FOUND'); process.exit(1) }
console.log('VENTE:', JSON.stringify(v))

const ec = await p.ecritureComptable.findMany({ where: { referenceId: v.id, referenceType: 'COMMANDE_LIVRAISON' }, orderBy: { id: 'asc' } })
console.log('ECRITURES trouvees:', ec.length)

if (ec.length === 0) {
  const all = await p.ecritureComptable.findMany({ where: { referenceId: v.id }, orderBy: { id: 'asc' } })
  console.log('TOUTES avec referenceId=' + v.id + ':', all.length)
  for (const e of all) {
    console.log('  id=' + e.id + ' type=' + e.referenceType + ' lib=' + e.libelle + ' piece=' + e.piece + ' D=' + e.debit + ' C=' + e.credit + ' j=' + e.journalId + ' c=' + e.compteId)
  }
} else {
  for (const e of ec) {
    const pc = await p.planCompte.findUnique({ where: { id: e.compteId } })
    const j = await p.journal.findUnique({ where: { id: e.journalId } })
    console.log('id=' + e.id + ' date=' + e.date + ' j=' + (j?j.code:'?') + ' piece=' + e.piece + ' lib=' + e.libelle + ' cpt=' + (pc?pc.numero:'?'+e.compteId) + ' D=' + e.debit + ' C=' + e.credit)
  }
}

await p.$disconnect()
