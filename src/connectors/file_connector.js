var http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),

	mime = require('mime'),
	WebSocketServer = require('ws').Server,

	webServer, wsServer, wsPort,
    deviceName, deviceID = null;


// Data structures:

// Map of directories (folder path) to <fs.FSWatcher> (event emitter)
let directoryToWatcher = new Map();

// Map of <fs.FSWatcher> to set of WebSocketClients
let watcherToWSClients = new Map();

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
	deviceName = device.name;

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

// handle connection from a new client
var new_client = function(webSocketClient, req) {
    console.log('Connection to file driver on port ' + wsPort);
    webSocketClient.on('message', function(msg) {
        // instructions[0]: instruction type
        // instructions[1]: directory (file path)
        // instructions[2]: data (for write instruction)
        // instructions[3]: flag (for write instruction)
        let instructions = msg.toString().split('#');
        switch (instructions[0]) {
            // Subscribe
            case '0': {
                console.log('Watching directory ' + instructions[1]);
                // There already exists a watcher on that directory
                if (directoryToWatcher.has(instructions[1])) {
                    // Set of <WebSocket> that are watching that directory
                    watcherToWSClients.get(directoryToWatcher.get(instructions[1])).add(webSocketClient);
                    this.send('S#0#' + instructions[1]);
                }
                // Otherwise, create watcher
                else {
                    try {
                        let watcher = fs.watch(instructions[1], 'utf-8', function(eventType, filename) {
                            switch (eventType[0]) {
                                // change
                                case 'c': {
                                    watcherToWSClients.get(this).forEach((client) => {
                                        client.send('C#' + filename);
                                    });
                                }
                                break;
                                // rename (also triggered on creation and deletion)
                                case 'r': {
                                    watcherToWSClients.get(this).forEach((client) => {
                                        client.send('R#' + filename);
                                    });
                                }
                                break;
                            } 
                        });
                        directoryToWatcher.set(instructions[1], watcher);
                        watcherToWSClients.set(watcher, new Set([this]));
                        this.send('S#0#' + instructions[1]);
                    } catch (error) {
                        webSocketClient.send('E#')
                        console.log(error);
                        // TODO: handle error
                    }
                }
            }
            break;
            // Unsubscribe
            case '1': {
                console.log('Unwatching directory ' + instructions[1]);
                try {
                    if (!directoryToWatcher.has(instructions[1])) {
                        this.send('E#DirectoryNotWatched');
                    }
                    else {
                        let watcher = directoryToWatcher.get(instructions[1]);
                        if (!watcherToWSClients.has(watcher)) {
                            this.send('E#DirectoryNotWatched');
                        }
                        else {
                            let clients = watcherToWSClients.get(watcher);
                            clients.delete(this);
                            this.send('S#1#' + instructions[1]);
                            if (clients.length == 0) {
                                directoryToWatcher.delete(instructions[1]);
                                watcher.close();
                            }
                        }
                    }
                } catch (error) {
                    this.send('E#' + error);
                }
            }
            break;
            // Read
            case '2': {
                console.log('Reading file ' + instructions[1]);
                try {
                    this.send('D#' + fs.readFileSync(instructions[1]));
                    this.send('S#2#' + instructions[1]);
                } catch (error) {
                    this.send('E#' + error);
                }
            }
            break;
            // Write
            case '3': {
                console.log('Writing to file ' + instructions[1]);
                try {
                    if (instructions.length == 4) {
                        fs.writeFileSync(instructions[1], instructions[2], { flag: instructions[3] });
                    }
                    else {
                        fs.writeFileSync(instructions[1], instructions[2]);
                    }
                    this.send('S#3#' + instructions[1]);
                } catch (error) {
                    this.send('E#' + error);
                }
            }
            break;
            // Unknown
            default:
                break;
        }
    });

    webSocketClient.on('close', function (code, reason) {
        console.log('TODO: handle close')
    });

    webSocketClient.on('error', function (err) {
        console.log('File driver error: ' + err);
    })
}
initWsServer();
