import Database from 'better-sqlite3'

const DB_SAINE = "C:/gesticom - BILAL1106/gesticom.db"
const DB_ACTUELLE = "C:/gesticom/gesticom.db"

function openDB(path) {
  const db = new Database(path, { readonly: true })
  db.pragma('journal_mode = WAL')
  return db
}

function query(db, sql, params = []) {
  return db.prepare(sql).all(...params)
}

function getProduits(db) {
  return query(db, `
    SELECT p.id, p.code, p.designation, p.categorie, p.entiteId
    FROM Produit p
    WHERE p.actif = 1
    ORDER BY p.id
  `)
}

function getStocks(db) {
  return query(db, `
    SELECT s.produitId, s.magasinId, s.quantite, s.quantiteInitiale,
           m.nom as magasin, p.code, p.designation, p.categorie
    FROM Stock s
    JOIN Produit p ON p.id = s.produitId
    JOIN Magasin m ON m.id = s.magasinId
    ORDER BY p.id, m.id
  `)
}

function getMouvements(db, depuis, jusqua) {
  return query(db, `
    SELECT m.id, m.date, m.type, m.produitId, m.magasinId, m.quantite,
           m.observation, m.utilisateurId,
           p.code, p.designation
    FROM Mouvement m
    JOIN Produit p ON p.id = m.produitId
    WHERE date(m.date) >= date(?) AND date(m.date) <= date(?)
    ORDER BY m.date
  `, [depuis, jusqua])
}

function getVentesLignes(db, depuis, jusqua) {
  return query(db, `
    SELECT vl.id, vl.produitId, vl.quantite,
           v.id as venteId, v.date as venteDate, v.estVenteRapide,
           p.code, p.designation
    FROM VenteLigne vl
    JOIN Vente v ON v.id = vl.venteId
    JOIN Produit p ON p.id = vl.produitId
    WHERE date(v.date) >= date(?) AND date(v.date) <= date(?)
    ORDER BY v.date
  `, [depuis, jusqua])
}

function getAchatsLignes(db, depuis, jusqua) {
  return query(db, `
    SELECT al.id, al.produitId, al.quantite,
           a.id as achatId, a.date as achatDate,
           p.code, p.designation
    FROM AchatLigne al
    JOIN Achat a ON a.id = al.achatId
    JOIN Produit p ON p.id = al.produitId
    WHERE date(a.date) >= date(?) AND date(a.date) <= date(?)
    ORDER BY a.date
  `, [depuis, jusqua])
}

function getRetoursLignes(db, depuis, jusqua) {
  return query(db, `
    SELECT rl.id, rl.produitId, rl.quantite,
           r.id as retourId, r.date as retourDate,
           p.code, p.designation
    FROM RetourLigne rl
    JOIN Retour r ON r.id = rl.retourId
    JOIN Produit p ON p.id = rl.produitId
    WHERE date(r.date) >= date(?) AND date(r.date) <= date(?)
    ORDER BY r.date
  `, [depuis, jusqua])
}

function getRetraitsLignes(db, depuis, jusqua) {
  return query(db, `
    SELECT rl.id, rl.produitId, rl.quantite,
           rp.id as retraitId, rp.date as retraitDate,
           p.code, p.designation
    FROM RetraitPartielLigne rl
    JOIN RetraitPartiel rp ON rp.id = rl.retraitPartielId
    JOIN Produit p ON p.id = rl.produitId
    WHERE date(rp.date) >= date(?) AND date(rp.date) <= date(?)
    ORDER BY rp.date
  `, [depuis, jusqua])
}

const saine = openDB(DB_SAINE)
const actuelle = openDB(DB_ACTUELLE)

console.log('=== COMPARAISON DES STOCKS ===')
console.log(`Saine  (11/06): ${DB_SAINE}`)
console.log(`Actuelle       : ${DB_ACTUELLE}`)
console.log('')

// 1. Produits
const prodsSaine = getProduits(saine)
const prodsActuelle = getProduits(actuelle)
console.log(`Produits actifs: ${prodsSaine.length} (saine) vs ${prodsActuelle.length} (actuelle)`)

// 2. Stocks
const stocksSaine = getStocks(saine)
const stocksActuelle = getStocks(actuelle)

const mapKey = s => `${s.produitId}|${s.magasinId}`
const saineMap = Object.fromEntries(stocksSaine.map(s => [mapKey(s), s]))
const actuelleMap = Object.fromEntries(stocksActuelle.map(s => [mapKey(s), s]))

