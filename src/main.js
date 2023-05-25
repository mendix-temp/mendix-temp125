const { error } = require('console');
const electron = require('electron');
const fs = require('fs');
const path = require('path')
const WebSocket = require('ws').WebSocket;

let mainWindow,
  overlay,
  currentApp,
  config;

let sideMenuOpen = true;

// Needed for squirrel
if (require('electron-squirrel-startup')) electron.app.quit();

// Hash table of BrowserView objects (opened apps)
let views = new Map();

/*##################################################################################/*
----------------------------------WINDOWS CREATION----------------------------------
/*##################################################################################*/
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
  createListeners();
});


/*##################################################################################/*
---------------------------------FUNCTION DEFINITION--------------------------------
/*##################################################################################*/
// Return a Rectangle object that is the size of the BrowserView
function getBoundsView() {
  var currentBounds = mainWindow.getContentBounds();
  currentBounds['x'] = sideMenuOpen ? Math.ceil(0.15 * currentBounds['width']) : 50;
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


/*##################################################################################/*
----------------------------------------IPC-----------------------------------------
/*##################################################################################*/
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
  currentApp = views.get(name);
  mainWindow.setBrowserView(currentApp);
});

// Close open app and send signal to overlay to reset app button
electron.ipcMain.on('close_app', (event, name) => {
  var toClose = views.get(name);
  if (currentApp === toClose) {
    mainWindow.setBrowserView(null);
    toClose.webContents.destroy();
  }
  else {
    toClose.webContents.destroy();
  }
  views.delete(name);
  overlay.webContents.send('close_app', name);
});

// Quit app when a renderer process emits 'quit_app'
// 'quit_app' emitted by main_window/renderer.js when no config is found
electron.ipcMain.on('quit_app', (event) => {
  electron.app.quit();
});

// Send list of connected devices to build menu in overlay
electron.ipcMain.on('get_device_list', (event) => {
  var deviceList = new Array();
  WSPortToDevice.forEach(function(device, port) {
    deviceList.push(device);
  })
  overlay.webContents.send('device_list', deviceList);
}); 

// Test WebSocket by creating websocket, sending message from user, 
// waiting for response, and sending resonse back to user
electron.ipcMain.on('test_WS', (event, WSPort, message) => {
  var ws = new WebSocket('ws://localhost:' + WSPort, {handshakeTimeout: 5000});
  ws.on('open', function () {
    ws.send(message);
  });
  ws.on('message', function(data) {
    overlay.webContents.send('response_test_WS', data.toString(), WSPort);
    ws.close();
  });
  ws.on('error', function(err) {
    overlay.webContents.send('response_test_WS', err.toString(), WSPort);
    ws.close();
  });
});

