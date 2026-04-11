import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const login = process.argv[2] || 'admin'
  console.log(`🚀 RÉPARATION DES ACCÈS POUR L'UTILISATEUR : ${login}...`)

  try {
    // 1. Trouver l'utilisateur
    const user = await prisma.utilisateur.findUnique({ where: { login } })

    if (!user) {
      console.error(`❌ Erreur : Utilisateur "${login}" introuvable.`)
      process.exit(1)
    }

    // 2. Promotion forcée en SUPER_ADMIN
    await prisma.utilisateur.update({
      where: { id: user.id },
      data: { role: 'SUPER_ADMIN' }
    })
    console.log(`✅ Rôle SUPER_ADMIN activé pour ${login}.`)

    // 3. Liaison forcée à l'entité 1 si nécessaire
    const firstEntite = await prisma.entite.findFirst({ orderBy: { id: 'asc' } })
    if (firstEntite && !user.entiteId) {
        await prisma.utilisateur.update({
            where: { id: user.id },
            data: { entiteId: firstEntite.id }
        })
        console.log(`✅ Utilisateur rattaché à l'entité : ${firstEntite.nom}.`)
    }

    // 4. Réparation de la visibilité des données (si migration Master)
    if (firstEntite) {
        console.log(`📦 Réparation de la visibilité des transactions...`)
        const eid = firstEntite.id
        await Promise.all([
          prisma.depense.updateMany({ where: { entiteId: 0 }, data: { entiteId: eid } }),
          prisma.vente.updateMany({ where: { entiteId: 0 }, data: { entiteId: eid } }),
          prisma.achat.updateMany({ where: { entiteId: 0 }, data: { entiteId: eid } }),
          prisma.client.updateMany({ where: { entiteId: 0 }, data: { entiteId: eid } }),
          prisma.fournisseur.updateMany({ where: { entiteId: 0 }, data: { entiteId: eid } }),
        ])
    }

    console.log('✨ RÉPARATION RÉUSSIE. Les menus devraient apparaître après reconnexion.')
  } catch (error) {
    console.error('❌ ERREUR DURANT LA RÉPARATION :', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
