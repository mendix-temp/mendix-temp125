const electron = require('electron');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws').WebSocket;
const os = require('os');

let mainWindow,
    isQuiting,
    overlay,
    config,
    tray,
    hideWindow;

// pointer to process handling websocket connection to station
let deviceListProcess = null;

// Needed for squirrel
if (require('electron-squirrel-startup')) electron.app.quit();

// Autoupdate: default settings are check at startup and every 10 minutes for update
// if found, download in backgroud and prompt user for update. 
require('update-electron-app')()

/*##################################################################################/*
----------------------------------DATA STRUCTURES-----------------------------------
/*##################################################################################*/

// Class storing a browser window and its associated browser views and overlay
class WindowClass {
  constructor(someWindow, someOverlay, someStatus) {
    this.window = someWindow;
    this.overlay = someOverlay;
    this.status = someStatus;

    // map of app name to view
    this.views = new Map();
    this.sideMenuOpen = true;
    this.menuOpenable = true;

    // name of current view
    this.currentView = null;
  }
}

// Hash table of WindowClass objects
// (window.id) -> (WindowClass)
let IDToWindowClass = new Map();

// Hash table of WebSocket objects, used for testing window
// (WebSocket port) -> (WebSocket Object)
let WSPortToWS = new Map();
/*##################################################################################/*
----------------------------------WINDOWS CREATION----------------------------------
/*##################################################################################*/

// Ask Electron API whether this is the first instance to be open or not
const gotTheLock = electron.app.requestSingleInstanceLock()
if (!gotTheLock) {
  electron.app.exit()
}
else {
  electron.app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
    // Focus window if user tries to open a second instance
    IDToWindowClass.forEach((windowClassObj, windowID) => {
      windowClassObj.window.show();
      windowClassObj.window.focus();
    });
  })
}
// Builds main window, overlay window, and login window
electron.app.whenReady().then(() => {
  mainWindow = new electron.BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, '/main_window/preload.js')
    },
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      height: 30,
      color: '#f8f8f8'
    },
  });
  mainWindow.loadFile('src/main_window/index.html');
  mainWindow.setBounds(electron.screen.getPrimaryDisplay().workArea);

  overlay = new electron.BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '/overlay/overlay_preload.js')
    }, 
  });
  overlay.webContents.loadFile('src/overlay/overlay.html');

  status_log = new electron.BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '/status_log/status_log_preload.js')
    }, 
  });
  status_log.webContents.loadFile('src/status_log/status_log.html');
  
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

  // Create link between overlay and main window
  mainWindow.webContents.executeJavaScript('windowID = ' + mainWindow.id + ';');
  overlay.webContents.executeJavaScript('windowID = ' + mainWindow.id + ';');

  IDToWindowClass.set(mainWindow.id, new WindowClass(mainWindow, overlay, status_log));
  fs.readFile(userDataPath + "/config.json", (err, data) => {
    try {
      data = JSON.parse(data);
      hideWindow = data.hide_on_login;
    }
    catch {}
    createListeners(mainWindow, overlay, true);
  });

  // handle tray creation
  tray = new electron.Tray(electron.nativeImage.createFromPath(path.join(__dirname, '../icons/MXP-DarkBlue-Nurture.ico')));
  tray.setContextMenu(electron.Menu.buildFromTemplate([
    {
      label: 'Show App', click: function () {
        if (IDToWindowClass.size == 1) {
          IDToWindowClass.forEach((WindowClassObj, windowID) => {
            WindowClassObj.window.show();
          });
        }
      }
    },
    {
      label: 'Quit', click: function () {
        isQuiting = true;
        electron.app.quit();
      }
    }
  ]));
  tray.setToolTip('Mendix Workstation');
  tray.on('click', (event) => {
    if (IDToWindowClass.size == 1) {
      IDToWindowClass.forEach((WindowClassObj, windowID) => {
        WindowClassObj.window.show();
      });
    }
  });
  // Hide default window menu
  //electron.Menu.setApplicationMenu(null);
});


