var net = require('net'),
	http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),

	mime = require('mime'),
	WebSocketServer = require('ws').Server,
	WebSocket = require('ws'),

	webServer, wsServer, buffer,
	wsPort, deviceID,
	tcpHost, tcpPort, tcpServer, suffix,
	argv = null;

var currentWS, currentTCPSocket = null;

var buffer = '';
var TCPSockets = new Set();

// Handle new WebSocket client
var new_client = function (webSocketClient, req) {
	var webSocketClientAddr = webSocketClient._socket.remoteAddress, log;
	console.log(req ? req.url : webSocketClient.upgradeReq.url);
	console.log('WebSocket connection from : ' + webSocketClientAddr);
	console.log('Version ' + webSocketClient.protocolVersion + ', subprotocol: ' + webSocketClient.protocol);
	
	if (currentWS && currentWS.readyState !== WebSocket.CLOSED) {
		currentWS.close();
	}
	currentWS = webSocketClient;

	currentWS.on('message', function (msg) {
		console.log('WebSocket to TCP message: ' + msg);
		currentTCPSocket.write(msg + suffix, encoding);
	});
	currentWS.on('close', function (code, reason) {
		console.log('WebSocket client disconnected: ' + code + ' [' + reason + ']');
	});
	currentWS.on('error', function (err) {
		console.log('WebSocket client error: ' + err);
	});
};

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
	webServer.listen(wsPort, function () {
		wsServer = new WebSocketServer({ server: webServer });
		wsServer.on('connection', new_client);
	});
	webServer.on('error', (e) => {
		console.log(e);
		process.parentPort.postMessage({
			error: e,
			deviceID: deviceID
		});
	});

	tcpServer = net.createServer();
	tcpServer.listen(tcpPort, tcpHost);
	tcpServer.on('connection', function (tcpSocket) {
		console.log('TCP client connected');
		if (currentTCPSocket && currentTCPSocket.readyState != 'opening') {
			
			currentTCPSocket.destroy();
		}
		currentTCPSocket = tcpSocket;

		currentTCPSocket.on('data', function (data) {
			if (suffix) {
				buffer += data.toString();
				var lines = buffer.split(suffix);
				while (lines.length > 1) {
					msg = lines.shift();
					console.log('TCP to WebSocket message: ' + data.toString() + ' on port: ' + wsPort);
					currentWS.send(msg);
				}
				buffer = lines.join(suffix);
			}
			else {
				console.log('TCP to WebSocket message: ' + data.toString() + ' on port: ' + wsPort);
				currentWS.send(msg);
			}
		});

		currentTCPSocket.on('end', function () {
			console.log('TCP client disconnected');
		});

		currentTCPSocket.on('error', function (err) {
			console.log('TCP client connection error: ' + err);
		});
	});
}
initWsServer();
