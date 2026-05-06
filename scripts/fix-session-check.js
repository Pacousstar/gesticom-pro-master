const fs = require('fs');
const path = require('path');

const files = [
  'app/api/achats/[id]/route.ts',
  'app/api/banques/route.ts',
  'app/api/clients/[id]/route.ts',
  'app/api/depenses/[id]/route.ts',
  'app/api/depenses/route.ts',
  'app/api/fournisseurs/[id]/route.ts',
  'app/api/magasins/[id]/route.ts',
  'app/api/produits/[id]/route.ts',
  'app/api/produits/route.ts',
  'app/api/stock/[id]/route.ts',
  'app/api/stock/init/route.ts',
  'app/api/ventes/[id]/route.ts',
];

const rootDir = __dirname;

for (const file of files) {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} - not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Pattern: getSession() followed by direct session usage
  // Add null check after getSession
  content = content.replace(
    /const session = await getSession\(\)\n([\s\S]*?)(const authError = requirePermission|if \(!session\))/,
    (match, between, nextMatch) => {
      // Check if there's already a null check
      if (between.includes('if (!session)')) {
        return match;
      }
      // Add null check before the next use of session
      return `const session = await getSession()\n  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })\n${between}${nextMatch}`;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${file}`);
  } else {
    console.log(`No changes needed for ${file}`);
  }
}