import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const bu = new Database('C:/gesticom1206/gesticom.db');
const maxVenteId = bu.prepare('SELECT MAX(id) as maxId FROM Vente').get().maxId;
const maxAchatId = bu.prepare('SELECT MAX(id) as maxId FROM Achat').get().maxId;
const maxMvtId = bu.prepare('SELECT MAX(id) as maxId FROM Mouvement').get().maxId;

// 1. Livraison commande V1781958946508 (CIM IVOIRE -40 le 20/06)
const p1 = await prisma.produit.findFirst({ where: { code: 'ETB-00152' } });
const vCmd = await prisma.vente.findFirst({ where: { numero: 'V1781958946508' } });
if (vCmd) {
  console.log('=== LIVRAISON COMMANDE CIM IVOIRE ===');
  console.log('Vente ID:', vCmd.id, '| Type:', vCmd.typeVente, '| Retrait differe:', vCmd.retraitDiffere);
  console.log('ID > maxVenteId du backup (' + maxVenteId + ')?', vCmd.id > maxVenteId);
  const lignes = await prisma.venteLigne.findMany({ where: { venteId: vCmd.id, produitId: p1.id } });
  for (const l of lignes) console.log('  VenteLigne quantite:', l.quantite);
  const mvts = await prisma.mouvement.findMany({ where: { produitId: p1.id, observation: { contains: vCmd.numero } } });
  for (const m of mvts) console.log(`  Mouvement: ${m.type} ${m.quantite}  ${m.observation}`);
  // Cette vente est-elle incluse dans la reconstruction?
  console.log('typeVente === LIVRAISON_IMMEDIATE ?', vCmd.typeVente === 'LIVRAISON_IMMEDIATE');
  console.log('retraitDiffere === false ?', vCmd.retraitDiffere === false);
  console.log('Incluse dans reconstruction ?', vCmd.typeVente === 'LIVRAISON_IMMEDIATE' && !vCmd.retraitDiffere && vCmd.id > maxVenteId);
}

// 2. Retrait vente V1782324109829 (CIMAF -20 le 24/06)
const p2 = await prisma.produit.findFirst({ where: { code: 'ETB-00264' } });
const vRet = await prisma.vente.findFirst({ where: { numero: 'V1782324109829' } });
if (vRet) {
  console.log('\n=== RETRAIT VENTE CIMAF ===');
  console.log('Vente ID:', vRet.id, '| Type:', vRet.typeVente, '| Retrait differe:', vRet.retraitDiffere);
  console.log('ID > maxVenteId (' + maxVenteId + ')?', vRet.id > maxVenteId);
  const lignes = await prisma.venteLigne.findMany({ where: { venteId: vRet.id, produitId: p2.id } });
  for (const l of lignes) console.log('  VenteLigne quantite:', l.quantite);
  const mvts = await prisma.mouvement.findMany({ where: { produitId: p2.id, observation: { contains: vRet.numero } } });
  for (const m of mvts) console.log(`  Mouvement: ${m.type} ${m.quantite}  ${m.observation}`);
  console.log('typeVente === LIVRAISON_IMMEDIATE ?', vRet.typeVente === 'LIVRAISON_IMMEDIATE');
  console.log('retraitDiffere === false ?', vRet.retraitDiffere === false);
  console.log('Incluse dans reconstruction ?', vRet.typeVente === 'LIVRAISON_IMMEDIATE' && !vRet.retraitDiffere && vRet.id > maxVenteId);
}

// 3. Verification VenteLigne total CIMAF
const pCur2 = await prisma.produit.findFirst({ where: { code: 'ETB-00264' } });
const ventesVL = await prisma.vente.findMany({
  where: { id: { gt: maxVenteId }, typeVente: 'LIVRAISON_IMMEDIATE', retraitDiffere: false },
  include: { lignes: { where: { produitId: pCur2.id } } }
});
let total = 0;
for (const v of ventesVL) for (const l of v.lignes) { total += l.quantite; if (v.numero === 'V1782324109829') console.log('\nFOUND retrait vente dans VenteLigne:', l.quantite); }
console.log('\nTotal VenteLigne CIMAF =', total);

await prisma.$disconnect();
bu.close();
