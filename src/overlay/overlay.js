let deviceListCreated = false;
let windowID;
/*##################################################################################/*
---------------------------------FUNCTION DEFINITION--------------------------------
/*##################################################################################*/
// Close app when close button is pressed 
function closeApp(appName) {
    window.electronAPI.close_app_toMain(appName, windowID);
}

// Open app from overlay
function openApp(button) {
    window.electronAPI.open_app(button.id, button.dataset.url, windowID);
    document.getElementById(button.id).disabled = true;
}

// data in the following format:
// [{"name": ..., "url": ...}, {"name": ..., "url": ...}, ...]
function createMenu(data) {
    // Generate buttons in overlay
    let menuWrapper = document.getElementById("app-list-buttons");
    for (i = 0; i < data.length; i++) {
        let faviconUrl = 'https://' + new URL(data[i].url).hostname + '/favicon.ico';
        menuWrapper.innerHTML += 
        '<div class="buttons">' +
            '<button class="menuItem" onclick="openApp(this)" id=' + data[i].name + ' data-url="' + data[i].url + '">' +
                '<img class="menuIcon" src="' + faviconUrl +'" onerror="this.onerror=null; this.src=' + "'./question_mark.svg'" + '">' +
                '<div class="menuText">' + data[i].name + '</div>' + 
            '</button>' +
            '<div><button id="' + data[i].name + '_closeButton' + '" class="overlay-button" onclick="closeApp(this.dataset.name)" data-name="' + data[i].name + '" style="display:none;">' +
                '<span class="material-symbols-outlined">' +
                    'close' +
                '</span>' +
            '</button></div>' +
        '</div>';
    }
}

// Create list of devices in Device List of Settings
function createDeviceList (report) {
    for (i = 0; i < report.length; i++) {        
        var tableRow = '<div class="device-row">';

        tableRow += '<div class=row-0>' +
            '<div>' +
                '<div class="row-title">Name</div>' +
                '<div class="important-test">' + report[i].name + '</div>\n' +
            '</div>' +
            '<div>' +
                '<div class="row-title">Websocket Port</div>' +
                '<div class="important-test">' + report[i].websocket_port + '</div>\n' +
            '</div>' +
            '<div>' +
                '<div class="row-title">Class</div>' +
                '<div class="important-test">' + report[i].device_class + '</div>\n' +
            '</div>' +
            '<div>' +
                '<div class="row-title">Driver</div>' +
                '<div class="important-test">' + report[i].driver_name + '</div>\n' +
            '</div>' +
            '</div>';

        let properties = "";
        for (j = 0; j < report[i].properties.length; j++) {
            properties += report[i].properties[j].value + ', ';
        }
        properties = properties.slice(0, -2);
        tableRow += '<div class=row-1>' +
                        '<div class="row-title">Properties:</div>' +
                        '<div>' + properties + '</div>\n' +
                    '</div>';
        tableRow += '<div class=row-2><div class="row-title status" id="' + report[i].websocket_port + '_status' + '">' + ((report[i].available == 'true') ? 'Available' : 'Unavailable') + '</div>';
        tableRow += '<div><button id="' + report[i].websocket_port + '_openButton' + '" onclick="javascript:openWS(' + report[i].websocket_port + ')"' + ((report[i].available == 'true') ? '' : 'disabled') + ' class="overlay-button row-1-button">Connect</button></div>'
        tableRow += '<div><button id="' + report[i].websocket_port + '_closeButton' + '" onclick="javascript:closeWS(' + report[i].websocket_port + ')" disabled class="overlay-button row-1-button">Disconnect</button></div>'
        tableRow += '<div>' +
                        '<form id="' + report[i].websocket_port + '" action="javascript:testWS(' + report[i].websocket_port + ')">' +
                            '<input type="text" id="' + report[i].websocket_port + '_input' + '" disabled>' +
                        '</form>' +
                    '</div>';
        tableRow += '<div><button id="' + report[i].websocket_port + '_sendButton" onclick="javascript:testWS(' + report[i].websocket_port + ')"' + ((report[i].available == 'true') ? '' : 'disabled') + ' disabled class="overlay-button row-1-button">Send</button></div>';
        tableRow += '<div class="response" id="' + report[i].websocket_port + '_response' + '">N/A</div>';
        tableRow += '</div></div>';
        document.getElementById('device-list').innerHTML += tableRow;
    }
}

function openWS(WSPort) {
    document.getElementById(WSPort + '_input').disabled = false;
    document.getElementById(WSPort + '_openButton').disabled = true;
    document.getElementById(WSPort + '_closeButton').disabled = false;
    window.electronAPI.open_WebSocket(WSPort, windowID);
}
function closeWS(WSPort) {
    window.electronAPI.close_WebSocket(WSPort, windowID);
    document.getElementById(WSPort + '_input').disabled = true;
    document.getElementById(WSPort + '_openButton').disabled = false;
    document.getElementById(WSPort + '_closeButton').disabled = true;
}
function testWS(WSPort) {
    var message = document.getElementById(WSPort + '_input').value;
    window.electronAPI.test_WebSocket(WSPort, message);
}

/*###################################################################################/*
-----------------------------------------IPC-----------------------------------------
/*###################################################################################*/
// Add buttons to overlay once JSON is handled
window.electronAPI.handle_json((event, jsonData) => {
    jsonData = JSON.parse(jsonData)
    createMenu(jsonData["apps"]);
    document.getElementById('launch-on-login').checked = jsonData.auto_start;
    document.getElementById('hide-on-login').checked = jsonData.hide_on_login;
});

