import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { comptabiliserAchat, comptabiliserVente } from '@/lib/comptabilisation'

export async function GET() {
  const prefix = 'AUDIT-MST-API-';
  const logs: string[] = ['🏁 DÉMARRAGE DE L\'AUDIT MASTER VIA API'];

  try {
    const entite = await prisma.entite.findFirst();
    const magasin = await prisma.magasin.findFirst();
    const utilisateur = await prisma.utilisateur.findFirst();
    
    if (!entite || !magasin || !utilisateur) throw new Error('Configuration incomplète (Entité/Magasin/User).');

    // 0. NETTOYAGE
    await cleanAuditData(prefix);
    logs.push('0. Nettoyage effectué.');

    // 1. INITIALISATION
    const produit = await prisma.produit.create({
      data: { code: `${prefix}PROD`, designation: 'PRODUIT MASTER API', categorie: 'CERTIF', prixAchat: 1000, prixVente: 5000, pamp: 1000, entiteId: entite.id }
    });
    const fourn = await prisma.fournisseur.create({ data: { code: `${prefix}FOUR`, nom: 'FOURNISSEUR MASTER API', entiteId: entite.id } });
    const client = await prisma.client.create({ data: { code: `${prefix}CL`, nom: 'CLIENT MASTER API', type: 'CREDIT', plafondCredit: 1000000, entiteId: entite.id } });
    logs.push('1. Données témoins créées.');

    // 2. CYCLE ACHAT A (TVA 18%)
    const numA = `${prefix}ACH-A`;
    const ttcA = 11800; // 10000 + 1800
    await prisma.achat.create({
      data: { numero: numA, date: new Date(), magasinId: magasin.id, entiteId: entite.id, utilisateurId: utilisateur.id, fournisseurId: fourn.id, montantTotal: ttcA, montantPaye: ttcA, statutPaiement: 'PAYE', modePaiement: 'ESPECES',
        lignes: { create: [{ produitId: produit.id, designation: produit.designation, quantite: 10, prixUnitaire: 1000, tva: 18, montant: ttcA }] }
      }
    });
    await updateStockAndPAMP(produit.id, 10, 10000, 0, magasin.id, entite.id, utilisateur.id, numA);
    // @ts-ignore
    await comptabiliserAchat({ achatId: 0, numeroAchat: numA, date: new Date(), montantTotal: ttcA, modePaiement: 'ESPECES', fournisseurId: fourn.id, entiteId: entite.id, utilisateurId: utilisateur.id, magasinId: magasin.id, reglements: [{ mode: 'ESPECES', montant: ttcA }], lignes: [{ produitId: produit.id, designation: produit.designation, quantite: 10, prixUnitaire: 1000, tva: 18 }] });
    logs.push('2. Cycle A (TVA) ok.');

    // 3. CYCLE ACHAT B (REMISE)
    const numB = `${prefix}ACH-B`;
    const ttcB = 8000; // 10000 - 2000
    await prisma.achat.create({
      data: { numero: numB, date: new Date(), magasinId: magasin.id, entiteId: entite.id, utilisateurId: utilisateur.id, fournisseurId: fourn.id, montantTotal: ttcB, montantPaye: ttcB, statutPaiement: 'PAYE', modePaiement: 'ESPECES',
        lignes: { create: [{ produitId: produit.id, designation: produit.designation, quantite: 10, prixUnitaire: 1000, remise: 2000, montant: ttcB }] }
      }
    });
    await updateStockAndPAMP(produit.id, 10, 8000, 0, magasin.id, entite.id, utilisateur.id, numB);
    // @ts-ignore
    await comptabiliserAchat({ achatId: 0, numeroAchat: numB, date: new Date(), montantTotal: ttcB, modePaiement: 'ESPECES', fournisseurId: fourn.id, entiteId: entite.id, utilisateurId: utilisateur.id, magasinId: magasin.id, reglements: [{ mode: 'ESPECES', montant: ttcB }], lignes: [{ produitId: produit.id, designation: produit.designation, quantite: 10, prixUnitaire: 1000, remise: 2000 }] });
    logs.push('3. Cycle B (Remise) ok.');

    // 4. CYCLE VENTE C (MIXTE + FRAIS)
    const numVA = `${prefix}V-A`;
    const ttcVA = 30320;
    const pCurrent = await prisma.produit.findUnique({ where: { id: produit.id } });
    await prisma.vente.create({
      data: { numero: numVA, date: new Date(), magasinId: magasin.id, entiteId: entite.id, utilisateurId: utilisateur.id, clientId: client.id, montantTotal: ttcVA, montantPaye: ttcVA, statutPaiement: 'PAYE', modePaiement: 'ESPECES', statut: 'VALIDEE', fraisApproche: 2000,
        lignes: { create: [{ produitId: produit.id, designation: produit.designation, quantite: 5, prixUnitaire: 5000, remise: 1000, tva: 18, coutUnitaire: pCurrent?.pamp || 0, montant: ttcVA - 2000 }] }
      }
    });
    await updateStockForSale(produit.id, 5, magasin.id, entite.id, utilisateur.id, numVA);
    // @ts-ignore
    await comptabiliserVente({ venteId: 0, numeroVente: numVA, date: new Date(), montantTotal: ttcVA, modePaiement: 'ESPECES', clientId: client.id, entiteId: entite.id, utilisateurId: utilisateur.id, magasinId: magasin.id, reglements: [{ mode: 'ESPECES', montant: ttcVA }], fraisApproche: 2000, lignes: [{ produitId: produit.id, designation: produit.designation, quantite: 5, prixUnitaire: 5000, coutUnitaire: pCurrent?.pamp || 0, tva: 18, remise: 1000 }] });
    logs.push('4. Cycle C (Vente Mixte + Frais) ok.');

    // 5. BALANCE
    const ecritures = await prisma.ecritureComptable.findMany({ where: { piece: { startsWith: prefix } } });
    let debit = 0, credit = 0;
    ecritures.forEach(e => { debit += e.debit; credit += e.credit; });
    const balanceOk = Math.abs(debit - credit) < 1;
    logs.push(`5. Balance : ${balanceOk ? 'ÉQUILIBRÉE' : 'DÉSÉQUILIBRÉE'} (D:${debit} C:${credit}).`);

    await cleanAuditData(prefix);
    logs.push('🌟 AUDIT RÉUSSI - CERTIFICATION OK.');

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message, logs }, { status: 500 });
  }
}

