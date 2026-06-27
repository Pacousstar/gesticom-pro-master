import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const corrections = [
  { code: 'ETB-00152', nom: 'CIM IVOIRE', delta: +90, raison: 'Correction sur-deduction PATCH handler (cumul historique)' },
  { code: 'VERN-218',  nom: 'VERNIS A EAU 1L', delta: +8, raison: 'Stock negatif -6 → 2 (stock reel = achats 48 - ventes 46)' },
  { code: 'DIVE-018',  nom: 'GLOBE ETANCHE', delta: +4, raison: 'Stock negatif -4 → 0' },
]

const userId = 1
const magasinId = 1
const entiteId = 1

for (const c of corrections) {
  const p = await prisma.produit.findFirst({ where: { code: c.code } })
  if (!p) { console.log(`${c.code}: introuvable`); continue }

  const stock = await prisma.stock.findUnique({
    where: { produitId_magasinId_entiteId: { produitId: p.id, magasinId, entiteId } }
  })
  const avant = stock?.quantite ?? 0
  console.log(`\n${c.code} ${c.nom}`)
  console.log(`  Avant: ${avant} → Apres: ${avant + c.delta}`)

  await prisma.$transaction(async (tx) => {
    await tx.mouvement.create({
      data: {
        type: 'ENTREE',
        quantite: c.delta,
        produitId: p.id,
        magasinId,
        entiteId,
        utilisateurId: userId,
        observation: c.raison,
        dateOperation: new Date()
      }
    })
    await tx.stock.updateMany({
      where: { produitId: p.id, magasinId, entiteId },
      data: { quantite: { increment: c.delta } }
    })
  })
  console.log('  OK')
}

await prisma.$disconnect()