const allKeys = new Set([...Object.keys(saineMap), ...Object.keys(actuelleMap)])

console.log(`\n=== ÉCARTS DE STOCK ===`)
const ecarts = []
for (const key of allKeys) {
  const s = saineMap[key]
  const a = actuelleMap[key]
  const qSaine = s?.quantite || 0
  const qActuelle = a?.quantite || 0
  const diff = qActuelle - qSaine

  if (diff !== 0) {
    ecarts.push({
      produitId: parseInt(key.split('|')[0]),
      magasinId: parseInt(key.split('|')[1]),
      code: s?.code || a?.code,
      designation: s?.designation || a?.designation,
      categorie: s?.categorie || a?.categorie,
      magasin: s?.magasin || a?.magasin,
      qSaine,
      qActuelle,
      diff
    })
  }
}

ecarts.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
console.log(`Produits avec écart: ${ecarts.length}`)
console.log('')
for (const e of ecarts) {
  console.log(`${e.code} | ${e.designation.padEnd(35)} | ${e.magasin.padEnd(12)} | Saine: ${String(e.qSaine).padStart(6)} | Actuelle: ${String(e.qActuelle).padStart(6)} | Écart: ${e.diff > 0 ? '+' : ''}${e.diff}`)
}

// 3. Mouvements du 11/06 à aujourd'hui
console.log('\n=== MOUVEMENTS DU 11/06 AU 27/06 ===')
const mouvs = getMouvements(actuelle, '2026-06-11', '2026-06-27')
console.log(`Total mouvements: ${mouvs.length}`)
console.log('')
const mouvsParJour = {}
for (const m of mouvs) {
  const jour = m.date.split('T')[0]
  if (!mouvsParJour[jour]) mouvsParJour[jour] = { entree: 0, sortie: 0, correction: 0, total: 0 }
  mouvsParJour[jour].total++
  if (m.type === 'ENTREE') mouvsParJour[jour].entree++
  else if (m.type === 'SORTIE') mouvsParJour[jour].sortie++
  else mouvsParJour[jour].correction++
}
for (const [jour, stats] of Object.entries(mouvsParJour).sort()) {
  console.log(`${jour}: ${stats.total} mouvs (E:${stats.entree} S:${stats.sortie} C:${stats.correction})`)
}

// 4. Mouvements avec observation suspecte
console.log('\n=== MOUVEMENTS SUSPECTS (observation contenant "correction" ou "manuel") ===')
const suspects = mouvs.filter(m => {
  const obs = (m.observation || '').toLowerCase()
  return obs.includes('correction') || obs.includes('manuel') || obs.includes('force') || obs.includes('maj') || obs.includes('update')
})
for (const m of suspects) {
  console.log(`${m.date} | ${m.type} | ${m.code} ${m.designation} | qte:${m.quantite} | obs:${m.observation || '-'} | user:${m.utilisateurId}`)
}

// 5. Ventes du 11/06 au 27/06
console.log('\n=== VENTES LIGNES DU 11/06 AU 27/06 ===')
const ventes = getVentesLignes(actuelle, '2026-06-11', '2026-06-27')
console.log(`Total lignes de vente: ${ventes.length}`)
const ventesParJour = {}
for (const v of ventes) {
  const jour = v.venteDate.split('T')[0]
  if (!ventesParJour[jour]) ventesParJour[jour] = 0
  ventesParJour[jour]++
}
for (const [jour, count] of Object.entries(ventesParJour).sort()) {
  console.log(`${jour}: ${count} lignes`)
}

// 6. Achats du 11/06 au 27/06
console.log('\n=== ACHATS LIGNES DU 11/06 AU 27/06 ===')
const achats = getAchatsLignes(actuelle, '2026-06-11', '2026-06-27')
console.log(`Total lignes d'achat: ${achats.length}`)

// 7. Retours
console.log('\n=== RETOURS LIGNES DU 11/06 AU 27/06 ===')
const retours = getRetoursLignes(actuelle, '2026-06-11', '2026-06-27')
console.log(`Total lignes de retour: ${retours.length}`)

// 8. Retraits
console.log('\n=== RETRAITS PARTIELS DU 11/06 AU 27/06 ===')
const retraits = getRetraitsLignes(actuelle, '2026-06-11', '2026-06-27')
console.log(`Total lignes de retrait: ${retraits.length}`)

saine.close()
actuelle.close()
