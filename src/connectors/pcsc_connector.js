var http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),

	mime = require('mime'),
	WebSocketServer = require('ws').Server;

var device = JSON.parse(process.argv[2]);
var deviceID = device.deviceID;


var webSockets = {
    values: [8200, 8201, 8203, 8204, 8205, 8206, 8207],
    usedSoFar: 0,
};
var usedSockets = new Set();

var WSPortToReader = new Map();
var webServer, wsServer, broadcast, argv = null;
var readerToProtocol = new Map();

var new_client = function(webSocketClient, req)  {
	if (!broadcast && usedSockets.has(webSocketClient._socket.localPort)) {
		webSocketClient.close(4000, 'Websocket already in use (broadcast disabled)')
	}
    usedSockets.add(webSocketClient._socket.localPort);
	var webSocketClientAddr = webSocketClient._socket.remoteAddress;

	console.log(req ? req.url : webSocketClient.upgradeReq.url);
	console.log('WebSocket connection from :'  + webSocketClientAddr);
	console.log('Version ' + webSocketClient.protocolVersion + ', subprotocol: ' + webSocketClient.protocol);

    // Receive data from WebSocket client and send to Serial client
	webSocketClient.on('message', function(msg) {
        let reader = WSPortToReader.get(webSocketClient._socket.localPort);

		console.log('WebSocket to Card Reader message: ' + msg);
        console.log('Card Reader name: ' + reader.name);
		
        // Check if a card is in range and send hardcoded message
        if (readerToProtocol.has(reader)) {
            reader.transmit(Buffer.from(msg.toString(), 'hex'), msg.length * 4, readerToProtocol.get(reader), function(err, data) {
                if (err) {
                    console.log(err);
                } else {
                    console.log(data);
                    console.log('Data received:', data.toString('hex'));
                    webSocketClient.send(data.toString('hex'));
                }
            });
        }
        else {

        }
	});
	webSocketClient.on('close', function (code, reason) {
		console.log('WebSocket client on port ' + webSocketClient._socket.localPort + ' disconnected: ' + code + ' [' + reason + ']');
        if (code !== 4000) {
            usedSockets.clear();
            wsServer.clients.forEach((client) => {
                usedSockets.add(client._socket.localPort);
            });
        }
	});
	webSocketClient.on('error', function (err) {
		console.log('WebSocket client on port ' + webSocketClient._socket.localPort + err);
        if (this.readyState == this.OPEN) {
            this.close();
        }
	});
}

var pcsc = require('pcsclite');

var pcsc = pcsc();
pcsc.on('reader', function(reader) {
    console.log('New reader detected', reader.name);

    // Initialize WebSocket server to allow connections with MX Station
    webServer = http.createServer();
    webServer.listen(webSockets.values[webSockets.usedSoFar], function() {
        wsServer = new WebSocketServer({server: this});
        wsServer.on('connection', new_client);
    });

    WSPortToReader.set(webSockets.values[webSockets.usedSoFar], reader);
    sendNewDevice(reader, webSockets.values[webSockets.usedSoFar]);

    webSockets.usedSoFar++;
    webServer.on('error', (e) => {
        process.parentPort.postMessage({
            header: 'error',
            error: e,
            deviceID: deviceID
        });
    });

    

    reader.on('error', function(err) {
        console.log('Error(', this.name, '):', err.message);
    });

    reader.on('status', function(status) {
        console.log('Status(', this.name, '):', status);
        /* check what has changed */
        var changes = this.state ^ status.state;
        if (changes) {
            if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
                console.log("card removed");/* card removed */
                reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('Disconnected');
                        readerToProtocol.delete(reader);
                    }
                });
            } else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
                console.log("card inserted");
                reader.connect({ share_mode : this.SCARD_SHARE_SHARED }, function(err, protocol) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('Protocol(', reader.name, '):', protocol);
                        readerToProtocol.set(reader, protocol);
                    }
                });
            }
        }
    });

    reader.on('end', function() {
        console.log('Reader',  this.name, 'removed');
    });
});

pcsc.on('error', function(err) {
    console.log('PCSC error', err.message);
});

function sendNewDevice(reader, wsPort) {
    process.parentPort.postMessage({
        header: 'newDevice',
        data: '{"name": "' + reader.name + '",' +
              '"websocket_port": "' + wsPort.toString() + '",' + 
              '"device_class": "Card Reader",' + 
              '"connected": "true"}'
    });
}