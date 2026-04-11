const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testVente() {
  console.log('--- TEST 1 : ENREGISTREMENT DATE ANTÉRIEURE ---')
  
  // 1. Préparer les données
  const mag = await prisma.magasin.findFirst()
  const prod = await prisma.produit.findFirst()
  const user = await prisma.utilisateur.findFirst()
  if (!mag || !prod || !user) {
     console.error('Données insuffisantes pour le test.');
     return;
  }

  const initialStock = await prisma.stock.findUnique({
    where: { produitId_magasinId: { produitId: prod.id, magasinId: mag.id } }
  })
  console.log(`Stock initial : ${initialStock?.quantite || 0}`)

  const dateAnterieure = new Date('2026-01-01T10:00:00Z')
  const numeroTest = 'TEST-' + Date.now()

  // 2. Créer une vente
  console.log(`Création d'une vente au ${dateAnterieure.toISOString()}...`)
  const vente = await prisma.vente.create({
    data: {
      numero: numeroTest,
      date: dateAnterieure,
      magasinId: mag.id,
      entiteId: mag.entiteId,
      utilisateurId: user.id,
      montantTotal: 1000,
      modePaiement: 'ESPECES',
      lignes: {
        create: {
          produitId: prod.id,
          designation: prod.designation,
          quantite: 5,
          prixUnitaire: 200,
          montant: 1000
        }
      }
    }
  })
  
  // Mettre à jour le stock (Simuler la logique de l'API)
  await prisma.stock.update({
    where: { produitId_magasinId: { produitId: prod.id, magasinId: mag.id } },
    data: { quantite: { decrement: 5 } }
  })
  
  // Créer un mouvement de caisse
  await prisma.caisse.create({
    data: {
      date: dateAnterieure,
      magasinId: mag.id,
      type: 'ENTREE',
      motif: `VENTE ${numeroTest}`,
      montant: 1000,
      utilisateurId: user.id,
      entiteId: mag.entiteId
    }
  })

  console.log(`✅ Vente créée avec ID: ${vente.id}. Elle devrait apparaître en haut de liste car son ID est le plus récent.`);

  const stockApresVente = await prisma.stock.findUnique({
    where: { produitId_magasinId: { produitId: prod.id, magasinId: mag.id } }
  })
  console.log(`Stock après vente : ${stockApresVente?.quantite || 0} (Attendu: ${(initialStock?.quantite || 0) - 5})`)

  console.log('\n--- TEST 2 : SUPPRESSION ET RÉPERCUTIONS ---')
  
  // 3. Simuler la suppression (Logique du DELETE /api/ventes/[id])
  console.log(`Suppression de la vente ${vente.id}...`)
  
  await prisma.$transaction(async (tx) => {
    // Annuler les stocks
    await tx.stock.update({
      where: { produitId_magasinId: { produitId: prod.id, magasinId: mag.id } },
      data: { quantite: { increment: 5 } }
    })
    
    // Supprimer caisse
    await tx.caisse.deleteMany({ where: { motif: { contains: numeroTest } } })
    
    // Supprimer lignes et vente
    await tx.venteLigne.deleteMany({ where: { venteId: vente.id } })
    await tx.vente.delete({ where: { id: vente.id } })
  })

  const stockFinal = await prisma.stock.findUnique({
    where: { produitId_magasinId: { produitId: prod.id, magasinId: mag.id } }
  })
  console.log(`Stock final après suppression : ${stockFinal?.quantite || 0} (Attendu: ${initialStock?.quantite || 0})`)
  
  const caisseExists = await prisma.caisse.findFirst({ where: { motif: { contains: numeroTest } } })
  console.log(`Mouvement caisse supprimé : ${!caisseExists ? 'OUI ✅' : 'NON ❌'}`)

  if (stockFinal?.quantite === initialStock?.quantite) {
    console.log('\n✅ TEST RÉUSSI : Les stocks et la caisse ont été parfaitement rétablis.')
  } else {
    console.error('\n❌ ÉCHEC DU TEST : Décalage de stock détecté.')
  }
}

testVente().catch(console.error).finally(() => prisma.$disconnect())
