const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  open_app: (name, url) => ipcRenderer.send('open_app_overlay', name, url),
  handle_json: (callback) => ipcRenderer.on('json', callback)
})