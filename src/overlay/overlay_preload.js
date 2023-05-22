const { contextBridge, ipcRenderer } = require('electron')

// Expose part of electron API to overlay.js
contextBridge.exposeInMainWorld('electronAPI', {
  open_app: (name, url) => ipcRenderer.send('open_app_overlay', name, url),
  handle_json: (callback) => ipcRenderer.on('json', callback)
})