/*##################################################################################/*
---------------------------------FUNCTION DEFINITION--------------------------------
/*##################################################################################*/
// Return a Rectangle object that is the size of the BrowserView
function getBoundsView(window) {
  var currentBounds = window.getContentBounds();
  currentBounds['x'] = IDToWindowClass.get(window.id).sideMenuOpen ? Math.round(0.1667 * currentBounds['width']) + 1 : 51;
  currentBounds['width'] = currentBounds['width'] - currentBounds['x'];
  currentBounds['height'] = currentBounds['height'] - 31;
  currentBounds['y'] = 31;
  return currentBounds;
}

// Change the bounds of all opened BrowserViews
// To be used whenever BrowserViews size needs to be updated
function setBoundsViews(window) {
  window.webContents.send('resize_body', window.getContentBounds()['height']);
  var currentBounds = getBoundsView(window);

  if (currentBounds['width'] + currentBounds['x'] < 664 && IDToWindowClass.get(window.id).menuOpenable) {
    IDToWindowClass.get(window.id).menuOpenable = !IDToWindowClass.get(window.id).menuOpenable;
    window.webContents.send('toggle_block_menu');
  }
  else if (currentBounds['width'] + currentBounds['x'] > 664 && !IDToWindowClass.get(window.id).menuOpenable) {
    IDToWindowClass.get(window.id).menuOpenable = !IDToWindowClass.get(window.id).menuOpenable;
    window.webContents.send('toggle_block_menu');
  }

  // Adds an extra step, but makes the app feel more reactive
  // IDToWindowClass.get(window.id).views.get(IDToWindowClass.get(window.id).currentView).setBounds(currentBounds);
  IDToWindowClass.get(window.id).views.forEach(function(value, key) {
    value.setBounds(currentBounds);
  });
  IDToWindowClass.get(window.id).overlay.setBounds(currentBounds);
  IDToWindowClass.get(window.id).status.setBounds(currentBounds);
}

// Make the necessary changes when a device cannot connect
// or is disconnected because of an error
function deviceDisconnected(deviceID) {
  let WSPort = config["devices"][deviceID]["websocket_port"];
  config["devices"][deviceID]["available"] = "false";
  // Close WebSocket if it is currently open
  if (WSPortToWS.has(parseInt(WSPort))) {
    WSPortToWS.get(parseInt(WSPort)).close();
    WSPortToWS.delete(parseInt(WSPort));

    IDToWindowClass.forEach((windowObj, windowID) => {
      windowObj.overlay.webContents.send('response_test_WS', "WebSocket Closed Successfully", WSPort);
    });
  }

  // Update all the overlays
  IDToWindowClass.forEach((windowObj, windowID) => {
    windowObj.overlay.webContents.send('availability_changed', WSPort, 'false');
  });
}

// Refresh config when button is pressed in settings or when Station Management app sends
// message with "refresh_config" header
function refreshConfig() {
  IDToWindowClass.forEach((windowClass, windowID) => {
    // Set all browser views of all windows to null
    windowClass.window.setBrowserView(null);
    windowClass.window.currentView = null;

    // Close all open apps
    for (const appName of windowClass.views.keys()) {
      windowClass.views.get(appName).webContents.destroy();
      windowClass.window.webContents.send('close_app', appName);
    }
    windowClass.views.clear();
    windowClass.window.webContents.send('refresh_config');
    windowClass.overlay.webContents.send('clear_overlay');
  }); 

  // kill all connector processes
  for (const processID of PIDToProcess.keys()) {
    PIDToProcess.get(processID).kill()
  }

  // close all open webSockets
  WSPortToWS.forEach((WS, WSPort) => {
    WS.close();
  }); 
  WSPortToDevice.clear();
  WSPortToWS.clear();
  PIDToProcess.clear();

  login = new electron.BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, '/login/preload.js'),
    }, 
    parent: mainWindow, 
    modal: true,
    show: false 
  });
  login.loadFile('src/login/login.html');
  decideJSON();
}

