import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function generateBilan() { 
  const accounts = await prisma.planCompte.findMany();
  const balances: any[] = [];
  
  for (const acc of accounts) {
    const agg = await prisma.ecritureComptable.aggregate({
      where: { compteId: acc.id },
      _sum: { debit: true, credit: true }
    });
    const debit = agg._sum.debit || 0;
    const credit = agg._sum.credit || 0;
    const solde = debit - credit;
    if (Math.abs(solde) > 0.01) {
      balances.push({ numero: acc.numero, libelle: acc.libelle, solde });
    }
  }

  // Calcul du Résultat (Comptes 6 et 7)
  let totalProduits = 0;
  let totalCharges = 0;
  for (const b of balances) {
    if (b.numero.startsWith('7')) totalProduits += Math.abs(b.solde);
    if (b.numero.startsWith('6')) totalCharges += Math.abs(b.solde);
  }
  const resultat = totalProduits - totalCharges;
  
  // Separation Actif / Passif
  const actif = balances.filter(b => b.numero.startsWith('2') || b.numero.startsWith('3') || b.numero.startsWith('5') || (b.numero.startsWith('4') && b.solde > 0));
  const passif = balances.filter(b => b.numero.startsWith('1') || (b.numero.startsWith('4') && b.solde < 0));
  
  // Ajouter le résultat au passif (Compte 13)
  passif.push({ numero: '13', libelle: 'RÉSULTAT DE L\'EXERCICE', solde: -resultat });

  console.log('--- BILAN ACTIF ---');
  console.log(JSON.stringify(actif, null, 2));
  console.log('--- BILAN PASSIF ---');
  console.log(JSON.stringify(passif, null, 2));
} 

generateBilan()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
