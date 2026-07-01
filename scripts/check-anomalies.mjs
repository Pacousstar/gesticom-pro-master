import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const codes = ['ETB-00152', 'ETB-00264'];

// Get all produit infos
const prods = await prisma.produit.findMany({ where: { code: { in: codes } } });

for (const prod of prods) {
  console.log('='.repeat(80));
  console.log(prod.code + ' ' + prod.designation.trim());
  console.log('='.repeat(80));

  // Get ALL ajustements
  const ajustements = await prisma.mouvement.findMany({
    where: {
      produitId: prod.id,
      entiteId: 1,
      observation: { startsWith: 'Ajustement' }
    },
    orderBy: { date: 'asc' }
  });
  
  console.log('\n--- AJUSTEMENTS MANUELS ---');
  for (const a of ajustements) {
    const d = new Date(a.date).toISOString();
    const dateStr = d.slice(0, 10) + ' ' + d.slice(11, 16);
    console.log('\nDate: ' + dateStr);
    console.log('  Type: ' + a.type);
    console.log('  Quantité: ' + a.quantite);
    console.log('  Observation: ' + a.observation);
    console.log('  Mouvement ID: ' + a.id);
    // Try to find who did it - check if there's a way to get user info
    console.log('  utilisateurId: ' + a.utilisateurId);
    if (a.utilisateurId) {
      const user = await prisma.utilisateur.findUnique({ where: { id: a.utilisateurId } });
      console.log('  Utilisateur: ' + (user ? (user.nom || user.email || user.id) : 'inconnu'));
    }
    
    // Parse the stock values from observation
    const match = a.observation.match(/\((\d+)\s*→\s*(\d+)\)/);
    if (match) {
      console.log('  Stock avant: ' + match[1] + ', après: ' + match[2] + ', diff: ' + (parseInt(match[2]) - parseInt(match[1])));
    }
  }

  // Get all Modif Vente entries for suspicious ones (multiple modifs on same vente)
  const modifs = await prisma.mouvement.findMany({
    where: {
      produitId: prod.id,
      entiteId: 1,
      observation: { startsWith: 'Modif Vente' }
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }]
  });
  
  console.log('\n--- MODIF VENTE ---');
  // Group by vente reference
  const modifGroups = {};
  for (const m of modifs) {
    const refMatch = m.observation.match(/V(\d+)/);
    const venteRef = refMatch ? refMatch[1] : 'unknown';
    if (!modifGroups[venteRef]) modifGroups[venteRef] = [];
    const d = new Date(m.date);
    modifGroups[venteRef].push({
      date: d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 16),
      quantite: m.quantite,
      type: m.type,
      id: m.id
    });
  }

  for (const [venteRef, entries] of Object.entries(modifGroups)) {
    const totalQte = entries.reduce((s, e) => s + (e.type === 'ENTREE' ? e.quantite : -e.quantite), 0);
    const flag = entries.length > 1 ? ' ⚠️ MULTIPLE ENTRIES' : '';
    if (entries.length > 1) {
      console.log('\nVente V' + venteRef + ' (' + entries.length + ' modifs)' + flag);
      for (const e of entries) {
        console.log('  ' + e.date + ' | ' + e.type + ' | ' + e.quantite + ' | mvtId=' + e.id);
      }
      
      // Get the actual sale info
      try {
        const sale = await prisma.vente.findFirst({ where: { numero: 'V' + venteRef } });
        if (sale) {
          console.log('  FACTURE: ' + (sale.numero || 'N/A'));
          console.log('  Client: ' + (sale.clientNom || 'N/A'));
          console.log('  Date vente: ' + (sale.date ? new Date(sale.date).toISOString().slice(0, 10) : 'N/A'));
          console.log('  Total: ' + sale.total);
          
          // Get the lignes to see quantities
          const lignes = await prisma.venteLigne.findMany({ where: { venteId: sale.id, produitId: prod.id } });
          for (const l of lignes) {
            console.log('  Ligne: quantite=' + l.quantite + ', prix=' + l.prix);
          }
          
          // Check ArchiveVenteLigne for modification history
          try {
            const archives = await prisma.archiveVenteLigne.findMany({ where: { venteId: sale.id, produitId: prod.id } });
            if (archives.length > 0) {
              console.log('  HISTORIQUE MODIFICATIONS:');
              for (const ar of archives) {
                const ad = new Date(ar.createdAt).toISOString().slice(0, 10) + ' ' + new Date(ar.createdAt).toISOString().slice(11, 16);
                console.log('    ' + ad + ' | ancienne qte=' + ar.quantite + ' nouvelle qte=' + (ar.nouvelleQuantite || '?'));
              }
            }
          } catch(e) {
            // ArchiveVenteLigne might not exist
          }
        } else {
          console.log('  (vente non trouvée dans la table vente)');
        }
      } catch(e) {
        console.log('  Erreur recherche vente: ' + e.message);
      }
    }
  }
}

await prisma.$disconnect();
