const { app, BrowserWindow } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')

const isDev = !app.isPackaged

function startServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      waitForServer(resolve)
      return
    }

    const script = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next')
    const env = { ...process.env, NODE_ENV: 'production' }

    const server = spawn('node', [script, 'start', '-p', '3000'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      env,
    })

    server.stdout.on('data', (data) => {
      const text = data.toString()
      console.log('[next]', text)
      if (text.includes('Ready') || text.includes('ready') || text.includes('localhost:3000')) {
        waitForServer(resolve)
      }
    })

    server.stderr.on('data', (data) => {
      console.log('[next]', data.toString())
    })

    server.on('error', reject)
    server.on('exit', (code) => {
      if (code !== 0 && !app.isQuitting) {
        console.error('Next.js server exited with code', code)
      }
    })

    app.on('before-quit', () => {
      app.isQuitting = true
      server.kill()
    })
  })
}

function waitForServer(resolve, retries = 0) {
  if (retries > 60) return resolve()
  http.get('http://127.0.0.1:3000', (res) => {
    resolve()
  }).on('error', () => {
    setTimeout(() => waitForServer(resolve, retries + 1), 1000)
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    icon: path.join(__dirname, '..', 'public', 'gesticom.ico'),
    title: 'GestiCom Pro',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.setMenuBarVisibility(false)
  win.loadURL('http://127.0.0.1:3000')

  return win
}

app.whenReady().then(async () => {
  try {
    await startServer()
    createWindow()
  } catch (err) {
    console.error('Failed to start:', err)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
