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
	certificate_path, key_path,
	argv = null;

var usedPort = new Set();

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
	var webSocketClientAddr = webSocketClient._socket.remoteAddress;

	console.log(req ? req.url : webSocketClient.upgradeReq.url);
	console.log('WebSocket connection from :'  + webSocketClientAddr);
	console.log('Version ' + webSocketClient.protocolVersion + ', subprotocol: ' + webSocketClient.protocol);

    var serialClient = new SerialPort({
        path: serialPort,
        baudRate: parseInt(serialBitRate),
        dataBits: parseInt(serialDataBits),
        parity: serialParity.toLowerCase(),
        stopBits: parseInt(serialStopBits),
        flowControl: (serialFlowControl.toLowerCase() == "none") ? false : true
    });

    var buffer = "";

	// Receive data from Serial client and send to WebSocket client
	serialClient.on('data', function (data) {
		try {
            // TODO: might need to add option to change separator
            buffer += data.toString();
            var lines = buffer.split('\n');
            while (lines.length > 1) {
                msg = lines.shift();
                console.log('Serial to WebSocket message: ' + msg);
                webSocketClient.send(msg);
            }
            buffer = lines.join('\n');
		} catch (e) {
			console.log('WebSocket client error, ending Serial client');
			serialClient.close();
		}
	});
	serialClient.on('close', function() {
		console.log('Serial client disconnected');
		webSocketClient.close();
	});
	serialClient.on('error', function(err) {
		console.log('Serial client error: ' + err);
		webSocketClient.close();
	});

	// Receive data from WebSocket client and send to Serial client
	webSocketClient.on('message', function(msg) {
		console.log('WebSocket to Serial message: ' + msg);
		// TODO: add suffix option
		serialClient.write(msg + '\r\n', 'ascii');
	});
	webSocketClient.on('close', function (code, reason) {
		console.log('WebSocket client disconnected: ' + code + ' [' + reason + ']');
		serialClient.close();
	});
	webSocketClient.on('error', function (err) {
		console.log('WebSocket client error: ' + err);
        if (webSocketClient.readyState == webSocketClient.OPEN) {
            webSocketClient.close();
        }
		serialClient.close();
	});
};

// Create WebSocket server and supports both http and https
function initWsServer() {
	wsPort = process.argv[2];
	serialPort = process.argv[3];
	serialBitRate = process.argv[4];
    serialDataBits = process.argv[5];
    serialParity = process.argv[6];
    serialStopBits = process.argv[7];
    serialFlowControl = process.argv[8];
	certificate_path = process.argv[9];
	key_path = process.argv[10];

	// TODO: Do we need multi user functionality?
    if (usedPort.has(serialPort)) {
        console.log(serialPort + "already in use");
        return;
    }
    usedPort.add(serialPort);

	if (certificate_path !== 'null') {
		// If there is a key, use the key, otherwise, use the certificate
		// Why? Ask Stephane
		key = key || certificate;
		var cert = fs.readFileSync(certificate),
			key = fs.readFileSync(key);
		webServer = https.createServer({cert: cert, key: key}, http_request);
	}
	else {
		webServer = http.createServer(http_request);
	}
	webServer.listen(wsPort, function() {
		wsServer = new WebSocketServer({server: webServer});
		wsServer.on('connection', new_client);
	});
}
initWsServer();
