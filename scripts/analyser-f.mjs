import Database from 'better-sqlite3';

const f = new Database("F:/gesticom/gesticom.db", { readonly: true });
const b = new Database("C:/gesticom - BILAL1106/gesticom.db", { readonly: true });

const codes = ['ETB-00152', 'ETB-00264'];
const debut = new Date("2026-06-16").getTime();
const fin = new Date("2026-06-26").getTime();

for (const code of codes) {
  console.log('='.repeat(70));
  console.log(code + ' sur F: (client)');
  console.log('='.repeat(70));
  
  const pF = f.prepare("SELECT id, designation FROM produit WHERE code = ?").get(code);
  const stockF = f.prepare("SELECT quantite FROM stock WHERE produitId=? AND magasinId=1 AND entiteId=1").get(pF.id);
  
  // Get stock from backup saine (11/06)
  const pB = b.prepare("SELECT id FROM produit WHERE code = ?").get(code);
  const stockB = b.prepare("SELECT quantite FROM stock WHERE produitId=? AND magasinId=1 AND entiteId=1").get(pB.id);
  
  console.log('Stock backup 11/06: ' + stockB.quantite);
  
  // Get ALL movements for this period on F:
  const mvts = f.prepare(`
    SELECT m.date, m.type, m.quantite, m.observation, u.nom as userName
    FROM mouvement m
    LEFT JOIN utilisateur u ON u.id = m.utilisateurId
    WHERE m.produitId = ? AND m.entiteId = 1 AND m.date >= ? AND m.date < ?
    ORDER BY m.date ASC, m.id ASC
  `).all(pF.id, debut, fin);
  
  let running = stockB.quantite;
  let currentDate = '';
  let dayMvts = [];
  let dayDelta = 0;
  
  // Filter to only 16-25 range
  for (const m of mvts) {
    const d = new Date(m.date).toISOString().slice(0, 10);
    const h = new Date(m.date).toISOString().slice(11, 16);
    const qte = m.type === 'ENTREE' ? m.quantite : -m.quantite;
    const obs = (m.observation || '').trim();
    
    // Skip movements before 16/06
    if (d < '2026-06-16') {
      running += qte;
      continue;
    }
    
    // Print only 16/06 to 25/06
    if (d > '2026-06-25') break;
    
    if (d !== currentDate && currentDate !== '') {
      console.log(currentDate + ' | stock=' + (running - dayDelta) + ' → ' + running + ' | ' + dayMvts.join(', '));
      dayMvts = [];
      dayDelta = 0;
    }
    
    currentDate = d;
    running += qte;
    dayDelta += qte;
    
    let label = obs.includes('Vente') ? 'VTE' :
                obs.includes('Modif Vente') ? 'MODIF' :
                obs.includes('Achat') ? 'ACHAT' :
                obs.includes('Ajustement') ? 'AJUST' :
                obs.includes('Livraison') ? 'LIVR' :
                obs.includes('Retrait') ? 'RETR' :
                obs.includes('Retour') ? 'RETOUR' : 'AUTRE';
    
    dayMvts.push(label + (qte > 0 ? '+' : '') + qte);
  }
  
  if (currentDate && dayMvts.length > 0) {
    console.log(currentDate + ' | stock=' + (running - dayDelta) + ' → ' + running + ' | ' + dayMvts.join(', '));
  }
  
  console.log('\nStock final F: ' + stockF.quantite);
  console.log('');
  
  // Check for unusual operations (ajustements, modifs)
  console.log('Opérations inhabituelles dans cette période:');
  for (const m of mvts) {
    const d = new Date(m.date).toISOString().slice(0, 10);
    if (d < '2026-06-16' || d > '2026-06-25') continue;
    const obs = (m.observation || '').trim();
    if (obs.startsWith('Ajustement') || obs.startsWith('Modif Vente')) {
      const h = new Date(m.date).toISOString().slice(11, 16);
      const qte = m.type === 'ENTREE' ? '+' + m.quantite : '-' + m.quantite;
      console.log('  ' + d + ' ' + h + ' | ' + m.type + ' ' + qte + ' | ' + obs.substring(0, 60) + ' | par ' + (m.userName || '?'));
    }
  }
  console.log('');
}

f.close();
b.close();
