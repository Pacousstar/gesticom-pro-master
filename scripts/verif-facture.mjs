import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const facture = await prisma.vente.findFirst({ where: { numero: 'V1781545121378' } });
if (!facture) { console.log('Facture introuvable'); process.exit(0); }

console.log('=== FACTURE V1781545121378 ===');
console.log('ID:', facture.id);
console.log('Type:', facture.typeVente);
console.log('Montant total:', facture.montantTotal);
console.log('Montant paye:', facture.montantPaye);
console.log('Retrait differe:', facture.retraitDiffere);
console.log('Statut:', facture.statut);

// VenteLignes avec produits
const lignes = await prisma.venteLigne.findMany({
  where: { venteId: facture.id },
  include: { produit: { select: { code: true, designation: true } } }
});
console.log('\nLignes de vente:');
let totalQte = 0;
for (const l of lignes) {
  console.log(`  ${l.produit.code} ${l.produit.designation.trim()} : ${l.quantite} x ${l.prixUnitaire} = ${l.montantLigne}`);
  totalQte += l.quantite;
}
console.log('Total quantite commandee:', totalQte);

// Toutes les livraisons pour cette facture
const mvts = await prisma.mouvement.findMany({
  where: { observation: { contains: facture.numero } }
});
console.log('\nMouvements associes:');
for (const m of mvts) {
  console.log(`  ${m.date.toISOString().slice(0,10)} ${m.type} ${m.quantite} ${m.observation} (produitId:${m.produitId})`);
}

// Verifier aussi commandes livrees distinctes
const cmdLines = await prisma.commandeLigne.findMany({
  where: { commande: { numero: facture.numero } },
  include: { commande: true, produit: { select: { code: true, designation: true } } }
});
if (cmdLines.length > 0) {
  console.log('\nCommandeLignes (modele commande separate):');
  for (const cl of cmdLines) {
    console.log(`  ${cl.produit.code} ${cl.produit.designation.trim()} : ${cl.quantite} | Livree: ${cl.quantiteLivree}`);
  }
}

await prisma.$disconnect();