/*##################################################################################/*
---------------------------------------EVENTS---------------------------------------
/*##################################################################################*/
function createListeners() {
  // Quit app when all windows are closed
  electron.app.on('window-all-closed', function () {
    electron.app.quit();
  });


  // Resize html body so that it fits perfectly, regardless of screen resolution
  mainWindow.on('ready-to-show', (event) => {
    mainWindow.webContents.send('resize_body', mainWindow.getContentBounds()['height']);
    mainWindow.show();
  });

  // Update bounds of all BrowserViews when window is resized
  mainWindow.on('resized', (event) => {
    setBoundsViews();
  });
  mainWindow.on('maximize', (event) => {
    setBoundsViews();
  });


  // Overload close button on overlay window so that it hides it 
  // instead of closing it (useful for storing settings while app is open)
  overlay.on('close', function(e){
    e.preventDefault();
    overlay.hide();
  });

  // Takes care of JSON.config once overlay is loaded
  overlay.on('ready-to-show', (event) => {
    decideJSON();
  });


  login.on('close', (event) => {
    mainWindow.close();
  });
}

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
      login.destroy();
    })
    .catch((err) => {
      console.log("Error fetching data from server.");
      if (configExists) {
        console.log("Using previous config.");
        overlay.webContents.send('json', JSON.stringify(config["apps"]));
        handleDevices(config);
        login.destroy();
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
----------------------------------CREATE WEBSOCKETS----------------------------------
/*###################################################################################*/
// Hold childProcesses so they don't get garbage collected
let childProcesses = new Array();
// Mapping from WS Port to device available on that port
let WSPortToDevice = new Map();
function handleDevices(config) {
  let child;
  for (var i = 0; i < config["devices"].length; i++) {
    // Make sure that no two devices use the same port in config.json
    if (WSPortToDevice.has(config["devices"][i]["websocket_port"])) {
      portInUse(config["devices"][i]);
      continue;
    }
    else {
      WSPortToDevice.set(config["devices"][i]["websocket_port"], config["devices"][i]);
    }

    let settings = new Map();
    settings.set("Certificate_Path", 'undefined');
    settings.set("Key_Path", 'undefined');

    for (var j = 0; j < config["devices"][i]["properties"].length; j++) {
      settings.set(config["devices"][i]["properties"][j]["name"], config["devices"][i]["properties"][j]["value"]);
    }

    // Create child process depending on device type
    if (config["devices"][i]["type"] == "TCP_IP") {
      child = electron.utilityProcess.fork(path.join(__dirname, '/connectors/tcpip_connector.js'), 
      [config["devices"][i]["websocket_port"].toString(), settings.get("Host"),
        settings.get("Port").toString(), settings.get("Certificate_Path"), settings.get("Key_Path"),
      i.toString()]);
    }
    else if (config["devices"][i]["type"] == "Serial") {
      child = electron.utilityProcess.fork(path.join(__dirname, '/connectors/serial_connector.js'), 
      [config["devices"][i]["websocket_port"].toString(), settings.get("Port"), 
      settings.get("BitsPerSecond").toString(), settings.get("DataBits").toString(), 
      settings.get("Parity"), settings.get("StopBits").toString(), settings.get("FlowControl"),
      settings.get("Certificate_Path"), settings.get("Key_Path"), i.toString()]);
    }
    childProcesses.push(child);
    errorHandling(child);    
  }
}

function retryConnection(device) {
  var child;
  let settings = new Map();
  settings.set("Certificate_Path", 'undefined');
  settings.set("Key_Path", 'undefined');

  for (var i = 0; i < device["properties"].length; i++) {
    settings.set(device["properties"][i]["name"], device["properties"][i]["value"]);
  }

  if (device["type"] == "TCP_IP") {
    child = electron.utilityProcess.fork(path.join(__dirname, '/connectors/tcpip_connector.js'), 
      [device["websocket_port"].toString(), settings.get("Host"),
        settings.get("Port").toString(), settings.get("Certificate_Path"), settings.get("Key_Path"),
      childProcesses.length.toString()]);
  }
  else if (device["type"] == "Serial") {
    child = electron.utilityProcess.fork(path.join(__dirname, '/connectors/serial_connector.js'), 
      [device["websocket_port"].toString(), settings.get("Port"), 
      settings.get("BitsPerSecond").toString(), settings.get("DataBits").toString(), 
      settings.get("Parity"), settings.get("StopBits").toString(), settings.get("FlowControl"),
      settings.get("Certificate_Path"), settings.get("Key_Path"), childProcesses.length.toString()]);
  }
  childProcesses.push(child);
  errorHandling(child);
}

function portInUse(device) {
  electron.dialog.showMessageBoxSync(mainWindow, {
    message: 'An error occured during connection to device ' +
             device["name"] + ':\n' +
             'Port already in use by another device from config.json',
    type: 'error',
    buttons: ['Ignore'],
    title: device["name"],
  });
}

function errorHandling(child) {
  child.once('error_connector', (data) => {
    childProcesses[data.deviceID].kill();
    childProcesses[data.deviceID] = null;
    response = electron.dialog.showMessageBoxSync(mainWindow, {
      message: 'An error occured during connection to device ' +
               config["devices"][data.deviceID]["name"] + ':\n' + data.error,
      type: 'error',
      buttons: ['Retry Connection', 'Ignore'],
      title: config["devices"][data.deviceID]["name"],
    });
    switch (response) {
      case 0:
        retryConnection(config["devices"][data.deviceID]);
        break;
      case 1:
        break;
      default:
        break;
    }
  });
}

/*###################################################################################/*
-----------------------------------TEST WEBSOCKETS-----------------------------------
/*###################################################################################*/
/*async function testWebSockets() {
  var report = new Array();
  var mapping = new Map();

  // Create websocket with all available ports
  WSPortToDevice.forEach(async function(device, port) {
    var ws = new WebSocket('ws://localhost:' + port);
    mapping.set(port, ws);
  });

  // Try connection with WebSocket
  var tested = new Set();
  var countWSTested = 0;
  var currentTime = Date.now();
  while (countWSTested < WSPortToDevice.size && Date.now() - currentTime < 10000) {
    WSPortToDevice.forEach(function(device, port) {
      if (mapping.get(port).readyState == 1 && !tested.has(port)) {
        report.push({device: device, connected: true});
        countWSTested++;
        tested.add(port);
        console.log(port + ' 1');
      }
      else if (mapping.get(port).readyState == 3 && !tested.has(port)) {
        report.push({device: device, connected: false});
        countWSTested++;
        tested.add(port);
        console.log(port + ' 2');
      }
    });
    await new Promise(r => setTimeout(r, 500));
  }

  // Close WebSockets
  WSPortToDevice.forEach(function(device, port) {
    mapping.get(port).close();
  });
  // Send event to overlay to update GUI
  overlay.webContents.send('result_ws_test', JSON.stringify(report));
}
*/