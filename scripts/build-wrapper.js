const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const projectRoot = path.join(__dirname, '..')

// Nettoyer les vieux installateurs et .exe de la racine avant build
// (Next.js standalone copie toute la racine → évite de les embarquer)
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
  { cwd: projectRoot, stdio: 'inherit', windowsHide: true, shell: true }
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

  // 3. Coverage artifact (coverage-final.json)
  const coverageDir = path.join(standalone, 'coverage')
  if (fs.existsSync(coverageDir)) {
    try { fs.rmSync(coverageDir, { recursive: true, force: true }); console.log('[clean] Supprimé: coverage/') } catch {}
  }

  process.exit(code || 0)
})
