const { spawn } = require('child_process')
const path = require('path')

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
  [path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'],
  { cwd: path.join(__dirname, '..'), stdio: 'inherit', windowsHide: true, shell: true }
)

nextBuild.on('exit', (code) => {
  process.exit(code || 0)
})
