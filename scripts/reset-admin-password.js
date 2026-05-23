const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🔐 Réinitialisation du mot de passe administrateur...')

  // Trouver ou créer l'admin
  let admin = await prisma.utilisateur.findFirst({
    where: { role: 'SUPER_ADMIN' }
  })

  if (admin) {
    const hashedPassword = await bcrypt.hash('Admin@123', 10)
    admin = await prisma.utilisateur.update({
      where: { id: admin.id },
      data: {
        motDePasse: hashedPassword,
        login: 'admin'
      }
    })
    console.log(`✅ Admin mis à jour: ${admin.login}`)
  } else {
    const hashedPassword = await bcrypt.hash('Admin@123', 10)
    admin = await prisma.utilisateur.create({
      data: {
        nom: 'Administrateur',
        login: 'admin',
        motDePasse: hashedPassword,
        role: 'SUPER_ADMIN',
        actif: true,
        entiteId: 1
      }
    })
    console.log(`✅ Admin créé: ${admin.login}`)
  }

  console.log('\n📝 Identifiants de connexion:')
  console.log('   Login: admin')
  console.log('   Mot de passe: Admin@123')
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())