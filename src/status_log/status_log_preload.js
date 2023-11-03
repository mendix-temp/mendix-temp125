const { contextBridge, ipcRenderer } = require('electron')

// Expose part of electron API to overlay.js
contextBridge.exposeInMainWorld('electronAPI', {
  receive_log: (log) => ipcRenderer.on('send_log', log),
  retry_connection: (deviceID) => ipcRenderer.send('retry_connection', deviceID),
  ignore_and_update: (deviceID, error) => ipcRenderer.send('ignore_and_update', deviceID, error),
  change_status: (newStatus) => ipcRenderer.send('change_status', newStatus),
});