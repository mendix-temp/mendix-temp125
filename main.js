const electron = require('electron');
const Renderer = require('electron/renderer');
const path = require('path')

// might need those
// const path = re  quire('path')
// const url = require('url')
let mainWindow
let overlay
let currentApp

// hash table of BrowserView objects (opened apps)
let views = new Map();

electron.app.whenReady().then(() => {
  mainWindow = new electron.BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'main_renderer/preload.js')
    },
    width: 1024,
    height: 576,
  });
  mainWindow.loadFile('main_renderer/index.html')

  overlay = new electron.BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'overlay/overlay_preload.js')
    }, 
    parent: mainWindow, 
    modal: true, 
    show: false 
  })
  overlay.loadFile('overlay/overlay.html')

  overlay.on('close', function(e){
    e.preventDefault();
    overlay.hide();
});

  // App switch
  /*const view = new electron.BrowserView({
    preload: path.join(__dirname, 'preload.js')
  })
  mainWindow.setBrowserView(view)
  view.setBounds({x: 0, y: 0, width: 100, height: 576})
  view.setAutoResize({horizontal: true, vertical: true})
  view.webContents.loadFile('app_switch.html')
  */
  
})

electron.ipcMain.on('overlay_on', (event) => {
  overlay.show()
  
})

electron.ipcMain.on('open_app_overlay', (event, name, url) => {
  overlay.hide()
  currentApp = new electron.BrowserView()
  mainWindow.setBrowserView(currentApp)
  currentApp.setBounds({x: 154, y: 0, width: 870, height: 576})
  currentApp.setAutoResize({horizontal: true, vertical: true})
  currentApp.webContents.loadURL(url)
  views.set(name, currentApp)

  mainWindow.webContents.send('add_menu_item', name)
})

electron.ipcMain.on('switch_app', (event, name) => {
  mainWindow.setBrowserView(views.get(name))
})

electron.app.on('window-all-closed', function () {
  electron.app.quit()
})

