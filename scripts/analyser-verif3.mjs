import Database from 'better-sqlite3'
const saine = new Database("C:/gesticom - BILAL1106/gesticom.db", { readonly: true })
const actuelle = new Database("C:/gesticom/gesticom.db", { readonly: true })

const debut = new Date('2026-06-11').getTime()
const fin = new Date('2026-06-27').getTime()

const sMap = {}
for (const r of saine.prepare('SELECT produitId, quantite FROM Stock').all()) {
  sMap[r.produitId] = r.quantite
}
const aMap = {}
for (const r of actuelle.prepare('SELECT produitId, quantite FROM Stock').all()) {
  aMap[r.produitId] = r.quantite
}

// Transactions: achats augmentent le stock, ventes le diminuent
const venduMap = {}
for (const r of actuelle.prepare(
  'SELECT vl.produitId, SUM(vl.quantite) as total FROM VenteLigne vl JOIN Vente v ON v.id=vl.venteId WHERE v.date>=? AND v.date<=? GROUP BY vl.produitId'
).all(debut, fin)) {
  venduMap[r.produitId] = r.total
}

const achatMap = {}
for (const r of actuelle.prepare(
  'SELECT al.produitId, SUM(al.quantite) as total FROM AchatLigne al JOIN Achat a ON a.id=al.achatId WHERE a.date>=? AND a.date<=? GROUP BY al.produitId'
).all(debut, fin)) {
  achatMap[r.produitId] = r.total
}

// Mouvements par produit
const mouvMap = {}
for (const r of actuelle.prepare(
  "SELECT produitId, SUM(CASE WHEN type='ENTREE' THEN quantite ELSE 0 END) as e, SUM(CASE WHEN type='SORTIE' THEN quantite ELSE 0 END) as s FROM Mouvement WHERE date>=? AND date<=? GROUP BY produitId"
).all(debut, fin)) {
  mouvMap[r.produitId] = { e: r.e || 0, s: r.s || 0 }
}

const prodMap = {}
for (const r of actuelle.prepare('SELECT id, code, designation FROM Produit').all()) {
  prodMap[r.id] = r
}

console.log('=== VÉRIFICATION: 3 FORMULES ===')
console.log('')
console.log('F1 = achats - ventes (via VenteLigne/AchatLigne)')
console.log('F2 = entrées - sorties (via Mouvement)')
console.log('F3 = stock_actuel - stock_saine (écart réel)')
console.log('Si F1 ≈ F2 ≈ F3 → tout va bien')
console.log('Si F3 - F1 ≠ 0 → stock modifié sans transaction')

const allIds = new Set([...Object.keys(sMap), ...Object.keys(aMap)])
const anomalies = []

for (const pid of allIds) {
  const id = parseInt(pid)
  const qS = sMap[id] || 0, qA = aMap[id] || 0
  const diff = qA - qS
  if (diff === 0) continue
  
  const v = venduMap[id] || 0
  const a = achatMap[id] || 0
  const m = mouvMap[id] || { e: 0, s: 0 }
  
  const f1 = a - v
  const f2 = m.e - m.s
  const residu1 = diff - f1  // écart non expliqué par les transactions
  const residu2 = diff - f2  // écart non expliqué par les mouvements
  
  if (Math.abs(residu1) > 1 || Math.abs(residu2) > 1 || Math.abs(f1 - f2) > 1) {
    anomalies.push({ id, qS, qA, diff, v, a, m, f1, f2, r1: residu1, r2: residu2 })
  }
}

anomalies.sort((a, b) => Math.abs(b.r1) - Math.abs(a.r1))

console.log(`\nTotal produits avec écart: ${allIds.size}`)
console.log(`Anomalies: ${anomalies.length}`)
console.log('')

if (anomalies.length > 0) {
  console.log('CODE          DESIGNATION                    stock_saine->actuelle  F1(ach-ven)  F2(ent-sor)  RÉSIDU_F1  RÉSIDU_F2')
  console.log('')
  for (const a of anomalies.slice(0, 40)) {
    const p = prodMap[a.id] || { code: '?', designation: '?' }
    console.log(
      `${(p.code||'').padEnd(14)} ${(p.designation||'').padEnd(32)} ` +
      `${a.qS}->${a.qA}(${a.diff>0?'+':''}${a.diff})`.padEnd(22) +
      `${a.f1}`.padEnd(12) +
      `${a.f2}`.padEnd(12) +
      `${a.r1>0?'+':''}${a.r1}`.padEnd(11) +
      `${a.r2>0?'+':''}${a.r2}`
    )
  }
  
  // Résumé par type d'écart
  console.log('\n=== ANALYSE RÉSIDUS F1 (achats - ventes) ===')
  const r1s = anomalies.map(a => Math.abs(a.r1))
  r1s.sort((a, b) => b - a)
  console.log(`Produits avec écart non expliqué: ${anomalies.length}`)
  console.log(`Résidu F1 max: ${r1s[0]}`)
  console.log(`Total résidus F1: ${r1s.reduce((a,b)=>a+b,0)}`)
  console.log(`Moyenne résidus F1: ${(r1s.reduce((a,b)=>a+b,0)/r1s.length).toFixed(1)}`)
  
  // Distribution
  const buckets = { '<=1': 0, '2-10': 0, '11-100': 0, '101-500': 0, '501-1000': 0, '>1000': 0 }
  for (const r of r1s) {
    if (r <= 1) buckets['<=1']++
    else if (r <= 10) buckets['2-10']++
    else if (r <= 100) buckets['11-100']++
    else if (r <= 500) buckets['101-500']++
    else if (r <= 1000) buckets['501-1000']++
    else buckets['>1000']++
  }
  console.log('Distribution résidus:', buckets)
}

saine.close()
actuelle.close()
