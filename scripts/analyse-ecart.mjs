import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const bu = new Database('C:/gesticom1206/gesticom.db');
const prisma = new PrismaClient();

const code = 'ETB-00152';
const maxVenteId = bu.prepare('SELECT MAX(id) as maxId FROM Vente').get().maxId;

const pCur = await prisma.produit.findFirst({ where: { code } });

// 1. VenteLigne.quantite pour LIVRAISON_IMMEDIATE post-backup
const ventesReconstruction = await prisma.vente.findMany({
  where: { id: { gt: maxVenteId }, typeVente: 'LIVRAISON_IMMEDIATE', retraitDiffere: false },
  include: { lignes: { where: { produitId: pCur.id } } }
});
console.log('VENTELIGNES UTILISÉES PAR LA RECONSTRUCTION');
let totalVL = 0;
for (const v of ventesReconstruction) {
  for (const l of v.lignes) {
    console.log(`  V${v.id} ${v.numero} : ${l.quantite} (ligne ${l.id})`);
    totalVL += l.quantite;
  }
}
console.log('Total VenteLigne.quantite =', totalVL);

// 2. SORTIES Mouvement pour les MÊMES ventes
console.log('\nSORTIES "Vente V" DANS MOUVEMENT POUR CES VENTES');
const ids = ventesReconstruction.map(v => v.id);
for (const vid of ids) {
  const mvts = await prisma.mouvement.findMany({
    where: { produitId: pCur.id, observation: { startsWith: `Vente V${vid}` }, type: 'SORTIE', magasinId: 1 }
  });
  for (const m of mvts) {
    console.log(`  V${vid} : SORTIE ${m.quantite} (${m.observation})`);
  }
}

// 3. SORTIES "Modif Vente" post-backup
console.log('\nSORTIES "Modif Vente" POUR CES VENTES');
let totalModif = 0;
for (const vid of ids) {
  const mvts = await prisma.mouvement.findMany({
    where: { produitId: pCur.id, observation: { startsWith: `Modif Vente V${vid}` }, type: 'SORTIE', magasinId: 1 }
  });
  for (const m of mvts) {
    console.log(`  V${vid} : Modif SORTIE ${m.quantite} (${m.observation})`);
    totalModif += m.quantite;
  }
}
console.log('Total Modif Vente =', totalModif);

// 4. Ventes qui ONT été modifiées (AuditLog)
console.log('\nAUDITLOG VENTE MODIFICATION');
const audit = await prisma.auditLog.findMany({
  where: { action: 'VENTE MODIFICATION', details: { contains: code } }
});
for (const a of audit) {
  console.log(`  ${a.details.substring(0, 120)}`);
}

await prisma.$disconnect();
bu.close();
