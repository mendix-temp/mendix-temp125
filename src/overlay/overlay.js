let deviceListCreated = false;
/*##################################################################################/*
---------------------------------FUNCTION DEFINITION--------------------------------
/*##################################################################################*/
// data in the following format:
// [{"name": ..., "url": ...}, {"name": ..., "url": ...}, ...]
function createMenu(data) {
    // Generate buttons in overlay
    document.getElementById('listItems').innerHTML += '<div class="row" id="row_0"></div>'
    for (i = 0; i < data.length; i++) {
        document.getElementById("row_" + Math.floor(i / 3).toString()).innerHTML += 
        '<div class="column">' +
            '<button class="menuItem" onclick="buttonFunction(this)" type="button" id=' + data[i].name + ' data-url="' + data[i].url + '">' +
                '<img class="menuIcon" src="' + data[i].url +'/favicon.ico">' +
                '<div class="menuText">' + data[i].name + '</div>' + 
            '</button>'
        '</div>';
        if ((i + 1) % 3 == 0 && i !== 0 && (i + 1) < data.length) {
            document.getElementById('listItems').innerHTML += 
            '<div class="row" id="row_' + ((i + 1) / 3).toString() +'"></div>'
        }
    }
}

function createDeviceList (report) {
    for (i = 0; i < report.length; i++) {        
        var tableRow = '<tr>';

        tableRow += 
            '<td>' + report[i].name + '</td>\n' +
            '<td>' + report[i].websocket_port + '</td>\n' +
            '<td>' + report[i].type + '</td>\n';

        for (j = 0; j < report[i].properties.length; j++) {
            tableRow += '<td>' + report[i].properties[j].value + '</td>\n';
        }
        
        tableRow += '<td>' +
                        '<form id="' + report[i].websocket_port + '" action="javascript:testWS(' + report[i].websocket_port + ')">' +
                            '<input type="text" id="' + report[i].websocket_port + '_input' + '">' +
                        '</form>' +
                    '</td>';
        tableRow += '<td id="' + report[i].websocket_port + '_response' + '">N/A</td>';
        tableRow += '</tr>';
        document.getElementById(report[i].type + '_Table').innerHTML += tableRow;
    }
    document.getElementById('menu').setAttribute('style', 'display:none;');
    document.getElementById('test').setAttribute('style', 'display:block;');
}

function testWS(WSPort) {
    var message = document.getElementById(WSPort + '_input').value;
    document.getElementById(WSPort + '_input').disabled = true;
    window.electronAPI.test_WebSocket(WSPort, message);
}

/*###################################################################################/*
-----------------------------------------IPC-----------------------------------------
/*###################################################################################*/
// Add buttons to overlay once JSON is handled
window.electronAPI.handle_json((event, jsonData) => {
    createMenu(JSON.parse(jsonData));
});

// Make button reusable when app is closed
window.electronAPI.close_app((event, name) => {
    document.getElementById(name).removeAttribute('disabled');
});

// Receive device list from main and call to create interface
window.electronAPI.receive_device_list((event, deviceList) => {
    createDeviceList(deviceList);
});

// Receive message back from WebSocket test
window.electronAPI.receive_message_testWS((event, data, WSPort) => {
    document.getElementById(WSPort + '_response').innerHTML = data.toString();
    document.getElementById(WSPort + '_input').disabled = false;
});

/*###################################################################################/*
----------------------------------------EVENTS---------------------------------------
/*###################################################################################*/
// Start WebSocket test when button is clicked
document.getElementById("Device_List").addEventListener('click', function () {
    if (!deviceListCreated) {
        window.electronAPI.get_device_list();
        deviceListCreated = true;
    }
    else {
        document.getElementById('test').setAttribute('style', 'display:block;');
        document.getElementById('menu').setAttribute('style', 'display:none;');
    }
});

// Exit WebSocket test window when button is clicked
document.getElementById("backFromTestMenu").addEventListener('click', function () {
    document.getElementById('test').setAttribute('style', 'display:none;');
    document.getElementById('menu').setAttribute('style', 'display:block;');
});