// Make button reusable when app is successfully closed
window.electronAPI.close_app_fromMain((event, name) => {
    document.getElementById(name).removeAttribute('disabled');
    document.getElementById(name).style.setProperty("cursor", "pointer");
    document.getElementById(name + "_closeButton").style.setProperty("display", "none");
});

// Receive device list from main and call to create interface
window.electronAPI.receive_device_list((event, deviceList) => {
    createDeviceList(deviceList);
});

// Receive message back from WebSocket test
window.electronAPI.receive_message_testWS((event, data, WSPort) => {
    document.getElementById(WSPort + '_response').innerHTML = data.toString();
});

window.electronAPI.devices_handled((event) => {
    document.getElementById("$Refresh_Config").disabled = false;
    document.getElementById("$Reset_Workstation").disabled = false;
});

// Update buttons in overlay when app is opened from mainWindow
window.electronAPI.app_opened_main((event, appName) => {
    document.getElementById(appName).disabled = true;
    document.getElementById(appName).style.setProperty("cursor", "default");
    document.getElementById(appName + "_closeButton").style.setProperty("display", "flex");
});

window.electronAPI.app_opened_overlay((event, appName) => {
    document.getElementById(appName).style.setProperty("cursor", "default");
    document.getElementById(appName + "_closeButton").style.setProperty("display", "flex");
});

window.electronAPI.clear_overlay((event) => {
    // Remove app buttons in overlay
    document.getElementById("app-list-buttons").innerHTML = '';

    // Remove devices list in overlay
    document.getElementById('device-list').innerHTML = '';

    // Tell process to recreate devices list next time devices menu is open
    deviceListCreated = false;
});

window.electronAPI.update_WS_buttons((event, WSPort, enabled) => {
    if (enabled) {
        document.getElementById(WSPort + '_input').disabled = false;
        document.getElementById(WSPort + '_sendButton').disabled = false;
        document.getElementById(WSPort + '_openButton').disabled = true;
        document.getElementById(WSPort + '_closeButton').disabled = false;
    }
    else {
        document.getElementById(WSPort + '_input').disabled = true;
        document.getElementById(WSPort + '_sendButton').disabled = true;
        document.getElementById(WSPort + '_openButton').disabled = false;
        document.getElementById(WSPort + '_closeButton').disabled = true;
    }
});

window.electronAPI.device_availability_changed((event, WSPort, deviceAvailable) => {
    if (deviceAvailable == 'false') {
        document.getElementById(WSPort + '_openButton').disabled = true;
        document.getElementById(WSPort + '_closeButton').disabled = true;
        document.getElementById(WSPort + '_sendButton').disabled = true;
        document.getElementById(WSPort + '_status').innerHTML = 'Unavailable';
    }
    else {
        document.getElementById(WSPort + '_openButton').disabled = false;
        document.getElementById(WSPort + '_closeButton').disabled = true;
        document.getElementById(WSPort + '_sendButton').disabled = false;
        document.getElementById(WSPort + '_status').innerHTML = 'Available';
    }
});

/*###################################################################################/*
----------------------------------------EVENTS---------------------------------------
/*###################################################################################*/
// Start WebSocket test when button is clicked
let deviceVisible = true;
document.getElementById("Device_List").addEventListener('click', function () {
    if (deviceVisible) {
        document.getElementById('device-list').setAttribute('style', 'display:none;');
    }
    else {
        document.getElementById('device-list').setAttribute('style', 'display:block;');
    }
    deviceVisible = !deviceVisible;
});

// Start WebSocket test when button is clicked
let appsVisible = true;
document.getElementById("Application_List").addEventListener('click', function () {
    if (appsVisible) {
        document.getElementById('app-list-buttons').setAttribute('style', 'display:none;');
    }
    else {
        document.getElementById('app-list-buttons').setAttribute('style', 'display:block;');
    }
    appsVisible = !appsVisible;
});

document.getElementById("$Refresh_Config").addEventListener('click', function () {
    document.getElementById("$Refresh_Config").disabled = true;
    var choice = confirm("Are you sure that you want to refresh the config?\n" + 
    "This will close all open apps and recreate the WebSockets with the devices.")

    if (!choice) {
        document.getElementById("$Refresh_Config").disabled = false;
        return;
    }

    window.electronAPI.refresh_config();
});

document.getElementById("$Reset_Workstation").addEventListener('click', function () {
    document.getElementById("$Reset_Workstation").disabled = true;
    var choice = confirm("Are you sure that you want to reset the Workstation?\n" + 
    "This will delete all existing settings and ask user for the server domain.")

    if (!choice) {
        document.getElementById("$Reset_Workstation").disabled = false;
        return;
    }

    window.electronAPI.reset_workstation();
});

document.getElementById("logo-back").addEventListener('click', function() {
    window.electronAPI.close_overlay(windowID);
});

document.getElementById("$Station_Management").addEventListener('click', () => {
    window.electronAPI.open_workstation_management(windowID);
});

document.getElementById('launch-on-login').addEventListener('change', (checkBox) => {
    autoStart = document.getElementById('launch-on-login').checked;
    hideOnStart = document.getElementById('hide-on-login').checked;
    window.electronAPI.launch_on_login(autoStart, hideOnStart);
});

document.getElementById('hide-on-login').addEventListener('change', (checkBox, a) => {
    autoStart = document.getElementById('launch-on-login').checked;
    hideOnStart = document.getElementById('hide-on-login').checked;
    window.electronAPI.hide_on_login(autoStart, hideOnStart);
});