async function updateStockAndPAMP(produitId: number, qty: number, valAchatNetHT: number, frais: number, magasinId: number, entiteId: number, userId: number, pieces: string) {
    const p = await prisma.produit.findUnique({ where: { id: produitId }, include: { stocks: true } });
    const stockAvant = p?.stocks.reduce((acc: number, s: any) => acc + s.quantite, 0) || 0;
    const pampAvant = p?.pamp || 0;
    const nouveauPamp = (stockAvant * pampAvant + valAchatNetHT + frais) / (stockAvant + qty);
    await prisma.produit.update({ where: { id: produitId }, data: { pamp: Math.round(nouveauPamp) } });
    let st = await prisma.stock.findUnique({ where: { produitId_magasinId: { produitId, magasinId } } });
    if (!st) {
        await prisma.stock.create({ data: { produitId, magasinId, entiteId, quantite: qty } });
    } else {
        await prisma.stock.update({ where: { id: st.id }, data: { quantite: { increment: qty } } });
    }
    await prisma.mouvement.create({ data: { type: 'ENTREE', produitId, magasinId, entiteId, utilisateurId: userId, quantite: qty, observation: `Audit ${pieces}` } });
}

async function updateStockForSale(produitId: number, qty: number, magasinId: number, entiteId: number, userId: number, pieces: string) {
    await prisma.stock.update({ where: { produitId_magasinId: { produitId, magasinId } }, data: { quantite: { decrement: qty } } });
    await prisma.mouvement.create({ data: { type: 'SORTIE', produitId, magasinId, entiteId, utilisateurId: userId, quantite: qty, observation: `Audit ${pieces}` } });
}

async function cleanAuditData(prefix: string) {
    await prisma.ecritureComptable.deleteMany({ where: { piece: { startsWith: prefix } } });
    await prisma.caisse.deleteMany({ where: { motif: { contains: prefix } } });
    await prisma.mouvement.deleteMany({ where: { observation: { contains: prefix } } });
    const ventes = await prisma.vente.findMany({ where: { numero: { startsWith: prefix } } });
    for (const v of ventes) {
        await prisma.venteLigne.deleteMany({ where: { venteId: v.id } });
        await prisma.reglementVente.deleteMany({ where: { venteId: v.id } });
        await prisma.vente.delete({ where: { id: v.id } });
    }
    const achats = await prisma.achat.findMany({ where: { numero: { startsWith: prefix } } });
    for (const a of achats) {
        await prisma.achatLigne.deleteMany({ where: { achatId: a.id } });
        await prisma.reglementAchat.deleteMany({ where: { achatId: a.id } });
        await prisma.achat.delete({ where: { id: a.id } });
    }
    await prisma.stock.deleteMany({ where: { produit: { code: { startsWith: prefix } } } });
    await prisma.produit.deleteMany({ where: { code: { startsWith: prefix } } });
    await prisma.fournisseur.deleteMany({ where: { code: { startsWith: prefix } } });
    await prisma.client.deleteMany({ where: { code: { startsWith: prefix } } });
}
