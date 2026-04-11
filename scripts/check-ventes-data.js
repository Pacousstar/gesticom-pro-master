const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkVentesData() {
  console.log('🧐 ANALYSE PROFONDE DES VENTES EN BASE DE DONNÉES...')
  
  try {
    const total = await prisma.vente.count()
    console.log(`-----------------------------------------------`)
    console.log(`🔢 NOMBRE TOTAL DE VENTES : ${total}`)
    console.log(`-----------------------------------------------`)
    
    if (total > 0) {
      const first = await prisma.vente.findFirst({ orderBy: { date: 'asc' }, include: { entite: { select: { nom: true } } } })
      const last = await prisma.vente.findFirst({ orderBy: { date: 'desc' } })
      const sansEntite = await prisma.vente.count({ where: { entiteId: null } })
      
      console.log(`📅 Date de la plus ancienne vente : ${first.date}`)
      console.log(`📅 Date de la plus récente vente  : ${last.date}`)
      console.log(`🏢 Entité associée (ID)           : ${first.entiteId} (${first.entite?.nom || 'Inconnue'})`)
      console.log(`🚦 Statut actuel                  : ${first.statut}`)
      console.log(`❓ Ventes sans entité (orphelines) : ${sansEntite}`)
      console.log(`-----------------------------------------------`)
      console.log(`💡 CONSEIL : Si l'écran est vide, réglez le filtre `)
      console.log(`   de date du logiciel sur l'année ${new Date(first.date).getFullYear()}.`)
    } else {
      console.log('❌ ALERTE : La table des ventes est COMPLÈTEMENT VIDE.')
      console.log('   Vérifiez que vous utilisez le bon fichier .db')
    }
  } catch (err) {
    console.error('❌ ERREUR DE LECTURE :', err)
  } finally {
    await prisma.$disconnect()
  }
}

checkVentesData()
