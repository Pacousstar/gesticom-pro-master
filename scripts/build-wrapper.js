const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const projectRoot = path.join(__dirname, '..')

// Nettoyer release/ et vieux .exe avant build
// (Next.js standalone copie toute la racine → éviter d'embarquer 5 Go)
const releaseDir = path.join(projectRoot, 'release')
if (fs.existsSync(releaseDir)) {
  let retries = 5
  while (retries > 0) {
    try { fs.rmSync(releaseDir, { recursive: true, force: true }); console.log('[clean] Supprimé: release/'); break } catch (e) {
      retries--
    if (retries === 0) console.warn('[clean] Impossible supprimer release/ apres 5 tentatives:', e.message)
    else { console.log('[clean] Nouvel essai suppression release/...'); try { require('child_process').execSync('timeout /t 2 /nobreak >nul', { stdio: 'ignore', shell: true }) } catch {} }
    }
  }
}
for (const f of fs.readdirSync(projectRoot)) {
  const full = path.join(projectRoot, f)
  if (f.endsWith('-Setup.exe') || (f.endsWith('.exe') && f !== 'node.exe' && f !== 'nssm.exe' && !f.startsWith('GestiCom'))) {
    try { fs.unlinkSync(full); console.log(`[clean] Supprimé: ${f}`) } catch {}
  }
}

process.on('uncaughtException', (err) => {
  if (err.code === 'EPERM' && err.syscall === 'kill') {
    console.warn('[build-wrapper] Ignoring benign EPERM on kill (Turbopack worker already exited)')
    return
  }
  console.error('[build-wrapper] Uncaught exception:', err)
  process.exit(1)
})

const nextBuild = spawn(
  'node',
  [path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
    shell: true,
  }
)

nextBuild.on('exit', (code) => {
  const standalone = path.join(projectRoot, '.next', 'standalone')
  if (!fs.existsSync(standalone)) { process.exit(code || 0); return }

  // 1. Fichiers temporaires Prisma (node_modules/*.tmp*)
  const nmDir = path.join(standalone, 'node_modules')
  if (fs.existsSync(nmDir)) {
    for (const f of fs.readdirSync(nmDir)) {
      if (f.includes('.tmp')) {
        try { fs.unlinkSync(path.join(nmDir, f)); console.log(`[clean] Supprimé: ${f}`) } catch {}
      }
    }
  }

  // 2. Ancien chemin .prisma/tmp*
  const prismaDir = path.join(nmDir, '.prisma')
  if (fs.existsSync(prismaDir)) {
    for (const f of fs.readdirSync(prismaDir)) {
      if (f.startsWith('tmp') || /\.tmp\d+$/.test(f)) {
        try { fs.unlinkSync(path.join(prismaDir, f)); console.log(`[clean] Supprimé: .prisma/${f}`) } catch {}
      }
    }
  }

  // 3. Release artifact (copie de l'ancien build si présent)
  const oldRelease = path.join(standalone, 'release')
  if (fs.existsSync(oldRelease)) {
    try { fs.rmSync(oldRelease, { recursive: true, force: true }); console.log('[clean] Supprimé: standalone/release/') } catch {}
  }

  // 4. Coverage artifact (coverage-final.json)
  const coverageDir = path.join(standalone, 'coverage')
  if (fs.existsSync(coverageDir)) {
    try { fs.rmSync(coverageDir, { recursive: true, force: true }); console.log('[clean] Supprimé: coverage/') } catch {}
  }

  // 5. Vérification que @prisma/client-pg existe
  const pgClientDir = path.join(projectRoot, 'node_modules', '@prisma', 'client-pg')
  const pgIndex = path.join(pgClientDir, 'index.js')
  if (!fs.existsSync(pgIndex)) {
    console.error('[build-wrapper] ERREUR FATALE: @prisma/client-pg/index.js introuvable !')
    console.error('[build-wrapper] Le packaging electron-builder n\'inclura pas le client PostgreSQL.')
    process.exit(1)
  }
  const pgDll = path.join(pgClientDir, 'query_engine-windows.dll.node')
  if (!fs.existsSync(pgDll)) {
    console.warn('[build-wrapper] ATTENTION: query_engine-windows.dll.node manquant dans @prisma/client-pg/')
  }
  console.log('[build-wrapper] @prisma/client-pg vérifié OK')

  // 6. Vérification des scripts critiques requis au runtime (setup auto, migration)
  for (const critical of ['postgres-manager.js', 'seed.js']) {
    const p = path.join(projectRoot, 'scripts', critical)
    if (!fs.existsSync(p)) {
      console.error('[build-wrapper] ERREUR FATALE: scripts/' + critical + ' introuvable ! Le package serait incomplet.')
      process.exit(1)
    }
  }
  console.log('[build-wrapper] Scripts critiques vérifiés OK (postgres-manager.js, seed.js)')

  process.exit(code || 0)
})
