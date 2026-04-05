import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🏁 DÉMARRAGE DE LA PURGE TOTALE (MODE PRODUCTION)...')

  try {
    // Ordre de suppression respectant les contraintes d'intégrité
    
    console.log('- Nettoyage des transactions...');
    await prisma.ecritureComptable.deleteMany({});
    await prisma.reglementVente.deleteMany({});
    await prisma.reglementAchat.deleteMany({});
    await prisma.venteLigne.deleteMany({});
    await prisma.achatLigne.deleteMany({});
    await prisma.vente.deleteMany({});
    await prisma.achat.deleteMany({});
    await prisma.caisse.deleteMany({});
    await prisma.operationBancaire.deleteMany({});
    await prisma.mouvement.deleteMany({});
    await prisma.stock.deleteMany({});
    await prisma.depense.deleteMany({});
    await prisma.charge.deleteMany({});
    
    // Nettoyage des commandes (vérification des noms camelCase)
    if ((prisma as any).commandeFournisseurLigne) await (prisma as any).commandeFournisseurLigne.deleteMany({});
    if ((prisma as any).commandeFournisseur) await (prisma as any).commandeFournisseur.deleteMany({});
    
    // Nettoyage des transferts
    await prisma.transfertLigne.deleteMany({});
    await prisma.transfert.deleteMany({});

    // Nettoyage des archives
    await prisma.archiveVenteLigne.deleteMany({});
    await prisma.archiveVente.deleteMany({});
    await prisma.archiveSoldeClient.deleteMany({});

    console.log('- Nettoyage des données maîtres...');
    await prisma.auditLog.deleteMany({});
    await prisma.produit.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.fournisseur.deleteMany({});

    // Optionnel : On garde les utilisateurs sauf les tests, mais ici on va juste purger les logs
    // On garde l'entité et le magasin par défaut pour que l'app démarre.
    
    console.log('✅ BASE DE DONNÉES VIDÉE AVEC SUCCÈS.');
    console.log('🚀 GestiCom Pro est prêt pour le packaging final.');

  } catch (error) {
    console.error('❌ ERREUR DURANT LA PURGE :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
