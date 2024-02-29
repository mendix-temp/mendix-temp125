var SerialPort = require("serialport").SerialPort

var http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),

	mime = require('mime'),
	WebSocketServer = require('ws').Server,

	webServer, wsServer, wsPort,
	serialPort, serialBitRate, serialDataBits,
    serialParity, serialStopBits, serialFlowControl,
	encoding, deviceID, serialClient, deviceName,
	argv = null;

var suffixOutAwait, suffixOutAdd, suffixInRemove = null;

let currentWSClient = null;
let broadcast = null;

var http_error = function (response, code, msg) {
	response.writeHead(code, {"Content-Type": "text/plain"});
	response.write(msg + "\n");
	response.end();
	return;
}

// Process an HTTP static file request
var http_request = function (request, response) {
	if (!argv.web) {
		return http_error(response, 403, "403 Permission Denied");
	}

	var myUrl = new url(request.url);
	var uri = myUrl.pathname,
		filename = path.join(argv.web, uri);
	
	if (!fs.existsSync(filename)) {
		return http_error(response, 404, "404 Not Found");
	}
	if (fs.statSync(filename).isDirectory()) {
		filename += '/index.html';
	}

	fs.readFile(filename, "binary", function(err, file) {
		if(err) {
			return http_error(response, 500, err);
		}

		response.setHeader('Content-type', mime.getType(path.parse(uri).ext));
		response.writeHead(200);
		response.write(file, "binary");
		response.end();
	});
};

// Handle new WebSocket client
var new_client = function(webSocketClient, req)  {
	if (!broadcast && currentWSClient) {
		webSocketClient.close(4000, 'Websocket already in use (broadcast disabled)')
	}
	else if (!broadcast) {
		currentWSClient = webSocketClient;
	}	

	var webSocketClientAddr = webSocketClient._socket.remoteAddress;

	console.log(req ? req.url : webSocketClient.upgradeReq.url);
	console.log('WebSocket connection from :'  + webSocketClientAddr);
	console.log('Version ' + webSocketClient.protocolVersion + ', subprotocol: ' + webSocketClient.protocol);


	if (!serialClient) {
		// Initialize SerialPort connection
		serialClient = new SerialPort({
			path: serialPort,
			baudRate: parseInt(serialBitRate),
			dataBits: parseInt(serialDataBits),
			parity: serialParity.toLowerCase(),
			stopBits: parseInt(serialStopBits),
			flowControl: (serialFlowControl.toLowerCase() == "none") ? false : true
		},
		function(err) {
			if (err) {
				process.parentPort.postMessage({
					header: 'error',
					error: err,
					deviceID: deviceID
				});
			}
			else {
				console.log("Connected to Serial device on " + serialPort);
			}
		});

		let bufferIn = "";

		// Receive data from Serial client and send to WebSocket client
		serialClient.on('data', function (data) {
			try {
				// Buffers data and send once separator is reached
				if (suffixInRemove) {
					bufferIn += data.toString();
					let lines = bufferIn.split(suffixInRemove);
					while (lines.length > 1) {
						let msg = lines.shift();
						console.log('Serial to WebSocket message: ' + msg + 'on port: ' + wsPort);
						if (!broadcast) {
							currentWSClient.send(msg);
						}
						else {
							wsServer.clients.forEach((client) => {
								client.send(msg);
							});
						}
					}
					bufferIn = lines.join(suffixInRemove);
				}
				// Send raw data
				else {
					console.log('Serial to WebSocket message: ' + data + 'on port: ' + wsPort);
					if (!broadcast) {
						currentWSClient.send(data);
					}
					else {
						wsServer.clients.forEach((client) => {
							client.send(data);
						});
					}
				}
			} catch (e) {
				console.log('WebSocket client error');
			}
		});
		serialClient.on('close', function() {
			console.log('Serial client on ' + serialPort + ' disconnected');
			wsServer.clients.forEach((client) => {
				client.close();
			});
		});
		serialClient.on('error', function(err) {
			console.log('Serial client on ' + serialPort + ' error: ' + err);
			wsServer.clients.forEach((client) => {
				client.close();
			});
		});
	}
    
	let bufferOut = "";
	// Receive data from WebSocket client and send to Serial client
	webSocketClient.on('message', function(data) {
		// Bufferize if suffixOutAwait specified
		if (suffixOutAwait) {
			bufferOut += data;
			let lines = bufferOut.split(suffixOutAwait);
			while (lines.length > 1) {
				let msg = lines.shift();
				console.log('WebSocket to Serial message: ' + msg + ' on ' + serialPort);
				// Send data to Serial Port device with suffix, if specified
				serialClient.write(msg + suffixOutAdd, encoding);
			}
			bufferOut = lines.join(suffixOutAwait);
		}
		// Send raw data
		else {
			console.log('WebSocket to Serial message: ' + data + " on " + serialPort);

			// Send data to Serial Port device with suffix, if specified
			serialClient.write(data + suffixOutAdd, encoding);
		}
		
	});
	webSocketClient.on('close', function (code, reason) {
		console.log('WebSocket client disconnected: ' + code + ' [' + reason + ']');
		if (code !== 4000) {
			currentWSClient = null;
		}

		// Close serial port connection if nothing is connected to it
		if (wsServer.clients.size == 0) {
			serialClient.close();
			serialClient = null;
		}
	});
	webSocketClient.on('error', function (err) {
		console.log('WebSocket client error: ' + err);
        if (webSocketClient.readyState == webSocketClient.OPEN) {
            webSocketClient.close();
        }
	});
};

