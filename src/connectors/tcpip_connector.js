const { Certificate } = require('crypto');

var net = require('net'),
	http = require('http'),
	https = require('https'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),

	mime = require('mime'),
	WebSocketServer = require('ws').Server,

	webServer, wsServer,
	wsHost, wsPort, tcpHost, tcpPort,
	argv = null;

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
	var webSocketClientAddr = webSocketClient._socket.remoteAddress, log;

	console.log(req ? req.url : webSocketClient.upgradeReq.url);
	console.log('WebSocket connection from :'  + webSocketClientAddr);
	console.log('Version ' + webSocketClient.protocolVersion + ', subprotocol: ' + webSocketClient.protocol);

	var tcpClient = net.createConnection(tcpPort,tcpHost, function() {
		console.log('Connected to TCP server ' + tcpHost + ':' + tcpPort);
	});

	// Receive data from TCP client and send to WebSocket client
	tcpClient.on('data', function (data) {
		console.log('TCP to WebSocket message: ' + data.toString());
		try {
			webSocketClient.send(data.toString());
		} catch (e) {
			console.log('WebSocket client error, ending TCP client');
			tcpClient.end();
		}
	});
	tcpClient.on('end', function() {
		console.log('TCP client ' + tcpHost + ':' + tcpPort + ' disconnected');
		webSocketClient.close();
	});
	tcpClient.on('error', function(err) {
		console.log('TCP client error: ' + err);
		tcpClient.end();
		webSocketClient.close();
	});

	// Receive data from WebSocket client and send to TCP client
	webSocketClient.on('message', function(msg) {
		console.log('WebSocket to TCP message: ' + msg);
		// TODO: add suffix option
		tcpClient.write(msg + '\r\n', 'ascii');
	});
	webSocketClient.on('close', function (code, reason) {
		console.log('WebSocket client disconnected: ' + code + ' [' + reason + ']');
		tcpClient.end();
	});
	webSocketClient.on('error', function (err) {
		console.log('WebSocket client error: ' + err);
		webSocketClient.close();
		tcpClient.end();
	});
};

// TODO: add certificate capabilities
function initWsServer() {
	wsPort = process.argv[2];
	tcpHost = process.argv[3];
	tcpPort = process.argv[4];

	webServer = http.createServer(http_request);
	webServer.listen(wsPort, function() {
		wsServer = new WebSocketServer({server: webServer});
		wsServer.on('connection', new_client);
	});
}
initWsServer();
