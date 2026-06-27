import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const existant = await prisma.client.findFirst({ where: { code: 'COMPTOIR' } });
if (existant) {
  console.log('Client COMPTOIR existe deja (id=' + existant.id + ')');
} else {
  const c = await prisma.client.create({
    data: {
      code: 'COMPTOIR',
      nom: 'CLIENT AU COMPTOIR',
      telephone: '',
      entiteId: 1,
      type: 'PARTICULIER',
    }
  });
  console.log('Client COMPTOIR cree (id=' + c.id + ')');
}

await prisma.$disconnect();
