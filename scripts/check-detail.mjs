import Database from 'better-sqlite3';
const db = new Database('C:/gesticom/gesticom.db', { readonly: true });

// CIMAF vente modifiée 2x - get vente ID first
console.log('=== CIMAF V1781514890503 ===');
const v1 = db.prepare('SELECT id FROM vente WHERE numero = ?').get('V1781514890503');
if (v1) {
  const archives = db.prepare('SELECT * FROM archiveVenteLigne WHERE venteId = ?').all(v1.id);
  console.log('Archives (anciennes valeurs avant modif):');
  if (archives.length > 0) {
    for (const a of archives) {
      const p = db.prepare('SELECT code, designation FROM produit WHERE id = ?').get(a.produitId);
      console.log('  prod=' + (p ? p.code + ' ' + p.designation.trim() : 'id=' + a.produitId) + ' qte=' + a.quantite + ' prix=' + a.prixUnitaire);
    }
  } else {
    console.log('  (aucune archive - les lignes ont été AJOUTÉES, pas modifiées)');
  }
  
  console.log('\nLignes ACTUELLES:');
  const lignes = db.prepare('SELECT * FROM venteLigne WHERE venteId = ?').all(v1.id);
  for (const l of lignes) {
    const p = db.prepare('SELECT code, designation FROM produit WHERE id = ?').get(l.produitId);
    console.log('  prod=' + (p ? p.code + ' ' + p.designation.trim() : 'id=' + l.produitId) + ' qte=' + l.quantite + ' prix=' + l.prix);
  }
}

console.log('\n=== Ajustements manuels détails ===');
const ajusts = db.prepare("SELECT m.id, m.date, m.type, m.quantite, m.observation, m.utilisateurId, u.nom as userName FROM mouvement m LEFT JOIN utilisateur u ON m.utilisateurId = u.id WHERE m.id IN (5529, 5530, 6337, 6338)").all();
for (const a of ajusts) {
  const d = new Date(a.date).toISOString().slice(0, 10) + ' ' + new Date(a.date).toISOString().slice(11, 16);
  console.log('Mvt ' + a.id + ': ' + d + ' | ' + a.type + ' ' + a.quantite + ' | user=' + (a.userName || a.utilisateurId) + ' | ' + a.observation);
}

// CIMAF 15/06 - context: what happened around the ajustement
console.log('\n=== CIMAF 15/06 - Contexte ajustement +1 ===');
const ctx1 = db.prepare(`
  SELECT m.id, m.date, m.type, m.quantite, m.observation, u.nom as user
  FROM mouvement m LEFT JOIN utilisateur u ON m.utilisateurId = u.id
  WHERE m.id >= 5525 AND m.id <= 5535
  ORDER BY m.id ASC
`).all();
for (const m of ctx1) {
  const d = new Date(m.date).toISOString().slice(0, 10) + ' ' + new Date(m.date).toISOString().slice(11, 16);
  console.log('  ' + d + ' | ' + m.type.padEnd(7) + ' | ' + String(m.quantite).padStart(5) + ' | user=' + (m.user || '?') + ' | ' + (m.observation || '').trim().substring(0, 50));
}

// CIMAF 23/06 - context autour ajustement +4
console.log('\n=== CIMAF 23/06 - Contexte ajustement +4 ===');
const ctx2 = db.prepare(`
  SELECT m.id, m.date, m.type, m.quantite, m.observation, u.nom as user
  FROM mouvement m LEFT JOIN utilisateur u ON m.utilisateurId = u.id
  WHERE m.id >= 6333 AND m.id <= 6343 AND m.produitId IN (SELECT id FROM produit WHERE code = 'ETB-00264')
  ORDER BY m.id ASC
`).all();
for (const m of ctx2) {
  const d = new Date(m.date).toISOString().slice(0, 10) + ' ' + new Date(m.date).toISOString().slice(11, 16);
  console.log('  ' + d + ' | ' + m.type.padEnd(7) + ' | ' + String(m.quantite).padStart(5) + ' | user=' + (m.user || '?') + ' | ' + (m.observation || '').trim().substring(0, 50));
}

// CIM IVOIRE 23/06 - contexte autour ajustement +58
console.log('\n=== CIM IVOIRE 23/06 - Contexte ajustement +58 ===');
const ctx3 = db.prepare(`
  SELECT m.id, m.date, m.type, m.quantite, m.observation, u.nom as user
  FROM mouvement m LEFT JOIN utilisateur u ON m.utilisateurId = u.id
  WHERE m.id >= 6332 AND m.id <= 6344 AND m.produitId IN (SELECT id FROM produit WHERE code = 'ETB-00152')
  ORDER BY m.id ASC
`).all();
for (const m of ctx3) {
  const d = new Date(m.date).toISOString().slice(0, 10) + ' ' + new Date(m.date).toISOString().slice(11, 16);
  console.log('  ' + d + ' | ' + m.type.padEnd(7) + ' | ' + String(m.quantite).padStart(5) + ' | user=' + (m.user || '?') + ' | ' + (m.observation || '').trim().substring(0, 50));
}

// CIM IVOIRE 17/06 - Vente V1781710288704 modifiée 2x
console.log('\n=== CIM IVOIRE V1781710288704 (17/06 2 modifs) ===');
const v2 = db.prepare('SELECT id FROM vente WHERE numero = ?').get('V1781710288704');
if (v2) {
  const archives2 = db.prepare('SELECT * FROM archiveVenteLigne WHERE venteId = ?').all(v2.id);
  console.log('Archives (anciennes valeurs):');
  if (archives2.length > 0) {
    for (const a of archives2) {
      const p = db.prepare('SELECT code, designation FROM produit WHERE id = ?').get(a.produitId);
      console.log('  prod=' + (p ? p.code + ' ' + p.designation.trim() : 'id=' + a.produitId) + ' qte=' + a.quantite + ' prix=' + a.prixUnitaire);
    }
  } else {
    console.log('  (aucune archive)');
  }
  
  const lignes2 = db.prepare("SELECT * FROM venteLigne WHERE venteId = ? AND produitId IN (SELECT id FROM produit WHERE code IN ('ETB-00152','ETB-00264'))").all(v2.id);
  console.log('Lignes CIMENT actuelles:');
  for (const l of lignes2) {
    const p = db.prepare('SELECT code, designation FROM produit WHERE id = ?').get(l.produitId);
    console.log('  ' + (p ? p.code : 'id=' + l.produitId) + ' qté=' + l.quantite + ' prix=' + l.prix);
  }
}

// ALL Modif Vente for these products between 11/06 and 26/06
console.log('\n=== Tous les Modif Vente entre 11/06 et 26/06 ===');
const modifs = db.prepare(`
  SELECT m.id, m.date, m.type, m.quantite, m.observation, u.nom as user
  FROM mouvement m
  LEFT JOIN utilisateur u ON m.utilisateurId = u.id
  WHERE m.observation LIKE 'Modif Vente%'
  AND m.produitId IN (SELECT id FROM produit WHERE code IN ('ETB-00152','ETB-00264'))
  AND m.date >= 1781136000000 AND m.date < 1781884800000
  ORDER BY m.date ASC
`).all();
console.log('Nb total Modif Vente: ' + modifs.length);
for (const m of modifs) {
  const d = new Date(m.date).toISOString().slice(0, 10) + ' ' + new Date(m.date).toISOString().slice(11, 16);
  console.log('  ' + d + ' | ' + m.type.padEnd(7) + ' | ' + String(m.quantite).padStart(5) + ' | user=' + (m.user || '?') + ' | ' + (m.observation || '').trim().substring(0, 50));
}

db.close();
