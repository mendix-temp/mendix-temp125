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
function buttonFunction(button) {
    window.electronAPI.open_app(button.id, button.dataset.url, windowID);
    document.getElementById(button.id).disabled = true;
}

// data in the following format:
// [{"name": ..., "url": ...}, {"name": ..., "url": ...}, ...]
function createMenu(data) {
    // Generate buttons in overlay
    for (i = 0; i < data.length; i++) {
        document.getElementById("column_" + (i % 3).toString()).innerHTML += 
        '<div class="buttons">' +
            '<button class="menuItem" onclick="buttonFunction(this)" type="button" id=' + data[i].name + ' data-url="' + data[i].url + '">' +
                '<img class="menuIcon" src="' + data[i].url +'/favicon.ico" onerror="this.onerror=null; this.src=' + "'./question_mark.svg'" + '">' +
                '<div class="menuText">' + data[i].name + '</div>' + 
            '</button>' +
            '<button id="' + data[i].name + '_closeButton' + '" class="closeButton" onclick="closeApp(this.dataset.name)" data-name="' + data[i].name + '"hidden>' +
                '<span class="material-symbols-outlined">' +
                    'close' +
                '</span>' +
            '</button>' +
        '</div>';
    }
}

function createDeviceList (report) {
    for (i = 0; i < report.length; i++) {        
        var tableRow = '<tr>';

        tableRow += 
            '<td>' + report[i].name + '</td>\n' +
            '<td>' + report[i].websocket_port + '</td>\n' +
            '<td>' + report[i].device_class + '</td>\n' + 
            '<td>' + report[i].driver_name + '</td>\n';

        let properties = "";
        for (j = 0; j < report[i].properties.length; j++) {
            properties += report[i].properties[j].value + ', ';
        }
        properties = properties.slice(0, -2);
        tableRow += '<td>' + properties + '</div>';
        tableRow += '<td id="' + report[i].websocket_port + '_status' + '">' + ((report[i].connected == 'true') ? 'Connected' : 'Disconnected') + '</div>';
        tableRow += '<td><button id="' + report[i].websocket_port + '_openButton' + '" onclick="javascript:openWS(' + report[i].websocket_port + ')"' + ((report[i].connected == 'true') ? '' : 'disabled') + '>Connect</button></td>'
        tableRow += '<td><button id="' + report[i].websocket_port + '_closeButton' + '" onclick="javascript:closeWS(' + report[i].websocket_port + ')" disabled>Disconnect</button></td>'
        tableRow += '<td>' +
                        '<form id="' + report[i].websocket_port + '" action="javascript:testWS(' + report[i].websocket_port + ')">' +
                            '<input type="text" id="' + report[i].websocket_port + '_input' + '" disabled>' +
                        '</form>' +
                    '</td>';
        tableRow += '<td><button id="' + report[i].websocket_port + '_sendButton" onclick="javascript:testWS(' + report[i].websocket_port + ')"' + ((report[i].connected == 'true') ? '' : 'disabled') + ' disabled>Send</button></td>';
        tableRow += '<td id="' + report[i].websocket_port + '_response' + '">N/A</td>';
        tableRow += '</tr>';
        document.getElementById('devicesContent').innerHTML += tableRow;
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
    console.log(message);
    window.electronAPI.test_WebSocket(WSPort, message);
}

/*###################################################################################/*
-----------------------------------------IPC-----------------------------------------
/*###################################################################################*/
// Add buttons to overlay once JSON is handled
window.electronAPI.handle_json((event, jsonData) => {
    createMenu(JSON.parse(jsonData));
});

// Make button reusable when app is successfully closed
window.electronAPI.close_app_fromMain((event, name) => {
    document.getElementById(name).removeAttribute('disabled');
    document.getElementById(name + "_closeButton").hidden = true;
    document.getElementById(name).style.width = '100%';
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
    document.getElementById("Refresh_Config").disabled = false;
});

// Update buttons in overlay when app is opened from mainWindow
window.electronAPI.app_opened_main((event, appName) => {
    document.getElementById(appName).disabled = true;
    document.getElementById(appName + "_closeButton").hidden = false;
    document.getElementById(appName).style.width = '80%';
});

window.electronAPI.app_opened_overlay((event, appName) => {
    document.getElementById(appName + "_closeButton").hidden = false;
    document.getElementById(appName).style.width = '80%';
});

window.electronAPI.clear_overlay((event) => {
    // Remove app buttons in overlay
    for (i = 0; i < 3; i++) {
        document.getElementById("column_" + (i % 3).toString()).innerHTML = '';
    }

    // Remove devices list in overlay
    document.getElementById('devicesContent').innerHTML = '';

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

window.electronAPI.device_disconnected((event, WSPort) => {
    document.getElementById(WSPort + '_openButton').disabled = true;
    document.getElementById(WSPort + '_closeButton').disabled = true;
    document.getElementById(WSPort + '_sendButton').disabled = true;
    document.getElementById(WSPort + '_status').innerHTML = 'Disconnected';
});

/*###################################################################################/*
----------------------------------------EVENTS---------------------------------------
/*###################################################################################*/
// Start WebSocket test when button is clicked
document.getElementById("Device_List").addEventListener('click', function () {
    document.getElementById('test').setAttribute('style', 'display:block;');
    document.getElementById('menu').setAttribute('style', 'display:none;');
});

// Exit WebSocket test window when button is clicked
document.getElementById("backFromTestMenu").addEventListener('click', function () {
    document.getElementById('test').setAttribute('style', 'display:none;');
    document.getElementById('menu').setAttribute('style', 'display:block;');
});

document.getElementById("Refresh_Config").addEventListener('click', function () {
    document.getElementById("Refresh_Config").disabled = true;
    var choice = confirm("Are you sure that you want to refresh the config?\n" + 
    "This will close all open apps and recreate the WebSockets with the devices.")

    if (!choice) {
        document.getElementById("Refresh_Config").disabled = false;
        return;
    }

    window.electronAPI.refresh_config();
});