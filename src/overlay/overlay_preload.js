const { contextBridge, ipcRenderer } = require('electron')

// Expose part of electron API to overlay.js
contextBridge.exposeInMainWorld('electronAPI', {
  open_app: (name, url, windowID) => ipcRenderer.send('open_app', name, url, 'overlay', windowID),
  handle_json: (callback) => ipcRenderer.on('json', callback),
  close_app_fromMain: (name) => ipcRenderer.on('close_app', name),
  close_app_toMain: (name, windowID) => ipcRenderer.send('close_app', name, windowID),
  get_device_list: (windowID) => ipcRenderer.send('get_device_list', windowID),
  receive_device_list: (deviceList) => ipcRenderer.on('device_list', deviceList),
  test_WebSocket: (WSPort, message) => ipcRenderer.send('test_WS', WSPort, message),
  open_WebSocket: (WSPort) => ipcRenderer.send('open_WS', WSPort),
  close_WebSocket: (WSPort) => ipcRenderer.send('close_WS', WSPort),
  receive_message_testWS: (data, WSPort) => ipcRenderer.on('response_test_WS', data, WSPort),
  refresh_config: () => ipcRenderer.send('refresh_config'),
  devices_handled: (callback) => ipcRenderer.on('devices_handled', callback),
  app_opened_main: (appName) => ipcRenderer.on('app_opened_main', appName),
  app_opened_overlay: (appName) => ipcRenderer.on('app_opened_overlay', appName),
  clear_overlay: (callback) => ipcRenderer.on('clear_overlay', callback),
  update_WS_buttons: (WSPort, enabled) => ipcRenderer.on('update_WS_buttons', WSPort, enabled),
  device_disconnected: (WSPort) => ipcRenderer.on('device_disconnected', WSPort),
})