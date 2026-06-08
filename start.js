const { spawn } = require('child_process')
const path = require('path')

const launcher = path.join(__dirname, 'scripts', 'standalone-launcher.js')
const child = spawn('node', [launcher], {
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
  env: { ...process.env }
})
child.unref()
process.exit(0)