/*##################################################################################/*
----------------------------------------IPC-----------------------------------------
/*##################################################################################*/
electron.ipcMain.on('toggle_side_menu', (event, windowID) => {
  IDToWindowClass.get(windowID).sideMenuOpen = !IDToWindowClass.get(windowID).sideMenuOpen;
  setBoundsViews(IDToWindowClass.get(windowID).window);
});
    
// Shows overlay (menu) when "Settings" button is pressed
electron.ipcMain.on('open_settings', (event, windowID) => {
  const window = IDToWindowClass.get(windowID).window;
  const overlay = IDToWindowClass.get(windowID).overlay;
  IDToWindowClass.get(windowID).currentView = null;
  window.webContents.send('handle_workstation_function');
  window.setBrowserView(overlay);
  overlay.setBounds(getBoundsView(window));
});

// Open status log when Status button is pressed
electron.ipcMain.on('open_status', (event, windowID) => {
    let windowClassObj = IDToWindowClass.get(windowID);
    IDToWindowClass.get(windowID).currentView = null;
    windowClassObj.window.webContents.send('handle_workstation_function');
    windowClassObj.window.setBrowserView(windowClassObj.status);
    windowClassObj.status.setBounds(getBoundsView(windowClassObj.window));
});


// Start the process for an app that has never been opened before
electron.ipcMain.on('open_app', (event, name, url, source, windowID) => {
  let currentWindowClass = IDToWindowClass.get(windowID);
  if (currentWindowClass.views.has(name)) {
    return;
  }
  var currentApp = new electron.BrowserView();
  currentWindowClass.views.set(name, currentApp);
  currentWindowClass.currentView = name;
  currentWindowClass.window.setBrowserView(currentApp);
  var currentBounds = getBoundsView(currentWindowClass.window);
  currentApp.setBounds(currentBounds);
  currentApp.webContents.loadURL(url)
    .catch((error) => {
      currentApp.webContents.loadFile('src/error/error_load_url.html')
      .then(() => {
        currentApp.webContents.executeJavaScript('document.getElementById("error_message").innerHTML = "' + error.toString() +'";');
      });
    })
    .finally(() => {
      if (source === 'overlay') {
        currentWindowClass.overlay.webContents.send('app_opened_overlay', name);
        currentWindowClass.window.webContents.send('app_opened_overlay', name);
      }
      else if (source === "mainWindow") {
        currentWindowClass.window.webContents.send('update_status_switched', name);
      }
      // Update goBack/goForward buttons when page loads/fails to load
      currentApp.webContents.on('did-fail-load', (event) => {
        IDToWindowClass.get(windowID).window.webContents.send('set_go_forward', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoForward());
        IDToWindowClass.get(windowID).window.webContents.send('set_go_back', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoBack());
      });
      currentApp.webContents.on('did-frame-finish-load', (event) => {
        IDToWindowClass.get(windowID).window.webContents.send('set_go_forward', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoForward());
        IDToWindowClass.get(windowID).window.webContents.send('set_go_back', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoBack());
      });
      // In case webApp can go forward/back when it loads
      IDToWindowClass.get(windowID).window.webContents.send('set_go_forward', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoForward());
      IDToWindowClass.get(windowID).window.webContents.send('set_go_back', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoBack());
    });
    // Update buttons in overlay if app is opened from mainWindow
    if (source === 'mainWindow') {
      currentWindowClass.overlay.webContents.send('app_opened_main', name);
    }
    
});

// Switch to a different app (that has been opened before)
electron.ipcMain.on('switch_app', (event, name, windowID) => {
  let tempWindowClass = IDToWindowClass.get(windowID);
  if (name === tempWindowClass.currentView) return;
  if (tempWindowClass.views.has(name)) {
    tempWindowClass.window.setBrowserView(tempWindowClass.views.get(name));
    tempWindowClass.window.webContents.send('update_status_switched', name);
    tempWindowClass.currentView = name;
    // Update forward/Back buttons when current view is changed
    IDToWindowClass.get(windowID).window.webContents.send('set_go_forward', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoForward());
    IDToWindowClass.get(windowID).window.webContents.send('set_go_back', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoBack());
  }
});

