const { contextBridge, ipcRenderer } = require('electron')

// Expose part of electron API to overlay.js
contextBridge.exposeInMainWorld('electronAPI', {
  open_app: (name, url) => ipcRenderer.send('open_app_overlay', name, url),
  handle_json: (callback) => ipcRenderer.on('json', callback),
  close_app: (name) => ipcRenderer.on('close_app', name),
  get_device_list: () => ipcRenderer.send('get_device_list'),
  receive_device_list: (deviceList) => ipcRenderer.on('device_list', deviceList),
  test_WebSocket: (WSPort, message) => ipcRenderer.send('test_WS', WSPort, message),
  receive_message_testWS: (data, WSPort) => ipcRenderer.on('response_test_WS', data),
})