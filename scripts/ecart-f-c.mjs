import Database from 'better-sqlite3';

const f = new Database("F:/gesticom/gesticom.db", { readonly: true });
const c = new Database("C:/gesticom/gesticom.db", { readonly: true });

const codes = ['ETB-00152', 'ETB-00264'];

for (const code of codes) {
  console.log('='.repeat(70));
  console.log(code);
  console.log('='.repeat(70));
  
  const pF = f.prepare("SELECT id, designation FROM produit WHERE code = ?").get(code);
  const pC = c.prepare("SELECT id, designation FROM produit WHERE code = ?").get(code);
  
  if (!pF || !pC) { console.log('Produit introuvable'); continue; }
  
  const sF = f.prepare("SELECT quantite, quantiteInitiale FROM stock WHERE produitId=? AND magasinId=1 AND entiteId=1").get(pF.id);
  const sC = c.prepare("SELECT quantite, quantiteInitiale FROM stock WHERE produitId=? AND magasinId=1 AND entiteId=1").get(pC.id);
  
  console.log('Stock F: ' + sF.quantite + ' (initiale=' + sF.quantiteInitiale + ')');
  console.log('Stock C: ' + sC.quantite + ' (initiale=' + sC.quantiteInitiale + ')');
  console.log('Écart: ' + (sC.quantite - sF.quantite));
  console.log('');
  
  // Compare all movements
  const mvtsF = f.prepare("SELECT id, date, type, quantite, observation FROM mouvement WHERE produitId=? AND entiteId=1 ORDER BY id").all(pF.id);
  const mvtsC = c.prepare("SELECT id, date, type, quantite, observation FROM mouvement WHERE produitId=? AND entiteId=1 ORDER BY id").all(pC.id);
  
  console.log('Mouvements F: ' + mvtsF.length + ', C: ' + mvtsC.length);
  
  // Build maps
  const mapF = new Map();
  for (const m of mvtsF) {
    const key = m.date + '|' + m.type + '|' + m.quantite + '|' + (m.observation || '');
    mapF.set(key, (mapF.get(key) || 0) + 1);
  }
  const mapC = new Map();
  for (const m of mvtsC) {
    const key = m.date + '|' + m.type + '|' + m.quantite + '|' + (m.observation || '');
    mapC.set(key, (mapC.get(key) || 0) + 1);
  }
  
  // Movements in C but not in F (added by my dev)
  console.log('\nMouvements AJOUTÉS sur C (pas dans F):');
  let diffCount = 0;
  for (const [key, cCount] of mapC) {
    const fCount = mapF.get(key) || 0;
    if (cCount > fCount) {
      const n = cCount - fCount;
      const [dateMs, type, qte, obs] = key.split('|');
      const d = new Date(parseInt(dateMs)).toISOString().slice(0, 10) + ' ' + new Date(parseInt(dateMs)).toISOString().slice(11, 16);
      console.log('  x' + n + ' | ' + d + ' | ' + type + ' ' + qte + ' | ' + (obs || '').trim().substring(0, 60));
      diffCount++;
    }
  }
  if (diffCount === 0) console.log('  (aucun)');
  
  // Movements in F but not in C (deleted by my dev)
  console.log('\nMouvements SUPPRIMÉS sur C (existent dans F):');
  diffCount = 0;
  for (const [key, fCount] of mapF) {
    const cCount = mapC.get(key) || 0;
    if (fCount > cCount) {
      const n = fCount - cCount;
      const [dateMs, type, qte, obs] = key.split('|');
      const d = new Date(parseInt(dateMs)).toISOString().slice(0, 10) + ' ' + new Date(parseInt(dateMs)).toISOString().slice(11, 16);
      console.log('  x' + n + ' | ' + d + ' | ' + type + ' ' + qte + ' | ' + (obs || '').trim().substring(0, 60));
      diffCount++;
    }
  }
  if (diffCount === 0) console.log('  (aucun)');
  
  // Compare stock table initial
  console.log('\nDifférence stock total: ' + (sC.quantite - sF.quantite));
  console.log('Différence quantiteInitiale: ' + (sC.quantiteInitiale - sF.quantiteInitiale));
  console.log('');
}

f.close();
c.close();
