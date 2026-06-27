import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const bu = new Database('C:/gesticom1206/gesticom.db');
const prisma = new PrismaClient();

const maxVenteId = bu.prepare('SELECT MAX(id) as maxId FROM Vente').get().maxId;
const maxAchatId = bu.prepare('SELECT MAX(id) as maxId FROM Achat').get().maxId;
const maxMvtId = bu.prepare('SELECT MAX(id) as maxId FROM Mouvement').get().maxId;

// Produits avec Livraison commande ou Retrait vente post-backup
const mvtsSpeciaux = await prisma.mouvement.findMany({
  where: {
    id: { gt: maxMvtId },
    magasinId: 1, entiteId: 1,
    type: 'SORTIE',
    OR: [
      { observation: { startsWith: 'Livraison commande' } },
      { observation: { startsWith: 'Retrait vente' } }
    ]
  },
  include: { produit: { select: { id: true, code: true, designation: true } } }
});

// Grouper par produit
const prodMap = {};
for (const m of mvtsSpeciaux) {
  const pid = m.produitId;
  if (!prodMap[pid]) prodMap[pid] = { code: m.produit.code, designation: m.produit.designation, livraison: 0, retrait: 0, livraisonNb: 0, retraitNb: 0 };
  if (m.observation.startsWith('Livraison commande')) { prodMap[pid].livraison += m.quantite; prodMap[pid].livraisonNb++; }
  else { prodMap[pid].retrait += m.quantite; prodMap[pid].retraitNb++; }
}

if (Object.keys(prodMap).length === 0) {
  console.log('Aucun produit avec Livraison commande ou Retrait vente.');
  await prisma.$disconnect();
  bu.close();
  process.exit(0);
}

// Pour chaque produit, récupérer stock actuel et reconstruction
console.log('Produits impactés par Livraison commande ou Retrait vente :');
console.log('Code\tDésignation\tLivraison\tRetrait\tTotal_correction\tStock_actuel\tStock_12/06');
for (const [pid, val] of Object.entries(prodMap).sort((a,b) => Math.abs((b[1].livraison+b[1].retrait)) - Math.abs((a[1].livraison+a[1].retrait)))) {
  const pCur = await prisma.produit.findFirst({ where: { id: Number(pid) } });
  const stockActuel = pCur ? (await prisma.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: pCur.id, magasinId: 1, entiteId: 1 } } }))?.quantite : '?';
  const pBu = bu.prepare('SELECT id FROM Produit WHERE code = ?').get(val.code);
  const stockBu = pBu ? bu.prepare('SELECT quantite FROM Stock WHERE produitId = ? AND magasinId = 1 AND entiteId = 1').get(pBu.id) : null;
  const totalCorr = val.livraison + val.retrait;
  console.log(`${val.code}\t${val.designation.trim()}\t${val.livraison}\t${val.retrait}\t${totalCorr}\t${stockActuel}\t${stockBu?.quantite ?? '?'}`);
}

console.log(`\nTotal produits impactés: ${Object.keys(prodMap).length}`);
console.log(`Total Livraison commande: ${mvtsSpeciaux.filter(m => m.observation.startsWith('Livraison commande')).reduce((s,m) => s+m.quantite, 0)}`);
console.log(`Total Retrait vente: ${mvtsSpeciaux.filter(m => m.observation.startsWith('Retrait vente')).reduce((s,m) => s+m.quantite, 0)}`);

await prisma.$disconnect();
bu.close();
