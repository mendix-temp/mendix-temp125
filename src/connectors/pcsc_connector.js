var http = require('http'),

	WebSocketServer = require('ws').Server;

var device = JSON.parse(process.argv[2]);
var deviceID = device.deviceID;


var webSockets = {
    values: [8200, 8201, 8203, 8204, 8205, 8206, 8207],
    usedSoFar: 0,
};
var usedSockets = new Set();

var WSPortToReader = new Map();
var WSPortToWSServer = new Map();
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
        if (reader.connected) {
            reader.transmit(Buffer.from(msg.toString(), 'hex'), msg.length * 4, readerToProtocol.get(reader), function(err, data) {
                if (err) {
                    console.log(err);
                    WSPortToWSServer.get(reader.WSPort).clients.forEach((client) => {
                        client.send('3#' + err.toString('hex'));
                    });
                } else {
                    console.log(data);
                    console.log('Data received:', data.toString('hex'));
                    WSPortToWSServer.get(reader.WSPort).clients.forEach((client) => {
                        client.send('2#' + data.toString('hex'));
                    });
                }
            });
        }
        else {
            WSPortToWSServer.get(reader.WSPort).clients.forEach((client) => {
                client.send('3#CardNotFound');
            });
        }
	});
	webSocketClient.on('close', function (code, reason) {
		console.log('WebSocket client on port ' + this._socket.localPort + ' disconnected: ' + code + ' [' + reason + ']');
        if (code !== 4000) {
            usedSockets.clear();
            wsServer.clients.forEach((client) => {
                usedSockets.add(client._socket.localPort);
            });
        }
	}.bind(webSocketClient));
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
    // console.log('New reader detected', reader.name);

    // Initialize WebSocket server to allow connections with MX Station
    webServer = http.createServer();
    webServer.listen(webSockets.values[webSockets.usedSoFar], function() {
        wsServer = new WebSocketServer({server: this});
        wsServer.on('connection', new_client);
        let temp = this._connectionKey.split(':');
        let port = temp[temp.length - 1];
        WSPortToWSServer.set(port, wsServer);
    });

    reader['WSPort'] = webSockets.values[webSockets.usedSoFar].toString();
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
                console.log("card removed");
                reader.disconnect(this.SCARD_LEAVE_CARD, function(err) {
                    if (err) {
                        console.log(err);
                    } else {
                        if (WSPortToWSServer.has(this.WSPort)) {
                            WSPortToWSServer.get(this.WSPort).clients.forEach((client) => {
                                client.send('1#');
                            });
                        }
                    }
                }.bind(reader));
            } else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
                console.log("card inserted");
                reader.connect({ share_mode : this.SCARD_SHARE_SHARED }, function(err, protocol) {
                    if (err) {
                        console.log(err); 
                    } else {
                        if (WSPortToWSServer.has(this.WSPort)) {
                            WSPortToWSServer.get(this.WSPort).clients.forEach((client) => {
                                client.send('0#');
                            });
                        }
                        console.log('Protocol(', reader.name, '):', protocol);
                        readerToProtocol.set(reader, protocol);
                    }
                }.bind(reader));
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
              '"available": "true",' + 
              '"connected": "true"}'
    });
}