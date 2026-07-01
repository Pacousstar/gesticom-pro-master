import Database from 'better-sqlite3'
const saine = new Database("C:/gesticom - BILAL1106/gesticom.db", { readonly: true })
const actuelle = new Database("C:/gesticom/gesticom.db", { readonly: true })

const debut = new Date('2026-06-11').getTime()
const fin = new Date('2026-06-27').getTime()

function d(ts) { return new Date(ts).toISOString().slice(0, 10) }
function q(db, sql, params) { return db.prepare(sql).all(...(params || [])) }

// Overview
console.log('=== ACTIVITÉ DU 11/06 AU 27/06 ===')
console.log('Ventes créées :', actuelle.prepare('SELECT COUNT(*) as c FROM Vente WHERE date >= ? AND date <= ?').get(debut, fin).c)
console.log('Mouvements    :', actuelle.prepare('SELECT COUNT(*) as c FROM Mouvement WHERE date >= ? AND date <= ?').get(debut, fin).c)
console.log('Achats        :', actuelle.prepare('SELECT COUNT(*) as c FROM Achat WHERE date >= ? AND date <= ?').get(debut, fin).c)

// Mouvements par jour
console.log('\n=== MOUVEMENTS PAR JOUR ===')
const mouvsParJour = q(actuelle,
  "SELECT date/1000/86400/1 as jour, type, COUNT(*) as cnt FROM Mouvement WHERE date >= ? AND date <= ? AND date > 0 GROUP BY jour, type ORDER BY jour",
  [debut, fin])
const jours = {}
for (const m of mouvsParJour) {
  const j = new Date(m.jour * 86400 * 1000).toISOString().slice(0, 10)
  if (!jours[j]) jours[j] = {}
  jours[j][m.type] = (jours[j][m.type] || 0) + m.cnt
  jours[j].total = (jours[j].total || 0) + m.cnt
}
for (const [jour, stats] of Object.entries(jours).sort()) {
  console.log(`${jour}: ${stats.total} mouvs (E:${stats.ENTREE||0} S:${stats.SORTIE||0})`)
}

// Ventilation des écarts par catégorie
console.log('\n=== TOP 20 ÉCARTS NÉGATIFS (stock a diminué) ===')
const ecartsNeg = []
const stocksSaine = q(saine, `
  SELECT s.produitId, s.quantite as qSaine, s.magasinId, p.code, p.designation, p.categorie
  FROM Stock s JOIN Produit p ON p.id = s.produitId
`)
const stocksActuelle = q(actuelle, `
  SELECT s.produitId, s.quantite as qActuelle, s.magasinId, p.code, p.designation, p.categorie
  FROM Stock s JOIN Produit p ON p.id = s.produitId
`)

const mapSaine = {}
for (const s of stocksSaine) mapSaine[`${s.produitId}|${s.magasinId}`] = s
const mapActuelle = {}
for (const a of stocksActuelle) mapActuelle[`${a.produitId}|${a.magasinId}`] = a

const allKeys = new Set([...Object.keys(mapSaine), ...Object.keys(mapActuelle)])
for (const key of allKeys) {
  const s = mapSaine[key]
  const a = mapActuelle[key]
  const qS = s?.qSaine || 0, qA = a?.qActuelle || 0
  const diff = qA - qS
  if (diff !== 0) {
    ecartsNeg.push({ code: s?.code || a?.code, des: s?.designation || a?.designation, cat: s?.categorie || a?.categorie, qS, qA, diff })
  }
}
ecartsNeg.sort((a, b) => a.diff - b.diff)
for (const e of ecartsNeg.slice(0, 20)) {
  console.log(`${e.code} | ${e.des.padEnd(35)} | ${e.cat.padEnd(15)} | ${e.qS} → ${e.qA} (${e.diff})`)
}

// Ventes - top consommateurs de stock
console.log('\n=== TOP 20 PRODUITS VENDUS (du 11/06 au 27/06) ===')
const topVendus = q(actuelle, `
  SELECT p.code, p.designation, SUM(vl.quantite) as totalVendu
  FROM VenteLigne vl
  JOIN Vente v ON v.id = vl.venteId
  JOIN Produit p ON p.id = vl.produitId
  WHERE v.date >= ? AND v.date <= ?
  GROUP BY vl.produitId
  ORDER BY totalVendu DESC
  LIMIT 20
`, [debut, fin])
for (const v of topVendus) {
  console.log(`${v.code} | ${v.designation.padEnd(35)} | vendu: ${v.totalVendu}`)
}

// Achats - top approvisionnements
console.log('\n=== TOP 20 PRODUITS ACHETÉS (du 11/06 au 27/06) ===')
const topAchetes = q(actuelle, `
  SELECT p.code, p.designation, SUM(al.quantite) as totalAchete
  FROM AchatLigne al
  JOIN Achat a ON a.id = al.achatId
  JOIN Produit p ON p.id = al.produitId
  WHERE a.date >= ? AND a.date <= ?
  GROUP BY al.produitId
  ORDER BY totalAchete DESC
  LIMIT 20
`, [debut, fin])
for (const a of topAchetes) {
  console.log(`${a.code} | ${a.designation.padEnd(35)} | acheté: ${a.totalAchete}`)
}

// Produits avec stock negatif
console.log('\n=== PRODUITS AVEC STOCK NÉGATIF ===')
const stocksNeg = q(actuelle, `
  SELECT p.code, p.designation, s.quantite
  FROM Stock s JOIN Produit p ON p.id = s.produitId
  WHERE s.quantite < 0
`)
for (const s of stocksNeg) {
  console.log(`${s.code} | ${s.designation} | stock: ${s.quantite}`)
}

saine.close()
actuelle.close()
