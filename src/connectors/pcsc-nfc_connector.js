var http = require('http'),
	WebSocketServer = require('ws').Server;

var device = JSON.parse(process.argv[2]);
var deviceID = device.deviceID;


var webSockets = {
    values: [...Array(10).keys()].map(x => x + parseInt(device.websocket_port)),
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
        if (reader.connected && reader.reader.connected) {
            reader.transmit(Buffer.from(msg.toString(), 'hex'), msg.length * 4)
            .then((data) => {
                    console.log(data);
                    console.log('Data received:', data.toString('hex'));
                    WSPortToWSServer.get(reader.WSPort).clients.forEach((client) => {
                        client.send('2#' + data.toString('hex'));
                    });
            })
            .catch((err) => {
                console.log(err);
                WSPortToWSServer.get(reader.WSPort).clients.forEach((client) => {
                    client.send('3#' + err.toString('hex'));
                });
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

const { NFC } = require('nfc-pcsc');

var nfc = new NFC();
nfc.on('reader', function(reader) {
    reader.autoProcessing = false;
    reader.connected = true;

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
        console.log('Error(', reader.name, '):', err.message);
        reader.connected = false;
    });

    reader.on('card', card => {
		// card is object containing following data
		// String standard: TAG_ISO_14443_3 (standard nfc tags like MIFARE Ultralight) or TAG_ISO_14443_4 (Android HCE and others)
		// String type: same as standard
		// Buffer atr
		console.log(`${reader.reader.name}  card inserted`, card);

        if (WSPortToWSServer.has(reader.WSPort)) {
            WSPortToWSServer.get(reader.WSPort).clients.forEach((client) => {
                client.send('0#');
            });
        }
        console.log('Protocol(', reader.name, '):', protocol);
        readerToProtocol.set(reader, protocol);
		// you can use reader.transmit to send commands and retrieve data
		// see https://github.com/pokusew/nfc-pcsc/blob/master/src/Reader.js#L291

	});
	
	reader.on('card.off', card => {	
		console.log(`${reader.reader.name}  card removed`, card);
        if (WSPortToWSServer.has(reader.WSPort)) {
            WSPortToWSServer.get(reader.WSPort).clients.forEach((client) => {
                client.send('1#');
            });
        }
	});

    reader.on('end', function() {
        console.log('Reader',  reader.name, 'removed');
        reader.connected = false;
    });
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