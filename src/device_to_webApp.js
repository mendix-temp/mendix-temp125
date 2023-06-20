const WebSocket = require('ws');

var http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),
    mime = require('mime'),
	WebSocketServer = require('ws').Server;

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

// Create webServer and WebSocket server to allow communication
// between player and 
let wsServer;
let webServer = http.createServer(http_request);

let devices = "[]";

wsServer = new WebSocketServer({
	server: webServer,
	clientTracking: true
});

let originToWS = new Map();
// process.argv[2] is the WebSocket port
webServer.listen(process.argv[2], function() {
    wsServer.on('connection', function(wsc, httpRequest) {
		// Check if websocket connection already exist from origin
		if (originToWS.has(httpRequest.headers.origin)) {
			originToWS.get(httpRequest.headers.origin).close();
			originToWS.delete(httpRequest.headers.origin);
		}
		originToWS.set(httpRequest.headers.origin, wsc);

        wsc.on('message', function(data) {
            if (data == 'get_device_list') {
                console.log("Sending device list to web App.");
                wsc.send(JSON.stringify({
					header: "devices",
					data: devices
				}));
            }
            else {
                console.log("Received: " + data);
                console.log("Not sending data to web App.");
            }
        });
		// TODO: error handling
		wsc.on('error', function(err) {
			console.log('WebSocket client with webapp error: ' + err);
			webSocketClient.close();
		});
		wsc.on('close', function() {
			wsServer.clients.delete(this);
		});
    });
    // TODO: error handling
    webServer.on('error', (e) => {
		console.log(e);
	});
});

// send data to MXConn from main.js
process.parentPort.on('message', (message) => {
	if (message.data.header === 'deviceListUpdate') {
		console.log("Updated device list locally.");
		devices = JSON.parse(message.data.deviceList);
		return;
	}
	else if (message.data.header === 'error') {
		devices[message.data.deviceID].connected = "false";
		console.log("Sending deviceError to web App.");
		wsServer.clients.forEach(client => {
			if (client.readyState == WebSocket.OPEN) {
				client.send(JSON.stringify(message.data));
			}
		});
		return;
	}
});
