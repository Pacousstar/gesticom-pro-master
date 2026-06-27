import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const vente = await prisma.vente.findFirst({
    where: { numero: 'V1782516046616' },
    select: { id: true, numero: true, montantTotal: true, montantPaye: true }
  })
  if (!vente) { console.log('VENTE NON TROUVÉE'); return }

  console.log('\n=== VENTE ===')
  console.log('  id:', vente.id)
  console.log('  numero:', vente.numero)
  console.log('  montantTotal:', vente.montantTotal)
  console.log('  montantPaye:', vente.montantPaye)

  const ecritures = await prisma.ecritureComptable.findMany({
    where: { referenceId: vente.id, referenceType: 'COMMANDE_LIVRAISON' },
    orderBy: { id: 'asc' }
  })

  if (ecritures.length === 0) {
    console.log('\nAUCUNE ÉCRITURE TROUVÉE pour COMMANDE_LIVRAISON id=' + vente.id)
    console.log('Recherche sans filtre referenceType...')
    const allEcritures = await prisma.ecritureComptable.findMany({
      where: { referenceId: vente.id },
      orderBy: { id: 'asc' }
    })
    console.log('Trouvé ' + allEcritures.length + ' avec referenceId=' + vente.id)
    for (const e of allEcritures) {
      console.log('  id=' + e.id + ' refType=' + e.referenceType + ' libelle=' + e.libelle + ' debit=' + e.debit + ' credit=' + e.credit)
    }
    return
  }

  const journalIds = [...new Set(ecritures.map(e => e.journalId))]
  const journals = await prisma.journal.findMany({ where: { id: { in: journalIds } } })
  const jMap = Object.fromEntries(journals.map(j => [j.id, j.code + '-' + j.libelle]))

  const compteIds = [...new Set(ecritures.map(e => e.compteId))]
  const comptes = await prisma.compte.findMany({ where: { id: { in: compteIds } } })
  const cMap = Object.fromEntries(comptes.map(c => [c.id, c.numero + ' ' + c.libelle]))

  console.log('\n=== ÉCRITURES COMPTABLES (' + ecritures.length + ') ===\n')
  const h = ['Date', 'Journal', 'Pièce', 'Libellé', 'Compte', 'Débit', 'Crédit']
  console.log(h.join(' | '))
  console.log('-'.repeat(160))

  for (const e of ecritures) {
    const d = e.date instanceof Date ? e.date.toISOString().split('T')[0] : String(e.date).split('T')[0]
    console.log([
      d,
      jMap[e.journalId] || '?',
      e.piece || '',
      e.libelle,
      cMap[e.compteId] || '#?' + e.compteId,
      (e.debit || 0) + ' F',
      (e.credit || 0) + ' F'
    ].join(' | '))
  }

  const totalDebit = ecritures.reduce((s, e) => s + (e.debit || 0), 0)
  const totalCredit = ecritures.reduce((s, e) => s + (e.credit || 0), 0)
  console.log('\nTOTAUX: Débit=' + totalDebit.toFixed(2) + ' F, Crédit=' + totalCredit.toFixed(2) + ' F')
  console.log('Équilibre: ' + (totalDebit === totalCredit ? '✓ OUI' : '✗ NON (diff=' + (totalDebit - totalCredit).toFixed(2) + ')'))
}

main().finally(() => prisma.$disconnect())
