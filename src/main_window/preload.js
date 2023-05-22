const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  open_overlay: () => ipcRenderer.send('overlay_on'),
  add_menu_item: (name) => ipcRenderer.on('add_menu_item', name),
  switch_app: (name) => ipcRenderer.send('switch_app', name),
});