// Close open app and send signal to overlay to reset app button
electron.ipcMain.on('close_app', (event, name, windowID) => {
  let currentWindowClass = IDToWindowClass.get(windowID);
  if (!currentWindowClass.views.has(name)) {
    return;
  }
  var toClose = currentWindowClass.views.get(name);

  if (currentWindowClass.currentView === name && toClose.webContents) {
    currentWindowClass.window.setBrowserView(null);
    currentWindowClass.currentView = null;
    toClose.webContents.destroy();
  }
  else if (toClose.webContents) {
    toClose.webContents.destroy();
  }
  currentWindowClass.views.delete(name);
  currentWindowClass.overlay.webContents.send('close_app', name);
  currentWindowClass.window.webContents.send('close_app', name);
});

// Quit app when a renderer process emits 'quit_app'
// 'quit_app' emitted by main_window/renderer.js when no config is found
electron.ipcMain.on('quit_app', (event) => {
  electron.app.quit();
});

// Send list of connected devices to build menu in overlay
electron.ipcMain.on('get_device_list', (event, windowID) => {
  var deviceList = new Array();
  WSPortToDevice.forEach(function(device, port) {
    deviceList.push(device);
  });
  IDToWindowClass.get(windowID).overlay.webContents.send('device_list', deviceList);
}); 

// Open WebSocket for devices test (from overlay)
electron.ipcMain.on('open_WS', (event, WSPort) => {
  IDToWindowClass.forEach((windowObj, windowID) => {
    windowObj.overlay.webContents.send('update_WS_buttons', WSPort, true);
  });
  var ws = new WebSocket('ws://localhost:' + WSPort);
  WSPortToWS.set(WSPort, ws);
  IDToWindowClass.forEach((windowObj, windowID) => {
    windowObj.overlay.webContents.send('response_test_WS', "Opening WebSocket", WSPort);
  });

  ws.on('message', function(data) {
    IDToWindowClass.forEach((windowObj, windowID) => {
      windowObj.overlay.webContents.send('response_test_WS', data.toString(), WSPort);
    });
  });
  ws.on('open', function () {
    IDToWindowClass.forEach((windowObj, windowID) => {
      windowObj.overlay.webContents.send('response_test_WS', "WebSocket Opened Successfully", WSPort);
    });
  });
  ws.on('error', function(err) {
    IDToWindowClass.forEach((windowObj, windowID) => {
      windowObj.overlay.webContents.send('response_test_WS', err.toString(), WSPort);
    });
  });
  ws.on('close', function() {
    IDToWindowClass.forEach((windowObj, windowID) => {
      windowObj.overlay.webContents.send('response_test_WS', "WebSocket Closed Successfully", WSPort);
      windowObj.overlay.webContents.send('update_WS_buttons', WSPort, false);
    });
  });
});

// Test WebSocket for devices test (from overlay)
electron.ipcMain.on('test_WS', (event, WSPort, message) => {
  WSPortToWS.get(WSPort).send(message);
});

// Close WebSocket for devices test (from overlay)
electron.ipcMain.on('close_WS', (event, WSPort) => {
  WSPortToWS.get(WSPort).close();
  WSPortToWS.delete(WSPort);
});

// Close everything and get new config from API/file
// (config.json modified manually will get overwritten by API config)
electron.ipcMain.on('refresh_config', (event) => {
  refreshConfig();
});

electron.ipcMain.on('reset_workstation', (event) => {
  fs.writeFile(userDataPath + "/config.json", '', (err) => {
    if (err) {
      console.log(err)
    }  
  });
  refreshConfig();
  IDToWindowClass.forEach((windowClassObj, windowID) => {
    windowClassObj.status.webContents.loadFile('src/status_log/status_log.html');
    windowClassObj.window.webContents.send('change_status', 'normal');
  });
});

