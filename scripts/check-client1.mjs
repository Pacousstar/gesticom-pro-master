import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const c1 = await prisma.client.findUnique({ where: { id: 1 } });
console.log('Client ID 1:', JSON.stringify(c1));
await prisma.$disconnect();
