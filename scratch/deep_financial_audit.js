const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function deepAudit() {
  console.log('--- 🛡️ AUDIT PROFOND GESTICOM PRO ---')

  // --- 1. VALORISATION DES STOCKS ---
  console.log('\n[1] VALORISATION DES STOCKS (TRANSVERSALE)')
  
  // A. Via Table Produits (PAMP * Somme Stock)
  const produits = await prisma.produit.findMany({ include: { stocks: true } })
  let valProduits = 0
  produits.forEach(p => {
    const qteTotale = p.stocks.reduce((acc, s) => acc + s.quantite, 0)
    valProduits += qteTotale * (p.pamp || p.prixAchat || 0)
  })

  // B. Via Table Stocks (Ligne par Ligne)
  const stocks = await prisma.stock.findMany({ include: { produit: true } })
  let valStocks = 0
  stocks.forEach(s => {
    valStocks += s.quantite * (s.produit.pamp || s.produit.prixAchat || 0)
  })

  // C. Via Mouvements (Calcul Reconstitué)
  const mvts = await prisma.mouvement.findMany({ include: { produit: true } })
  let valMvts = 0 // On calcule la valeur des entrées - sorties
  mvts.forEach(m => {
    const prix = m.produit.pamp || m.produit.prixAchat || 0
    if (m.type === 'ENTREE') valMvts += m.quantite * prix
    else if (m.type === 'SORTIE') valMvts -= m.quantite * prix
  })

  console.log(`- Valeur via Produits (PAMP * Qte) : ${Math.round(valProduits).toLocaleString()} F`)
  console.log(`- Valeur via Stocks (Détail)      : ${Math.round(valStocks).toLocaleString()} F`)
  console.log(`- Valeur via Flux Mouvements      : ${Math.round(valMvts).toLocaleString()} F`)

  // --- 2. AUDIT DES COMPTEURS & SOLDES NÉGATIFS ---
  console.log('\n[2] AUDIT DES SOLDES NÉGATIFS')

  // Stocks Négatifs
  const stocksNeg = stocks.filter(s => s.quantite < 0)
  console.log(`- Stocks Négatifs détectés      : ${stocksNeg.length}`)
  stocksNeg.slice(0, 5).forEach(s => console.log(`  ! ${s.produit.designation} (${s.magasinId}) : ${s.quantite}`))

  // Soldes Comptes Négatifs (Incohérent pour certains types)
  const comptes = await prisma.planCompte.findMany({ include: { ecritures: true } })
  console.log('- Anomalies de Trésorerie (Caisse/Banque < 0) :')
  comptes.forEach(c => {
    const totalDebit = c.ecritures.reduce((s, e) => s + e.debit, 0)
    const totalCredit = c.ecritures.reduce((s, e) => s + e.credit, 0)
    const solde = totalDebit - totalCredit
    
    // Une caisse (classe 5) ne devrait théoriquement pas être créditrice (solde < 0)
    if (c.numero.startsWith('5') && solde < -1) {
       console.log(`  ? ${c.numero} - ${c.libelle} : ${Math.round(solde).toLocaleString()} F`)
    }
  })

  // Soldes Clients Négatifs (Avoirs non consommés)
  const clients = await prisma.client.findMany({ 
    include: { ventes: true, reglements: true } 
  })
  let clientsAvoir = 0
  clients.forEach(cl => {
     const totalDu = cl.ventes.reduce((s, v) => s + v.montantTotal, 0)
     const totalPaye = cl.reglements.reduce((s, r) => s + r.montant, 0)
     const solde = totalDu - (totalPaye + cl.soldeInitial) // Simplifié
     if (solde < -1) clientsAvoir++
  })
  console.log(`- Clients avec Solde Créditeur (Avoirs) : ${clientsAvoir}`)

}

deepAudit()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