// Create WebSocket server
function initWsServer() {
	let device = JSON.parse(process.argv[2]);


	wsPort = device.websocket_port;
	deviceID = device.deviceID;
	deviceName = device.name;

	// Parse properties field of JSON
	let parser = new Map();
	for (i = 0; i < device.properties.length; i++) {
		parser.set(device.properties[i].name, device.properties[i].value);
	}
	
	serialPort = parser.get("Port");
	serialBitRate = parser.get("BitsPerSecond");
    serialDataBits = parser.get("DataBits");
    serialParity = parser.get("Parity");
    serialStopBits = parser.get("StopBits");
    serialFlowControl = parser.get("FlowControl");
	if (parser.has("broadcast")) {
		broadcast = parser.get("Broadcast");
	}

	suffixOutAwait = parser.get("SuffixOutAwait");
	suffixOutAdd = parser.get("SuffixOutAdd");
	if (!suffixOutAdd) {
		suffixOutAdd = "";
	}
	suffixInRemove = parser.get("SuffixInRemove");

	// replace \\n by \n, \\r by \r...
	var temp = {suffixOutAwait: suffixOutAwait,
				suffixOutAdd: suffixOutAdd,
				suffixInRemove: suffixInRemove};
	temp = JSON.stringify(temp);
	temp = temp.replaceAll('\\0', '\\u0000')
	temp = temp.replaceAll('\\\\', '\\');
	temp = JSON.parse(temp);
	suffixOutAwait = temp.suffixOutAwait;
	suffixOutAdd = temp.suffixOutAdd;
	suffixInRemove = temp.suffixInRemove;

	encoding = parser.get("Encoding");
	if (!encoding) {
		encoding = 'utf-8';
	}

	webServer = http.createServer(http_request);
	webServer.listen(wsPort, function() {
		wsServer = new WebSocketServer({server: webServer});
		wsServer.on('connection', new_client);
	});
	webServer.on('error', (e) => {
		process.parentPort.postMessage({
			header: 'header',
			error: e,
			deviceID: deviceID
		});
	});
	process.parentPort.postMessage({
		header: 'statusUpdate',
		deviceName: deviceName,
		deviceID: deviceID,
		newStatus: 'true',
		websocket_port: wsPort
	});
}
initWsServer();
/*SerialPort.list().then(function(ports){
	ports.forEach(function(port){
	  console.log("Port: ", port);
	})
  });
*/
  