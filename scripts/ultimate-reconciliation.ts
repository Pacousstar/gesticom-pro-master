import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function align() {
  console.log('🚀 Lancement de la Réconciliation Ultime (Sceau Production)...');

  const stocks = await prisma.stock.findMany({
      include: { produit: { select: { designation: true } } }
  });
  
  let CreatedCount = 0;

  for (const st of stocks) {
    // 1. Calculer le solde actuel de l'historique
    const entrees = await prisma.mouvement.aggregate({
        where: { produitId: st.produitId, magasinId: st.magasinId, type: 'ENTREE' },
        _sum: { quantite: true }
    });
    const sorties = await prisma.mouvement.aggregate({
        where: { produitId: st.produitId, magasinId: st.magasinId, type: 'SORTIE' },
        _sum: { quantite: true }
    });
    const soldeHistory = (entrees._sum.quantite || 0) - (sorties._sum.quantite || 0);
    
    const diff = st.quantite - soldeHistory;
    
    if (Math.abs(diff) > 0.001) {
        // Créer un mouvement de régularisation unique pour combler l'écart
        await prisma.mouvement.create({
            data: {
                date: new Date(),
                type: diff > 0 ? 'ENTREE' : 'SORTIE',
                produitId: st.produitId,
                magasinId: st.magasinId,
                entiteId: st.entiteId,
                utilisateurId: 1,
                quantite: Math.abs(diff),
                observation: '[SCEAU PRODUCTION] Régularisation finale pour parité absolue.',
                dateOperation: new Date()
            }
        });
        CreatedCount++;
    }
  }

  console.log(`✅ Réconciliation terminée. ${CreatedCount} mouvements de régularisation créés.`);
}

align()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
