const { contextBridge, ipcRenderer } = require('electron')

// Expose part of electron API to login.js
contextBridge.exposeInMainWorld('electronAPI', {
    update_station: (stationUrl) => ipcRenderer.send('update_station', stationUrl),
    no_config: (callback) => ipcRenderer.on('no_config', callback),
    quit_app: () => ipcRenderer.send('quit_app')
})