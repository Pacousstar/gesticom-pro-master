import Database from 'better-sqlite3';
import fs from 'fs';

const bu = new Database('C:/gesticom1206/gesticom.db');
const stat = fs.statSync('C:/gesticom1206/gesticom.db');
console.log('Fichier: C:\\gesticom1206\\gesticom.db');
console.log('Taille:', (stat.size / 1024).toFixed(0), 'KB');
console.log('Date:', stat.mtime.toISOString());

const tables = bu.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('\nTables:', tables.map(t => t.name).join(', '));

const countProduits = bu.prepare('SELECT COUNT(*) as c FROM Produit').get();
const countStocks = bu.prepare('SELECT COUNT(*) as c FROM Stock').get();
const countVentes = bu.prepare('SELECT COUNT(*) as c FROM Vente').get();
const countMouvs = bu.prepare('SELECT COUNT(*) as c FROM Mouvement').get();
console.log('Produits:', countProduits.c);
console.log('Stocks:', countStocks.c);
console.log('Ventes:', countVentes.c);
console.log('Mouvements:', countMouvs.c);

for (const code of ['ETB-00152', 'ETB-00264', 'VERN-218', 'FER-060', 'DIVE-018']) {
  const p = bu.prepare('SELECT id, code, designation FROM Produit WHERE code = ?').get(code);
  if (p) {
    const s = bu.prepare('SELECT quantite FROM Stock WHERE produitId = ? AND magasinId = 1 AND entiteId = 1').get(p.id);
    console.log('\n' + code + ' ' + (p.designation||'').trim() + ': stock=' + (s?.quantite ?? 'N/A'));
  } else {
    console.log('\n' + code + ': introuvable');
  }
}

const maxId = bu.prepare('SELECT MAX(id) as maxId FROM Mouvement').get();
console.log('\nMax mouvement ID:', maxId.maxId);

const maxVenteId = bu.prepare('SELECT MAX(id) as maxId FROM Vente').get();
console.log('Max vente ID:', maxVenteId.maxId);

const derniereVente = bu.prepare('SELECT numero, date FROM Vente ORDER BY id DESC LIMIT 1').get();
console.log('Derniere vente:', derniereVente?.numero, derniereVente?.date);

// Nombre de ventes V1782 (postérieures à notre code) dans le backup
const countV1782 = bu.prepare("SELECT COUNT(*) as c FROM Vente WHERE numero LIKE 'V1782%'").get();
console.log('Ventes V1782 dans backup:', countV1782.c);

bu.close();
