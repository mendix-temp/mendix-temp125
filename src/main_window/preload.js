const { contextBridge, ipcRenderer } = require('electron');

// Expose part of electron API to renderer.js
contextBridge.exposeInMainWorld('electronAPI', {
  open_overlay: () => ipcRenderer.send('overlay_on'),
  add_menu_item: (name, url) => ipcRenderer.on('add_menu_item', name, url),
  switch_app: (name) => ipcRenderer.send('switch_app', name),
  resize_body: (height) => ipcRenderer.on('resize_body', height),
  toggle_side_menu: () => ipcRenderer.send('toggle_side_menu'),
});