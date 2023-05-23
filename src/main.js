const electron = require('electron');
const fs = require('fs');
const path = require('path')

let mainWindow,
  overlay,
  currentApp,
  config;

let sideMenuOpen = true;

// Needed for squirrel
if (require('electron-squirrel-startup')) electron.app.quit();

// Hash table of BrowserView objects (opened apps)
let views = new Map();

// Builds main window, overlay window, and login window
electron.app.whenReady().then(() => {
  mainWindow = new electron.BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, '/main_window/preload.js')
    },
    width: 1024,
    height: 576,
    show: false
  });
  mainWindow.loadFile('src/main_window/index.html');

  overlay = new electron.BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, '/overlay/overlay_preload.js')
    }, 
    parent: mainWindow, 
    modal: true, 
    show: false 
  });
  overlay.loadFile('src/overlay/overlay.html');

  login = new electron.BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, '/login/preload.js')
    }, 
    //closable: false,
    parent: mainWindow, 
    modal: true, 
    show: false 
  });
  login.loadFile('src/login/login.html');

  // Overload close button on overlay window so that it hides it 
  // instead of closing it (useful for storing settings while app is open)
  overlay.on('close', function(e){
    e.preventDefault();
    overlay.hide();
  });

  // Resize html body so that it fits perfectly, regardless of screen resolution
  mainWindow.on('ready-to-show', (event) => {
    mainWindow.webContents.send('resize_body', mainWindow.getContentBounds()['height']);
    mainWindow.show();
  });
  // Takes care of JSON.config once overlay is loaded
  overlay.on('ready-to-show', (event) => {
    decideJSON();
  });

  // Update bounds of all BrowserViews when window is resized
  mainWindow.on('resized', (event) => {
    setBoundsViews();
  });
  mainWindow.on('maximize', (event) => {
    setBoundsViews();
  });
});

// Return a Rectangle object that is the size of the BrowserView
function getBoundsView() {
  var currentBounds = mainWindow.getContentBounds();
  currentBounds['x'] = sideMenuOpen ? Math.floor(0.15 * currentBounds['width']) : 50;
  currentBounds['width'] = currentBounds['width'] - currentBounds['x'];
  currentBounds['y'] = 0;
  return currentBounds;
}

// Change the bounds of all opened BrowserViews
// To be used whenever BrowserViews size needs to be updated
function setBoundsViews() {
  mainWindow.webContents.send('resize_body', mainWindow.getContentBounds()['height']);
  if (!currentApp) return;
  var currentBounds = getBoundsView();
  // Adds an extra step, but makes the app feel more reactive
  currentApp.setBounds(currentBounds);
  views.forEach(function(value, key) {
    value.setBounds(currentBounds);
  });
}

electron.ipcMain.on('toggle_side_menu', (event) => {
  sideMenuOpen = !sideMenuOpen;
  setBoundsViews();
});
    
// Shows overlay (menu) when "Add Apps" button is pressed
electron.ipcMain.on('overlay_on', (event) => {
  overlay.show()
});

// Start the process for an app that has never been opened before
electron.ipcMain.on('open_app_overlay', (event, name, url) => {
  overlay.hide()
  currentApp = new electron.BrowserView()
  mainWindow.setBrowserView(currentApp)
  var currentBounds = getBoundsView();
  currentApp.setBounds(currentBounds);
  currentApp.webContents.loadURL(url);
  views.set(name, currentApp);

  mainWindow.webContents.send('add_menu_item', name, url);
});

// Switch to a different app (that has been opened before)
electron.ipcMain.on('switch_app', (event, name) => {
  mainWindow.setBrowserView(views.get(name));
});

// Quit app when a renderer process emits 'quit_app'
// 'quit_app' emitted by main_window/renderer.js when no config is found
electron.ipcMain.on('quit_app', (event) => {
  electron.app.quit();
});

// Quit app when all windows are closed
electron.app.on('window-all-closed', function () {
  electron.app.quit();
});


/*##################################################################################/*
----------------------------------------JSON----------------------------------------
/*##################################################################################*/
function decideJSON() {
  if (fs.existsSync("./config.json")) {
    try {
      config = fs.readFileSync("./config.json")
      config = JSON.parse(config)
      handleJSON(config, true);
    } catch (error) {
      console.log("Invalid config.json. Getting config.json from API.");
      login.show();
    }
  }
  else {
    login.show();
  }
}

function handleJSON (config, configExists) {
  // Get JSON from MX Station and updates local file
  // Call overlay and send updated apps list to display
  fetch(config.url_station)
    .then(response => {
      if (!response.ok) {
        console.log("Denied access by server");
        throw new Error('Denied access by server');
      }
      return response.json()
    })
    .then(json => {
      config["apps"] = json["apps"];
      config["devices"] = json["devices"];
      fs.writeFile("config.json", JSON.stringify(config, null, 2), function(err) {
        if (err) {
          console.log(err)
          // TODO: add script to handle write error
        }
      });
      overlay.webContents.send('json', JSON.stringify(config["apps"]));
      handleDevices(config);
      login.close();
    })
    .catch((err) => {
      console.log("Error fetching data from server.");
      if (configExists) {
        console.log("Using previous config.");
        overlay.webContents.send('json', JSON.stringify(config["apps"]));
        handleDevices(config);
        login.close();
      }
      else {
        console.log("No valid config found in local storage.");
        login.webContents.send('no_config');
      }
    });
}

electron.ipcMain.on("update_station", (event, stationUrl) => {
  config = {"url_station": stationUrl};
  handleJSON(config, false);
})

/*###################################################################################/*
------------------------------------LOCAL DEVICES------------------------------------
/*###################################################################################*/
function handleDevices(config) {
  for (var i = 0; i < config["devices"].length; i++) {
    let settings = new Map();
    settings.set("Certificate_Path", 'null');
    settings.set("Key_Path", 'null');

    for (var j = 0; j < config["devices"][i]["properties"].length; j++) {
      settings.set(config["devices"][i]["properties"][j]["name"], config["devices"][i]["properties"][j]["value"]);
    }

    // Create child process depending on device type
    if (config["devices"][i]["type"] == "TCP_IP") {
      child = electron.utilityProcess.fork(path.join(__dirname, '/connectors/tcpip_connector.js'), 
        [config["devices"][i]["websocket_port"].toString(), settings.get("Host"),
         settings.get("Port").toString(), settings.get("Certificate_Path"), settings.get("Key_Path")]);
    }
    else if (config["devices"][i]["type"] == "Serial") {
      child = electron.utilityProcess.fork(path.join(__dirname, '/connectors/serial_connector.js'), 
        [config["devices"][i]["websocket_port"].toString(), settings.get("Port"), 
        settings.get("BitsPerSecond").toString(), settings.get("DataBits").toString(), 
        settings.get("Parity"), settings.get("StopBits").toString(), settings.get("FlowControl"),
        settings.get("Certificate_Path"), settings.get("Key_Path")]);
    }
  }
}
