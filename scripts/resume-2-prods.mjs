import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const codes = ['ETB-00152', 'ETB-00264'];
const debut = new Date('2026-06-12T08:00:00');
const fin = new Date('2026-06-25T18:00:00');

const prods = await prisma.produit.findMany({ where: { code: { in: codes } } });
for (const p of prods) {
  console.log(p.code + ' ' + p.designation.trim());
  const mvts = await prisma.mouvement.findMany({
    where: { produitId: p.id, date: { gte: debut, lte: fin }, magasinId: 1, entiteId: 1 },
    orderBy: { date: 'asc' }
  });

  let venteQte = 0, venteNb = 0;
  let modifQte = 0, modifNb = 0;
  let livraisonQte = 0, livraisonNb = 0;
  let retraitQte = 0, retraitNb = 0;
  let achatQte = 0, achatNb = 0;
  let retourQte = 0, retourNb = 0;
  let ajustQte = 0, ajustNb = 0;
  let modifAchatQte = 0, modifAchatNb = 0;

  for (const m of mvts) {
    const obs = m.observation || '';
    if (m.type === 'SORTIE') {
      if (obs.startsWith('Vente V')) { venteNb++; venteQte += m.quantite; }
      else if (obs.startsWith('Modif Vente V')) { modifNb++; modifQte += m.quantite; }
      else if (obs.startsWith('Livraison commande V')) { livraisonNb++; livraisonQte += m.quantite; }
      else if (obs.startsWith('Retrait vente V')) { retraitNb++; retraitQte += m.quantite; }
      else { console.log('  SORTIE inclassée:', obs); }
    } else {
      if (obs.startsWith('Achat A')) { achatNb++; achatQte += m.quantite; }
      else if (obs.startsWith('Retour client')) { retourNb++; retourQte += m.quantite; }
      else if (obs.startsWith('Ajustement')) { ajustNb++; ajustQte += m.quantite; }
      else if (obs.startsWith('Modif Achat A')) { modifAchatNb++; modifAchatQte += m.quantite; }
      else { console.log('  ENTREE inclassée:', obs); }
    }
  }

  console.log(`  SORTIE Vente:             ${String(venteNb).padStart(3)} x  ${String(-venteQte).padStart(5)}`);
  console.log(`  SORTIE Modif Vente (BUG): ${String(modifNb).padStart(3)} x  ${String(-modifQte).padStart(5)}`);
  console.log(`  SORTIE Livraison cmd:     ${String(livraisonNb).padStart(3)} x  ${String(-livraisonQte).padStart(5)}`);
  console.log(`  SORTIE Retrait vente:     ${String(retraitNb).padStart(3)} x  ${String(-retraitQte).padStart(5)}`);
  console.log(`  TOTAL SORTIES:                        ${String(-(venteQte+modifQte+livraisonQte+retraitQte)).padStart(5)}`);
  console.log(`  ENTREE Achat:             ${String(achatNb).padStart(3)} x  +${String(achatQte).padStart(5)}`);
  console.log(`  ENTREE Retour client:     ${String(retourNb).padStart(3)} x  +${String(retourQte).padStart(5)}`);
  console.log(`  ENTREE Ajustement manuel: ${String(ajustNb).padStart(3)} x  +${String(ajustQte).padStart(5)}`);
  console.log(`  ENTREE Modif Achat:       ${String(modifAchatNb).padStart(3)} x  +${String(modifAchatQte).padStart(5)}`);
  console.log(`  TOTAL ENTREES:                          +${String(achatQte+retourQte+ajustQte+modifAchatQte).padStart(5)}`);
  console.log('');
}
await prisma.$disconnect();
