import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const debut = new Date('2026-06-12T08:00:00');
const fin = new Date('2026-06-25T18:00:00');

// 1. Résumé par type et par jour
const mouvements = await prisma.mouvement.findMany({
  where: {
    date: { gte: debut, lte: fin },
    magasinId: 1,
    entiteId: 1
  },
  orderBy: { date: 'asc' }
});

console.log(`Total mouvements: ${mouvements.length}`);
console.log(`Période: ${debut.toISOString()} -> ${fin.toISOString()}\n`);

// Résumé par type
const parType = {};
for (const m of mouvements) {
  const obs = (m.observation || 'Aucune').substring(0, 30);
  const key = `${m.type} | ${obs}`;
  if (!parType[key]) parType[key] = { type: m.type, observation: m.observation || 'Aucune', count: 0, totalQte: 0 };
  parType[key].count++;
  parType[key].totalQte += m.quantite;
}

console.log('=== RÉSUMÉ PAR TYPE/OBSERVATION ===');
console.log('Type | Observation | Nb | Qté totale');
for (const [key, val] of Object.entries(parType).sort((a,b) => a[0].localeCompare(b[0]))) {
  console.log(`${val.type}\t${(val.observation||'Aucune').substring(0,40)}\t${val.count}\t${val.totalQte}`);
}

// 2. Résumé par jour
console.log('\n=== RÉSUMÉ PAR JOUR ===');
console.log('Date\tENTREE_nb\tENTREE_qte\tSORTIE_nb\tSORTIE_qte');
const jourMap = {};
for (const m of mouvements) {
  const jour = m.date.toISOString().slice(0, 10);
  if (!jourMap[jour]) jourMap[jour] = { ENTREE: { nb: 0, qte: 0 }, SORTIE: { nb: 0, qte: 0 } };
  jourMap[jour][m.type].nb++;
  jourMap[jour][m.type].qte += m.quantite;
}
for (const [jour, val] of Object.entries(jourMap).sort()) {
  console.log(`${jour}\t${val.ENTREE.nb}\t${val.ENTREE.qte}\t${val.SORTIE.nb}\t${val.SORTIE.qte}`);
}

// 3. Produits les plus mouvementés
console.log('\n=== PRODUITS LES PLUS MOUVEMENTÉS ===');
const prodMap = {};
for (const m of mouvements) {
  const code = m.type === 'SORTIE' ? `-${m.produitId}` : `+${m.produitId}`;
  if (!prodMap[m.produitId]) prodMap[m.produitId] = { code: null, designation: null, entrees: 0, sorties: 0 };
  if (m.type === 'ENTREE') prodMap[m.produitId].entrees += m.quantite;
  else prodMap[m.produitId].sorties += m.quantite;
}
const prods = await prisma.produit.findMany({ where: { id: { in: Object.keys(prodMap).map(Number) } }, select: { id: true, code: true, designation: true } });
const prodIndex = {};
for (const p of prods) prodIndex[p.id] = p;
const sorted = Object.entries(prodMap).sort((a,b) => Math.abs(b[1].entrees + b[1].sorties) - Math.abs(a[1].entrees + a[1].sorties)).slice(0, 20);
console.log('Code\tDésignation\tEntrées\tSorties');
for (const [id, val] of sorted) {
  const p = prodIndex[Number(id)];
  if (p) console.log(`${p.code}\t${p.designation.trim()}\t${val.entrees}\t${val.sorties}`);
}

// 4. Focus SORTIE "Modif Vente"
console.log('\n=== SORTIES "Modif Vente" ===');
const modifVentes = mouvements.filter(m => m.type === 'SORTIE' && m.observation && m.observation.includes('Modif Vente'));
console.log(`Total Modif Vente: ${modifVentes.length}`);
const prodModif = {};
for (const m of modifVentes) {
  if (!prodModif[m.produitId]) prodModif[m.produitId] = { code: null, designation: null, qte: 0, nb: 0 };
  prodModif[m.produitId].qte += m.quantite;
  prodModif[m.produitId].nb++;
}
const sortedModif = Object.entries(prodModif).sort((a,b) => Math.abs(b[1].qte) - Math.abs(a[1].qte)).slice(0, 20);
console.log('Code\tDésignation\tNb modifs\tQté totale déduite');
for (const [id, val] of sortedModif) {
  const p = prodIndex[Number(id)];
  if (p) console.log(`${p.code}\t${p.designation.trim()}\t${val.nb}\t${val.qte}`);
}

await prisma.$disconnect();
