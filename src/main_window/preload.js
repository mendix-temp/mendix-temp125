const { contextBridge, ipcRenderer } = require('electron');

// Expose part of electron API to renderer.js
contextBridge.exposeInMainWorld('electronAPI', {
  open_overlay: (windowID) => ipcRenderer.send('open_settings', windowID),
  switch_app: (name, windowID) => ipcRenderer.send('switch_app', name, windowID),
  resize_body: (height) => ipcRenderer.on('resize_body', height),
  toggle_side_menu: (windowID) => ipcRenderer.send('toggle_side_menu', windowID),
  close_app: (appName) => ipcRenderer.on('close_app', appName),
  toggle_block_menu: (callback) => ipcRenderer.on('toggle_block_menu', callback),
  json: (json) => ipcRenderer.on('json', json),
  open_app: (appName, appURL, windowID) => ipcRenderer.send('open_app', appName, appURL, 'mainWindow', windowID),
  app_opened_overlay: (appName) => ipcRenderer.on('app_opened_overlay', appName),
  update_status_switched: (appName) => ipcRenderer.on('update_status_switched', appName),
  refresh_config: (callback) => ipcRenderer.on('refresh_config', callback),
  new_window: () => ipcRenderer.send('new_window'),
  reload: (windowID) => ipcRenderer.send('reload', windowID),
  go_back: (windowID) => ipcRenderer.send('go_back', windowID),
  go_forward: (windowID) => ipcRenderer.send('go_forward', windowID),
  set_go_forward: (disabled) => ipcRenderer.on('set_go_forward', disabled),
  set_go_back: (disabled) => ipcRenderer.on('set_go_back', disabled),
  toggle_dev_tools: (windowID) => ipcRenderer.send('toggle_dev_tools', windowID),
  handle_workstation_function: (callback) => ipcRenderer.on('handle_workstation_function', callback),
  open_status: (windowID) => ipcRenderer.send('open_status', windowID),
  change_status: (newStatus) => ipcRenderer.on('change_status', newStatus),
});