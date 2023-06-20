var net = require('net'),
	http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),
	mime = require('mime'),
	WebSocketServer = require('ws').Server,

	webServer, wsServer,
	wsPort, tcpHost, tcpPort, deviceID, tcpClient,
	suffix, encoding, argv = null;

let currentWSClient = null;

// Send an HTTP error response
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
	
	var webSocketClientAddr = webSocketClient._socket.remoteAddress, log;

	console.log(req ? req.url : webSocketClient.upgradeReq.url);
	console.log('WebSocket connection from :'  + webSocketClientAddr);
	console.log('Version ' + webSocketClient.protocolVersion + ', subprotocol: ' + webSocketClient.protocol);

	// Initialize TCP connection if it does not exist already
	if (!tcpClient) {
		tcpClient = net.createConnection(tcpPort,tcpHost, function() {
			console.log('Connected to TCP server ' + tcpHost + ':' + tcpPort);
		});
	
		var buffer = "";
	
	
		// Receive data from TCP client and send to WebSocket client
		tcpClient.on('data', function (data) {
			try {
				if (suffix) {
					buffer += data.toString();
					var lines = buffer.split(suffix);
					while (lines.length > 1) {
						msg = lines.shift();
						console.log('TCP to WebSocket message: ' + data.toString() + ' on port: ' + wsPort);
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
				else {
					console.log('TCP to WebSocket message: ' + data.toString() + ' on port: ' + wsPort);
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
		tcpClient.on('close', function() {
			console.log('TCP client ' + tcpHost + ':' + tcpPort + ' closed');
			wsServer.clients.forEach((client) => {
				client.close();
			});
		});
		tcpClient.on('end', function() {
			console.log('TCP client ' + tcpHost + ':' + tcpPort + ' ended');
		});
		tcpClient.on('error', function(err) {
			console.log('TCP client error: ' + err);
			tcpClient.end();
			wsServer.clients.forEach((client) => {
				client.close();
			});
			process.parentPort.postMessage({
				error: err,
				deviceID: deviceID
			});
		});
	}
	
	// Receive data from WebSocket client and send to TCP client
	webSocketClient.on('message', function(msg) {
		console.log('WebSocket to TCP message: ' + msg);

		// Send data to TCP/IP device along with suffix if specified
		tcpClient.write(msg + suffix, encoding);
	});
	webSocketClient.on('close', function (code, reason) {
		console.log('WebSocket client disconnected: ' + code + ' [' + reason + ']');
		if (code !== 4000) {
			currentWSClient = null;
		}

		// Close TCP/IP connection if nothing is connected to it
		if (wsServer.clients.size == 0) {
			tcpClient.destroy();
			tcpClient = null;
		}
	});
	webSocketClient.on('error', function (err) {
		console.log('WebSocket client error: ' + err);
		webSocketClient.close();
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

	tcpHost = parser.get("Host");
	tcpPort = parser.get("Port");
	// broadcast = parser.get("Broadcast");
	suffix = parser.get("Suffix");
	if (!suffix) {
		suffix = "";
	}

	// replace \\n by \n, \\r by \r, ...
	var temp = {suff: suffix};
	temp = JSON.stringify(temp);
	temp = temp.replaceAll('\\\\', '\\');
	temp = JSON.parse(temp);
	suffix = temp.suff;

	encoding = parser.get("Encoding");
	if (!encoding) {
		encoding = "utf-8";
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
