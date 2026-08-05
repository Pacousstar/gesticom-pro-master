const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  restartApp: () => ipcRenderer.send('restart-app'),
  installUpdate: (setupPath) => ipcRenderer.invoke('install-update', setupPath),
})