// Create new browser window when button is pressed
electron.ipcMain.on('new_window', (event) => {
  let newWindow = new electron.BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, '/main_window/preload.js')
    },
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      height: 30,
      color: '#f8f8f8'
    },
  });
  mainWindow.setBounds(electron.screen.getPrimaryDisplay().workArea);
  newWindow.loadFile('src/main_window/index.html');

  newOverlay = new electron.BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '/overlay/overlay_preload.js')
    }, 
  });
  newOverlay.webContents.loadFile('src/overlay/overlay.html');

  status_log = new electron.BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '/status_log/status_log_preload.js')
    }, 
  });
  status_log.webContents.loadFile('src/status_log/status_log.html');

  // Create link between overlay and main window
  newWindow.webContents.executeJavaScript('windowID = ' + newWindow.id + ';');
  newOverlay.webContents.executeJavaScript('windowID = ' + newWindow.id + ';');
  
  IDToWindowClass.set(newWindow.id, new WindowClass(newWindow, newOverlay, status_log));
  createListeners(newWindow, newOverlay, false);
});

// Close overlay when logo is clicked
electron.ipcMain.on('close_overlay', (event, windowID) => {
  IDToWindowClass.get(windowID).overlay.hide();
  IDToWindowClass.get(windowID).window.focus();
});
/*--------------------------------WEB FUNCTIONALITY---------------------------------*/
// Reload current view
electron.ipcMain.on('reload', (event, windowID) => {
  try {
    IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.reload();
    IDToWindowClass.get(windowID).window.webContents.send('set_go_forward', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoForward());
    IDToWindowClass.get(windowID).window.webContents.send('set_go_back', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoBack());
  } catch (error) {
    return;
  }
});
// Go back in current view
electron.ipcMain.on('go_back', (event, windowID) => {
  try {
    IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.goBack();
    IDToWindowClass.get(windowID).window.webContents.send('set_go_forward', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoForward());
    IDToWindowClass.get(windowID).window.webContents.send('set_go_back', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoBack());  
  } catch (error) {
    return;
  }
});
// Go forward in current view
electron.ipcMain.on('go_forward', (event, windowID) => {
  try {
    IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.goForward();
    IDToWindowClass.get(windowID).window.webContents.send('set_go_forward', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoForward());
    IDToWindowClass.get(windowID).window.webContents.send('set_go_back', !IDToWindowClass.get(windowID).views.get(IDToWindowClass.get(windowID).currentView).webContents.canGoBack());
  } catch (error) {
    return;
  }
});

electron.ipcMain.on('toggle_dev_tools', (event, windowID) => {
  IDToWindowClass.get(windowID).window.webContents.openDevTools({mode: 'detach'})
});

electron.ipcMain.on('open_workstation_management', (event, windowID) => {
  let windowClassObj = IDToWindowClass.get(windowID);
  if (windowClassObj.views.get('workstation_management') != undefined) {
    windowClassObj.window.setBrowserView(windowClassObj.views.get('workstation_management'));
    windowClassObj.currentView = 'workstation_management';
  }
  else {
    let workstation_management = new electron.BrowserView();
    let workstation_management_url = new URL(config.url_station);
    workstation_management.webContents.loadURL(
        workstation_management_url.origin + `/link/StationConfigURL?ComputerName=${os.hostname()}`);
    windowClassObj.window.setBrowserView(workstation_management);
    workstation_management.setBounds(getBoundsView(windowClassObj.window));
    windowClassObj.views.set('workstation_management', workstation_management);
  }
});

