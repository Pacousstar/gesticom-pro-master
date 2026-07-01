import Database from 'better-sqlite3'

const saine = new Database("C:/gesticom - BILAL1106/gesticom.db", { readonly: true })
const actuelle = new Database("C:/gesticom/gesticom.db", { readonly: true })

const codesCibles = ['ETB-00152', 'ETB-00264'] // CIM IVOIRE, CIMAF

// Trouver les IDs des produits
for (const code of codesCibles) {
  const pSaine = saine.prepare('SELECT id, designation FROM Produit WHERE code = ?').get(code)
  const pActuelle = actuelle.prepare('SELECT id, designation FROM Produit WHERE code = ?').get(code)
  console.log(`\n========== ${code} - ${pActuelle?.designation || pSaine?.designation} ==========`)

  if (!pSaine || !pActuelle) {
    console.log('Produit non trouvé dans l\'une des bases')
    continue
  }

  const produitId = pActuelle.id

  // Stock au 11/06 dans la saine
  const stockSaine = saine.prepare('SELECT quantite FROM Stock WHERE produitId = ?').get(produitId)
  const stockInitial = stockSaine?.quantite || 0

  // Récupérer TOUS les événements qui impactent le stock dans la période
  const debut = new Date('2026-06-11').getTime()
  const fin = new Date('2026-06-27').getTime()

  // Ventes (diminuent le stock)
  const ventes = actuelle.prepare(`
    SELECT v.date, vl.quantite, v.numero
    FROM VenteLigne vl
    JOIN Vente v ON v.id = vl.venteId
    WHERE vl.produitId = ? AND v.date >= ? AND v.date <= ?
    ORDER BY v.date
  `).all(produitId, debut, fin)

  // Achats (augmentent le stock)
  const achats = actuelle.prepare(`
    SELECT a.date, al.quantite, a.id as achatId
    FROM AchatLigne al
    JOIN Achat a ON a.id = al.achatId
    WHERE al.produitId = ? AND a.date >= ? AND a.date <= ?
    ORDER BY a.date
  `).all(produitId, debut, fin)

  // Mouvements directs
  const mouvs = actuelle.prepare(`
    SELECT date, type, quantite, observation
    FROM Mouvement
    WHERE produitId = ? AND date >= ? AND date <= ?
    ORDER BY date
  `).all(produitId, debut, fin)

  // Stock actuel
  const stockActuel = actuelle.prepare('SELECT quantite FROM Stock WHERE produitId = ?').get(produitId)
  
  console.log(`\nStock au 11/06 (saine): ${stockInitial}`)
  console.log(`Stock au 27/06 (actuelle): ${stockActuel?.quantite || 0}`)
  console.log(`Écart total: ${(stockActuel?.quantite || 0) - stockInitial}`)
  
  // Agrégation par jour
  const debutJour = new Date('2026-06-12')
  const finJour = new Date('2026-06-27')

  console.log(`\nDate       | Stk début | Ventes | Achats | Mvt entrée | Mvt sortie | Stk fin | Événements`)
  console.log(`-`.repeat(100))

  let stockCourant = stockInitial

  for (let d = new Date(debutJour); d <= finJour; d.setDate(d.getDate() + 1)) {
    const jour = d.toISOString().slice(0, 10)
    const debutMs = d.getTime()
    const finMs = debutMs + 86400000

    const ventesJour = ventes.filter(v => v.date >= debutMs && v.date < finMs)
    const achatsJour = achats.filter(a => a.date >= debutMs && a.date < finMs)
    const mouvsJour = mouvs.filter(m => m.date >= debutMs && m.date < finMs)
    
    const totalVentes = ventesJour.reduce((s, v) => s + v.quantite, 0)
    const totalAchats = achatsJour.reduce((s, a) => s + a.quantite, 0)
    const totalMvtE = mouvsJour.filter(m => m.type === 'ENTREE').reduce((s, m) => s + m.quantite, 0)
    const totalMvtS = mouvsJour.filter(m => m.type === 'SORTIE').reduce((s, m) => s + m.quantite, 0)
    
    const stockAvant = stockCourant
    const stockApres = stockCourant - totalVentes + totalAchats + totalMvtE - totalMvtS
    
    // Collecter les événements
    const events = []
    if (ventesJour.length > 0) {
      const total = ventesJour.reduce((s, v) => s + v.quantite, 0)
      events.push(`${ventesJour.length} vente(s) (${total} unités)`)
    }
    if (achatsJour.length > 0) {
      const total = achatsJour.reduce((s, a) => s + a.quantite, 0)
      events.push(`${achatsJour.length} achat(s) (${total} unités)`)
    }
    for (const m of mouvsJour) {
      events.push(`${m.type} ${m.quantite} (${m.observation || 'aucune obs'})`)
    }
    
    if (stockAvant !== stockApres || events.length > 0) {
      console.log(
        `${jour} | ${String(stockAvant).padStart(8)} | ${String(totalVentes).padStart(6)} | ${String(totalAchats).padStart(6)} | ${String(totalMvtE).padStart(10)} | ${String(totalMvtS).padStart(10)} | ${String(stockApres).padStart(7)} | ${events.join('; ')}`
      )
    } else {
      console.log(`${jour} | ${String(stockAvant).padStart(8)} | ${String(totalVentes).padStart(6)} | ${String(totalAchats).padStart(6)} | ${String(totalMvtE).padStart(10)} | ${String(totalMvtS).padStart(10)} | ${String(stockApres).padStart(7)} | -`)
    }
    
    stockCourant = stockApres
  }

  // Détail des événements
  console.log(`\n--- DÉTAIL DES VENTES ---`)
  for (const v of ventes) {
    console.log(`  ${new Date(v.date).toISOString().slice(0, 16)} | vente ${v.numero} | -${v.quantite}`)
  }
  
  console.log(`\n--- DÉTAIL DES ACHATS ---`)
  for (const a of achats) {
    console.log(`  ${new Date(a.date).toISOString().slice(0, 16)} | achat #${a.achatId} | +${a.quantite}`)
  }
  
  console.log(`\n--- DÉTAIL DES MOUVEMENTS ---`)
  for (const m of mouvs) {
    console.log(`  ${new Date(m.date).toISOString().slice(0, 16)} | ${m.type} ${m.quantite > 0 ? '+' : ''}${m.quantite} | ${m.observation || '-'}`)
  }
}

saine.close()
actuelle.close()
