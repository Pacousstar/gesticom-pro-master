const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
(async () => {
  try {
    const users = await p.utilisateur.findMany({ select: { id: true, login: true, nom: true, role: true, motDePasse: true, actif: true } });
    console.log(JSON.stringify(users, null, 2));
    for (const u of users) {
      if (u.login === 'admin') {
        const isBcrypt = u.motDePasse.startsWith('$2');
        console.log(`\nAdmin user found: id=${u.id}, active=${u.actif}`);
        console.log(`Password starts with bcrypt hash prefix: ${isBcrypt}`);
        if (isBcrypt) {
          const match = await bcrypt.compare('Admin@123', u.motDePasse);
          console.log(`Password 'Admin@123' matches: ${match}`);
        } else {
          console.log(`Stored password (plaintext?): ${u.motDePasse}`);
        }
      }
    }
    await p.$disconnect();
  } catch (e) {
    console.error(e.message);
    await p.$disconnect();
  }
})();
