const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
  console.log('--- AUDIT D\'INTÉGRITÉ COMPTABLE ---');
  try {
    // 1. Récupérer toutes les ventes validées
    const ventes = await prisma.vente.findMany({
      where: { statut: { in: ['VALIDE', 'VALIDEE'] } },
      select: { id: true, numero: true, montantTotal: true, entiteId: true }
    });

    console.log(`Nombre de ventes validées à auditer : ${ventes.length}`);

    const anomalies = [];
    let ventesSansEcritures = 0;
    let ventesDesequilibrees = 0;
    let ventesEcartMontant = 0;

    for (const v of ventes) {
      // Récupérer les écritures liées à cette vente (Type VENTE uniquement pour le TTC)
      const ecritures = await prisma.ecritureComptable.findMany({
        where: { referenceType: 'VENTE', referenceId: v.id }
      });

      if (ecritures.length === 0) {
        ventesSansEcritures++;
        anomalies.push({ id: v.id, numero: v.numero, type: 'MANQUANTE', message: 'Aucune écriture comptable trouvée.' });
        continue;
      }

      // Vérifier l'équilibre Débit/Crédit
      const totalDebit = ecritures.reduce((acc, e) => acc + e.debit, 0);
      const totalCredit = ecritures.reduce((acc, e) => acc + e.credit, 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        ventesDesequilibrees++;
        anomalies.push({ id: v.id, numero: v.numero, type: 'DÉSÉQUILIBRE', message: `Débit (${totalDebit}) != Crédit (${totalCredit})` });
      }

      // Vérifier si le Débit total (TTC) correspond au montant de la vente
      // Normalement, le débit du compte 411 doit être égal au montantTotal de la vente
      if (Math.abs(totalDebit - v.montantTotal) > 1) {
        ventesEcartMontant++;
        anomalies.push({ id: v.id, numero: v.numero, type: 'ÉCART_MONTANT', message: `Vente (${v.montantTotal}) != Compta (${totalDebit})` });
      }
    }

    console.log('\n--- RÉSULTATS DU DIAGNOSTIC ---');
    console.log(`Ventes sans écritures : ${ventesSansEcritures}`);
    console.log(`Ventes déséquilibrées : ${ventesDesequilibrees}`);
    console.log(`Ventes avec écart de montant : ${ventesEcartMontant}`);
    console.log('-------------------------------\n');

    if (anomalies.length > 0) {
      console.log('Détails des 10 premières anomalies :');
      console.table(anomalies.slice(0, 10));
    } else {
      console.log('Félicitations ! L\'intégrité comptable des ventes est parfaite.');
    }

  } catch (e) {
    console.error('ERREUR AUDIT:', e);
  } finally {
    await prisma.$disconnect();
  }
}

audit();
