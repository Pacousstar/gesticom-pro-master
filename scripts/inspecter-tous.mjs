import Database from 'better-sqlite3';

const f = new Database("F:/gesticom/gesticom.db", { readonly: true });
const b = new Database("C:/gesticom - BILAL1106/gesticom.db", { readonly: true });
const seuil11 = new Date("2026-06-11").getTime();

// Get all products
const prods = {};
for (const r of b.prepare("SELECT id, code, designation FROM produit").all()) {
  prods[r.id] = r;
}

// For each product, compare movements before 11/06
console.log("=== COMPARAISON BACKUP vs F: (mouvements avant 11/06) ===\n");
console.log("Recherche des mouvements SUPPRIMÉS dans F: par produit...\n");

let totalProduitsAvecEcart = 0;
let totalSupprime = 0;
const details = [];

for (const [pid, prod] of Object.entries(prods)) {
  const id = parseInt(pid);
  
  // Get all movements BEFORE 11/06 from both databases
  const mvtsB = b.prepare("SELECT date, type, quantite, observation FROM mouvement WHERE produitId=? AND entiteId=1 AND date<? ORDER BY id").all(id, seuil11);
  const mvtsF = f.prepare("SELECT date, type, quantite, observation FROM mouvement WHERE produitId=? AND entiteId=1 AND date<? ORDER BY id").all(id, seuil11);
  
  // Build maps
  const mapB = new Map();
  for (const m of mvtsB) {
    const key = m.date + "|" + m.type + "|" + m.quantite + "|" + (m.observation || "");
    mapB.set(key, (mapB.get(key) || 0) + 1);
  }
  const mapF = new Map();
  for (const m of mvtsF) {
    const key = m.date + "|" + m.type + "|" + m.quantite + "|" + (m.observation || "");
    mapF.set(key, (mapF.get(key) || 0) + 1);
  }
  
  // Find what's missing in F:
  let qteSupprimee = 0;
  let nbSupprime = 0;
  let items = [];
  for (const [key, bCount] of mapB) {
    const fCount = mapF.get(key) || 0;
    if (bCount > fCount) {
      const diff = bCount - fCount;
      const [dateMs, type, qte, obs] = key.split("|");
      const date = new Date(parseInt(dateMs)).toISOString().slice(0, 10);
      const qteNum = parseFloat(qte);
      const impact = type === "ENTREE" ? qteNum * diff : -qteNum * diff;
      qteSupprimee += impact;
      nbSupprime += diff;
      items.push({ date, type, qte: qteNum, obs: (obs || "").trim(), nb: diff, impact });
    }
  }
  
  // Find what's added in F: (mouvements ajoutés)
  let qteAjoutee = 0;
  let nbAjoute = 0;
  for (const [key, fCount] of mapF) {
    const bCount = mapB.get(key) || 0;
    if (fCount > bCount) {
      const diff = fCount - bCount;
      const [dateMs, type, qte, obs] = key.split("|");
      const qteNum = parseFloat(qte);
      // Just count but don't detail every added item
      const impact = type === "ENTREE" ? qteNum * diff : -qteNum * diff;
      qteAjoutee += impact;
      nbAjoute += diff;
    }
  }
  
  if (nbSupprime > 0 || nbAjoute > 0) {
    const stockB = b.prepare("SELECT quantite FROM stock WHERE produitId=? AND magasinId=1 AND entiteId=1").get(id);
    const stockF = f.prepare("SELECT quantite FROM stock WHERE produitId=? AND magasinId=1 AND entiteId=1").get(id);
    const sB = stockB ? stockB.quantite : 0;
    const sF = stockF ? stockF.quantite : 0;
    
    totalProduitsAvecEcart++;
    totalSupprime += qteSupprimee;
    
    console.log(prod.code.padEnd(14) + (prod.designation || "").trim().substring(0, 32));
    console.log("  Stock backup: " + sB + " -> F: " + sF);
    console.log("  Mouvements supprimés: " + nbSupprime + " (impact stock: " + qteSupprimee + ")");
    console.log("  Mouvements ajoutés:   " + nbAjoute + " (impact stock: " + qteAjoutee + ")");
    
    for (const item of items.slice(0, 5)) {
      const signe = item.impact > 0 ? "+" : "";
      console.log("    " + item.date + " | " + item.type + " " + item.qte + " | impact " + signe + item.impact + " | " + item.obs.substring(0, 50));
    }
    if (items.length > 5) {
      console.log("    ... et " + (items.length - 5) + " autres");
    }
    console.log("");
  }
}

console.log("\n=== RÉSUMÉ ===");
console.log("Produits avec écart: " + totalProduitsAvecEcart);
console.log("Impact total stock (suppressions): " + totalSupprime);

f.close();
b.close();
