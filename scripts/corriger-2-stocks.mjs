import Database from 'better-sqlite3';
const dev = new Database("C:/gesticom/gesticom.db");

const corrections = [
  { nom: 'VERNIS A EAU 1L', from: -6, to: 2 },
  { nom: 'GLOBE ETANCHE', from: -4, to: 16 },
];

for (const c of corrections) {
  const p = dev.prepare("SELECT id FROM Produit WHERE designation = ?").get(c.nom);
  if (!p) { console.log(`${c.nom}: NOT FOUND`); continue; }
  
  const before = dev.prepare("SELECT quantite FROM Stock WHERE produitId = ?").get(p.id);
  console.log(`${c.nom}: avant=${before.quantite}, attendu=${c.to}`);
  
  dev.prepare("UPDATE Stock SET quantite = ? WHERE produitId = ?").run(c.to, p.id);
  
  const after = dev.prepare("SELECT quantite FROM Stock WHERE produitId = ?").get(p.id);
  console.log(`${c.nom}: apres=${after.quantite} ${after.quantite === c.to ? '✓' : '✗'}`);
}

dev.close();
console.log('\nCorrection terminée.');
