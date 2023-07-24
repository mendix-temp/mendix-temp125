const noble = require('@abandonware/noble');
var http = require('http'),
    WebSocketServer = require('ws').Server;

let device = JSON.parse(process.argv[2]);
let wsPort = device.websocket_port;
let deviceID = device.deviceID;
let deviceName = device.name;


let BLEDevice, broadcast, currentWSClient, webServer, wsServer = null;

let Services = null;



noble.on('stateChange', async (state) => {
  if (state === 'poweredOn') {
    console.log('scanning for BLE devices');
    await noble.startScanningAsync();
  }
});

noble.on('discover', async (peripheral) => {

  if (deviceName !== peripheral.advertisement.localName) {
    return;
  }
  // Found the right device
  BLEDevice = peripheral;
  noble.stopScanningAsync();
  await peripheral.connectAsync();
  Services = await peripheral.discoverServicesAsync();
  console.log(`Connected to ${peripheral.advertisement.localName} on ${peripheral.address}`);
  
  webServer = http.createServer();
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

  process.parentPort.postMessage({
    header: 'statusUpdate',
    deviceName: deviceName,
    deviceID: deviceID,
    newStatus: 'true',
    websocket_port: wsPort
  });
});

var new_client = function(webSocketClient, req)  {
  if (BLEDevice.state == 'disconnected') {
    BLEDevice.connectAsync();
  }
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

  // Receive data from WebSocket client and send request to BLE
	webSocketClient.on('message', async function(msg) {
    let instructions = msg.toString().split('#');
    let newCharacteristic;
    let cleanServUUID = instructions[1].split('-').join('').toLowerCase();
    Services.forEach(async function(srv) {
      if (srv.uuid == cleanServUUID) {
        newCharacteristic = await srv.discoverCharacteristicsAsync([instructions[2]]);
        newCharacteristic = newCharacteristic[0];
        switch (instructions[0]) {
          // Subscribe
          case '0': {
            console.log('WebSocket to BLE request: subscribe to characteristic ' + instructions[2] + ' from service ' + instructions[1]);
            newCharacteristic.subscribe();

            newCharacteristic.on('data', function(data, isNotification) {
              if (broadcast && wsServer.clients.length > 0) {
                wsServer.clients.forEach((client) => {
                  client.send(this.uuid + '#' + data.toString('hex'));
                });
              }
              else if (currentWSClient) {
                currentWSClient.send(this.uuid + '#' + data.toString('hex'));
              }
            }.bind(newCharacteristic));
          }
          break;
        
        // Unsubscribe
        case '1':
          console.log('WebSocket to BLE request: Unsubscribe from characteristic ' + instructions[2] + ' from service ' + instructions[1]);
          newCharacteristic.unsubscribe();
          break;
        
        // Read
        case '2':
          console.log('WebSocket to BLE request: read from characteristic ' + instructions[2] + ' from service ' + instructions[1]);
          newCharacteristic.read(function(error, data) {
            if (!error) {
              wsServer.clients.forEach((client) => {
                client.send(this.uuid + '#' + data.toString('hex'));
              });
            }
          }.bind(newCharacteristic));
          break;

        // Write
        case '3':
          console.log('WebSocket to BLE request: write to characteristic ' + instructions[2] + ' from service ' + instructions[1]);
          newCharacteristic.write(Buffer.from(instructions[3], 'hex'), false, function(error) {
            if (error) {
              console.log(error);
            }
          });
          newCharacteristic.once('data', (data) => {
            console.log(data);
          });
          break;
        
        // Unknown
        default:
          break;
        }
      }
    });
  });
	webSocketClient.on('close', function (code, reason) {
		console.log('WebSocket client disconnected: ' + code + ' [' + reason + ']');
		if (code !== 4000) {
			currentWSClient = null;
		}
	});
	webSocketClient.on('error', function (err) {
		console.log('WebSocket client error: ' + err);
        if (webSocketClient.readyState == webSocketClient.OPEN) {
            webSocketClient.close();
        }
	});
}