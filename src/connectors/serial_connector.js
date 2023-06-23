var SerialPort = require("serialport").SerialPort

var http = require('http'),
	https = require('https'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),

	mime = require('mime'),
	WebSocketServer = require('ws').Server,

	webServer, wsServer, wsPort,
	serialPort, serialBitRate, serialDataBits,
    serialParity, serialStopBits, serialFlowControl,
	suffix, encoding, deviceID, serialClient,
	argv = null;

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
					error: err,
					deviceID: deviceID
				});
			}
			else {
				console.log("Connected to Serial device on " + serialPort);
			}
		});

		var buffer = "";

		// Receive data from Serial client and send to WebSocket client
		serialClient.on('data', function (data) {
			try {
				// Buffers data and send once separator is reached
				if (suffix) {
					buffer += data.toString();
					var lines = buffer.split(suffix);
					while (lines.length > 1) {
						msg = lines.shift();
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
					buffer = lines.join(suffix);
				}
				// Send raw data
				else {
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
			serialClient.close();
			wsServer.clients.forEach((client) => {
				client.close();
			});
		});
	}
    
	// Receive data from WebSocket client and send to Serial client
	webSocketClient.on('message', function(msg) {
		console.log('WebSocket to Serial message: ' + msg + " on " + serialPort);

		// Send data to Serial Port device with suffix, if specified
		serialClient.write(msg + suffix, encoding);
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

// Create WebSocket server and supports both http and https
function initWsServer() {
	let device = JSON.parse(process.argv[2]);

	wsPort = device.websocket_port;
	deviceID = device.deviceID;

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
	
	suffix = parser.get("Suffix");
	if (!suffix) {
		suffix = "";
	}

	// replace \\n by \n, \\r by \r...
	var temp = {suff: suffix};
	temp = JSON.stringify(temp);
	temp = temp.replaceAll('\\\\', '\\');
	temp = JSON.parse(temp);
	suffix = temp.suff;

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
			error: e,
			deviceID: deviceID
		});
	});
}
initWsServer();
