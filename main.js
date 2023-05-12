const electron = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow
let overlay
let currentApp

// Hash table of BrowserView objects (opened apps)
let views = new Map();

// Builds main window and menu overlay window (without showing the latter)
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

  // Overload close button on overlay window so that it hides it 
  // instead of closing it (useful for storing settings while app is open)
  overlay.on('close', function(e){
    e.preventDefault();
    overlay.hide();
  });
  
})

electron.ipcMain.on('overlay_on', (event) => {
  overlay.show()
})

// Start the process for an app that has never been opened before
electron.ipcMain.on('open_app_overlay', (event, name, url) => {
  overlay.hide()
  currentApp = new electron.BrowserView()
  mainWindow.setBrowserView(currentApp)
  //currentApp.setBounds({x: 154, y: 0, width: 870, height: 576})
  currentApp.setBounds({x: 200, y: 200, width: 75, height: 50})
  currentApp.setAutoResize({horizontal: true, vertical: true})
  currentApp.webContents.loadURL(url)
  views.set(name, currentApp)

  mainWindow.webContents.send('add_menu_item', name)
})

// Switch to a different app (that has been opened before)
electron.ipcMain.on('switch_app', (event, name) => {
  mainWindow.setBrowserView(views.get(name))
})

// Quit app when all windows are closed
electron.app.on('window-all-closed', function () {
  electron.app.quit()
})

function handleJSON () {
  var config = fs.readFileSync("./config.json")
  config = JSON.parse(config)

  // Get JSON from MX Station and updates local file
  // Calls overlay and sends updated apps list to display
  if (config.station_specified) {
    fetch(config.url_station)
      .then(response => {
        if (!response.ok) {
          // TODO:
          console.log("TODO: handle denied access by server")
        }
        return response.json()
      })
      .then(json => {
        console.log(JSON.stringify(json));
        // TODO: delete console logs and change "success" by "apps"
        config["success"] = json["success"];
        console.log(JSON.stringify(config));
        fs.writeFile("config.json", JSON.stringify(config, null, 2), function(err) {
          if (err) {
            console.log(err)
            // TODO: add script to handle write error
          }
        });
        overlay.webContents.send('json', JSON.stringify(config["apps"]))
      })
      .catch((err) => {
        console.log("server could not be reached")
      });
  }
  else {
    // TODO: 
    console.log("TODO: handle first login (no url_station setup)")
  }
  
}

handleJSON()