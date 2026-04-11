const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWrite() {
  console.log('--- TEST D ÉCRITURE PRISMA ---');
  try {
    const testLog = await prisma.auditLog.create({
      data: {
        action: 'TEST_WRITE',
        type: 'DIAGNOSTIC',
        description: 'Test d écriture systeme lors du diagnostic',
        utilisateurId: 1 // On assume que l admin ID=1 existe
      }
    });
    console.log('[OK] Écriture réussie dans AuditLog, ID:', testLog.id);
    
    // On le supprime pour ne pas polluer
    await prisma.auditLog.delete({ where: { id: testLog.id } });
    console.log('[OK] Suppression réussie.');
  } catch (err) {
    console.error('[ERR] ÉCHEC ÉCRITURE :', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testWrite();
