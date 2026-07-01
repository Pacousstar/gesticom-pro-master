import Database from 'better-sqlite3';
const c = new Database("C:/gesticom/gesticom.db", { readonly: true });

for (const nom of ['VERNIS A EAU 1L', 'GLOBE ETANCHE']) {
  console.log(`\n========== ${nom} ==========`);
  const p = c.prepare("SELECT id FROM Produit WHERE designation = ?").get(nom);
  const id = p.id;

  // All mouvements chronologically
  const mvts = c.prepare(`
    SELECT date, type, quantite, observation, createdAt
    FROM Mouvement
    WHERE produitId = ?
    ORDER BY date ASC
  `).all(id);
  
  console.log(`Tous les mouvements (${mvts.length}):`);
  let cumul = 0;
  for (const m of mvts) {
    const qte = m.type === 'ENTREE' ? m.quantite : -m.quantite;
    cumul += qte;
    console.log(`  ${new Date(m.date).toISOString().slice(0,19)} | ${m.type.padEnd(7)} | ${String(m.quantite).padStart(5)} | cumul=${String(cumul).padStart(4)} | ${m.observation?.slice(0,50)}`);
  }
  console.log(`Stock final depuis mouvements: ${cumul}`);
}
c.close();