const appFolder = path.dirname(process.execPath);
const updateExe = path.resolve(appFolder, '..', 'Update.exe');
const exeName = path.basename(process.execPath);
// Handle auto-startup setting change
function handleAutoLogin(autoStart, hideOnStart) {
  let args;
  if (hideOnStart) {
    args = [
      '--processStart', `"${exeName}"`,
      '--process-start-args', '"--hidden"'
    ]
  }
  else {
    args = ['--processStart', `"${exeName}"`]
  }
  electron.app.setLoginItemSettings({
    openAtLogin: autoStart,
    path: updateExe,
    args: args,
  })
  fs.readFile(userDataPath + "/config.json", (err, data) => {
    data = JSON.parse(data);
    data["hide_on_login"] = hideOnStart;
    data["auto_start"] = autoStart;
    fs.writeFile(userDataPath + "/config.json", JSON.stringify(data, null, 2), (err) => {if (err) console.log(err)});
  });
}
electron.ipcMain.on('hide_on_login', (event, autoStart, hideOnStart) => {
  handleAutoLogin(autoStart, hideOnStart);
});
electron.ipcMain.on('launch_on_login', (event, autoStart, hideOnStart) => {
  handleAutoLogin(autoStart, hideOnStart);
});

/*##################################################################################/*
---------------------------------------EVENTS---------------------------------------
/*##################################################################################*/
function createListeners(someWindow, someOverlay, isFirstWindow) {
  // Resize html body so that it fits perfectly, regardless of screen resolution
  someWindow.once('ready-to-show', (event) => {
    someWindow.webContents.send('resize_body', someWindow.getContentBounds()['height']);
    if (!hideWindow || hideWindow == undefined) {
      someWindow.show();
    }
    hideWindow = false;
  });
  // Update bounds of all BrowserViews when window is resized
  someWindow.on('resize', (event) => {
    setBoundsViews(someWindow);
  });
  
  someWindow.on('maximize', (event) => {
    setBoundsViews(someWindow);
  });

  someWindow.on('close', (event) => {
    // if close event and only 1 window remaining and not closed from systray:
    // hide window
    if (!isQuiting && IDToWindowClass.size == 1) {
      event.preventDefault();
      IDToWindowClass.forEach((WindowClassObj, windowID) => {
        WindowClassObj.window.hide();
      });
    }
    // otherwise, close window
    else {
      IDToWindowClass.delete(someWindow.id);
    }
  });

  // Takes care of JSON.config once overlay is loaded
  // Only connect to devices if connection does not exist
  someOverlay.webContents.on('did-finish-load', (event) => {
    if (isFirstWindow) {
      decideJSON();
    }
    else {
      // Initialize overlay and main window when not first window
      // Create left menu and overlay menu
      someOverlay.webContents.send('json', config);
      someWindow.webContents.send('json', JSON.stringify(config["apps"]));
      
      // Create devices test menu
      var deviceList = new Array();
      WSPortToDevice.forEach(function(device, port) {
        deviceList.push(device);
      });
      someOverlay.webContents.send('device_list', deviceList);
    }
  });


  login.on('close', (event) => {
    electron.app.quit();
  });
}

// Prevent bug with autoupdate
electron.app.on('before-quit', function() {
  isQuiting = true;
});
// Quit app when all windows are closed
electron.app.on('window-all-closed', function () {
  electron.app.quit();
});

/*##################################################################################/*
-------------------------------------GET CONFIG-------------------------------------
/*##################################################################################*/
const userDataPath = electron.app.getPath('userData');
function decideJSON() {
  if (fs.existsSync(userDataPath + "/config.json")) {
    try {
      config = fs.readFileSync(userDataPath + "/config.json")
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
let APIKey;
function handleJSON (config, configExists) {
  // Check if API Key is saved locally
  if (fs.existsSync(userDataPath + "/APIKey.txt")) {
    APIKey = fs.readFileSync(userDataPath + "/APIKey.txt");
  }
  else {
    APIKey = 'undefined';
  }

  // Get JSON from MX Station and updates local file
  // Call overlay and send updated apps list to display
  fetch(config.url_station, {
      headers: {'APIKey': APIKey}
    },
    )
    .then(response => {
      if (!response.ok) {
        throw new Error('Denied access by server');
      }
      return response.json();
    })
    .then(json => {
      // Onboarding
      if (json["result"] == "UnknownStation") {
        config["onboarding_url"] = json["onboarding_url"];
        let onboardingView = new electron.BrowserView();
        IDToWindowClass.get(mainWindow.id).views.set("onboarding", onboardingView);
        IDToWindowClass.get(mainWindow.id).currentView = "onboarding";
        IDToWindowClass.get(mainWindow.id).window.setBrowserView(onboardingView);
        onboardingView.setBounds(getBoundsView(IDToWindowClass.get(mainWindow.id).window));

        if (!deviceListProcess) {
          startWebAppCommProcess(json["config_port"]);
        }

        onboardingView.webContents.loadURL(config["onboarding_url"]);
        login.hide();
        return;
      }
      // Normal configuration process
      config["onboarding_url"] = json["onboarding_url"];
      config["apps"] = json["apps"];
      config["devices"] = json["devices"];
      config["station_name"] = json["station_name"];
      config["config_port"] = json["config_port"];


      fs.writeFile(userDataPath + "/config.json", JSON.stringify(config, null, 2), function(err) {
        if (err) {
          console.log(err)
        }
      });
      IDToWindowClass.forEach((windowObj, windowID) => {
        windowObj.overlay.webContents.send('json', JSON.stringify(config));
        windowObj.window.webContents.send('json', JSON.stringify(config["apps"]));
      });
      
      handleDevices(config);
      login.destroy();
    })
    .catch((err) => {
      console.log("Error fetching data from server.");
      console.log(err.message);
      if (configExists) {
        console.log("Using previous config from file.");
        IDToWindowClass.forEach((windowObj, windowID) => {
          windowObj.overlay.webContents.send('json', JSON.stringify(config));
          windowObj.window.webContents.send('json', JSON.stringify(config["apps"]));
        });
        
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
  config = {"url_station": stationUrl + os.hostname()};
  handleJSON(config, false);
});

/*###################################################################################/*
----------------------------------CREATE WEBSOCKETS----------------------------------
/*###################################################################################*/
// Mapping from processID to process
let PIDToProcess = new Map();
// Mapping from WS Port to device available on that port
let WSPortToDevice = new Map();
function handleDevices(config) {
  let child;
  for (var i = 0; i < config["devices"].length; i++) {
    // Make sure that no two devices use the same port in config.json
    if (WSPortToDevice.has(config["devices"][i]["websocket_port"])) {
      config["devices"][i]["available"] = "false";
      portInUse(config["devices"][i], i);
      WSPortToDevice.set((-i).toString(), config["devices"][i]);
      WSPortToDevice.get((-i).toString())["available"] =  "false";
      continue;
    }
    WSPortToDevice.set(config["devices"][i]["websocket_port"], config["devices"][i]);

    config["devices"][i]["deviceID"] = i.toString();
    // Create child process depending on device type
    child = electron.utilityProcess.fork(path.join(__dirname, '/connectors/' + config["devices"][i]["driver_name"] + '_connector.js'), 
    [JSON.stringify(config["devices"][i])]);

    WSPortToDevice.get(config["devices"][i]["websocket_port"])["available"] =  "false";
    PIDToProcess.set(i, child);
    IPC(child);    
  }
  var deviceList = new Array();
  WSPortToDevice.forEach(function(device, port) {
    deviceList.push(device);
    device['websocket_port'] = port;
  });
  IDToWindowClass.forEach((windowObj, windowID) => {
    windowObj.overlay.webContents.send('devices_handled');
    windowObj.overlay.webContents.send('device_list', deviceList);
  });
  if (!deviceListProcess) {
    startWebAppCommProcess(config['config_port']);
  }
  sendUpdateDeviceList(config['devices']);
}

// TODO: could combine retryConnection and handleDevices into 1 function
// and remove if else if by changing file name in connectors to device type
function retryConnection(device, deviceID) {
  let child;

  device["deviceID"] = deviceID.toString();
  // Create child process depending on device type
  child = electron.utilityProcess.fork(path.join(__dirname, '/connectors/' + device["driver_name"] + '_connector.js'), 
  [JSON.stringify(device)]);

  PIDToProcess.set(deviceID, child);
  IPC(child);    
}

function portInUse(device, deviceID) {
  IDToWindowClass.forEach((windowClassObj, windowID) => {
    windowClassObj.status.webContents.send('send_log', {
      type: 'error',
      header: 'port_in_use',
      error_message:`An error occured during connection to device ${device["name"]}:<br>Port already in use by another device from config.json`,
    });
  });
}

// Receive messages from child processes (not renderer processes)
function IPC(child) {
  child.on('message', (data) => {
    if (data.header == 'error') {
      try {
        PIDToProcess.get(parseInt(data.deviceID)).kill();
      } catch (error) {
      }
      PIDToProcess.delete(parseInt(data.deviceID));
      IDToWindowClass.forEach((windowClassObj, windowID) => {
        windowClassObj.status.webContents.send('send_log', {
          type: 'error',
          header: 'device_error',
          error_message:`An error occured during connection to device ${config["devices"][data.deviceID]["name"]}:<br>${data.error}`,
          error: data.error,
          deviceID: data.deviceID,
        });
      });
    }
    else if (data.header == 'newDevice') {
      sendAddDevice(data.data);
    }
    else if (data.header == 'statusUpdate') {
      WSPortToDevice.get(data.websocket_port)['available'] = data.newStatus;
      sendUpdateAvailableStatus(data.deviceName, data.newStatus, data.deviceID, data.websocket_port);
    }
  });
}

// Handle events from status_log.js
electron.ipcMain.on('ignore_and_update', (event, deviceID, error) => {
  WSPortToDevice.get(config["devices"][deviceID]["websocket_port"])["available"] = "false";
  sendDeviceError(error, config["devices"][deviceID], deviceID);
  deviceDisconnected(deviceID);
});

electron.ipcMain.on('retry_connection', (event, deviceID) => {
  retryConnection(config["devices"][deviceID], parseInt(deviceID));
})

electron.ipcMain.on('change_status', (event, newStatus) => {
  IDToWindowClass.forEach((windowClassObj, windowID) => {
    windowClassObj.window.webContents.send('change_status', newStatus);
  })
})

/*###################################################################################/*
---------------------------------WEBAPP COMMUNICATION--------------------------------
/*###################################################################################*/
function startWebAppCommProcess(WSPort) {
  WSPort = '8094';
  deviceListProcess = electron.utilityProcess.fork(path.join(__dirname, '/device_to_webApp.js'), 
  [WSPort]);

  // receive messages from deviceListProcess
  deviceListProcess.on('message', (data) => {
    if (data.header == 'refresh_config') {
      refreshConfig();
    }
    else if (data.header == 'APIKey') {
      fs.writeFileSync(userDataPath + '/APIKey.txt', data.APIKey);
      handleJSON(config, false);
    }
  });
} 

// Send error message to Web App
function sendDeviceError(err, device, deviceID) {
  deviceListProcess.postMessage({
    header: "error",
    sub_header: "deviceError",
    errorData: err.toString(),
    deviceName: device['name'],
    deviceID: deviceID
  });
}

function sendUpdateAvailableStatus(deviceName, deviceAvailable, deviceID, WSPort) {
  deviceListProcess.postMessage({
    header: "statusUpdate",
    deviceName: deviceName,
    deviceID: deviceID,
    newStatus: deviceAvailable,
    websocket_port: WSPort
  });
  IDToWindowClass.forEach(function(windowClassObj, windowID) {
    windowClassObj.overlay.webContents.send('availability_changed', WSPort, deviceAvailable);
  });
}

function sendUpdateDeviceList(devices) {
  deviceListProcess.postMessage({
    header: 'deviceListUpdate',
    deviceList: JSON.stringify(devices),
    stationName: config['station_name'],
  });
}

// deviceRaw is the JSON stringified version of the device
function sendAddDevice(deviceRaw) {
  config['devices'].push(JSON.parse(deviceRaw));
  deviceListProcess.postMessage({
    header: 'newDevice',
    data: deviceRaw
  });
}
