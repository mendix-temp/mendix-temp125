# Mendix Player

## Architecture

### High-level architecture

The utilization of the Mendix Player requires three components: the Player, the Station Management web service, and the Web Application. 

#### The Player

The player is the main component. It is a native desktop application that runs client-side, not a Mendix client side runtime, is where the user interacts with the Web Application and is in charge of coordinating all 
the other components. 
It creates a connection with the peripherals so that they become available to any Mendix Web Application that contains the add-on module Station Connector, keeping the list of devices available in the Mendix 
Web Application updated and sending events when their status changes. It sends requests to the Station Manager to get the configuration of the current station. 

#### The Station Manager

The Station Manager is where a site administrator can decide which station (computer) has access to which devices and applications. The Devices are defined with a name, a logical class (scale, printer, ...), 
and a driver (Serial, TCP/IP, ...). Each type of driver has a list of properties that need to be filled to allow the connection to be created. The Applications are defined with a user friendly name and a URL. 

#### The Station Connector

The Station Connector is a Mendix Add-On Module that contains both Javascript code and Nanoflows that allow the communication with the local peripherals. It also provides a developer interface to easily 
respond to events coming from devices and handle incoming data. A list of [Template Applications](https://github.com/mendix-temp/mendix-temp125/blob/main/README.md#template-applications) has been created to give 
examples as to how the connector can be used.  

![image](https://github.com/mendix-temp/mendix-temp125/assets/133011381/f7840d20-c26b-4dcc-a863-24f937f9c31a)  
*High-level architecture overview*  

### Low-level architecture

#### The Player

The Mendix Player is built with the Electron.js framework. It is a native desktop application and is not a client-side mendix runtime. The main process of the application (main.js) handles the lifecycle of both 
the rendering (web content) and utility (device driver) processes and [Inter-Process Communication](https://www.electronjs.org/docs/latest/tutorial/ipc).  
The rendering processes take care of rendering the windows of the Player and run in a native javascript environment. They modify the visual interface depending on state and configuration.  
Utility processes run in node.js environment and include the drivers and the process used to communicate with the Station Connector. The drivers leverage existing node.js libraries (serialport, net, ...)
to streamline the development process and facilitate maintenance. Each driver connects to the device through a given protocol, decodes incoming message and sends them to the Web Application through a websocket, and 
receives messages from the Web Application through that same websocket, encodes it, and sends it to the device. 

#### The Station Manager

The Station Manager is a Mendix Web App running on a server that hosts a Rest API. This API gets the computer name from the URL parameter passed by the Player, gets the station configuration from the database if it 
exists, and returns a JSON file that either contains the configuration of the station, or a reason as to why the request failed and potentially an onboarding URL. This URL is to be used by the player to show a 
station configuration wizard that is going to help the user create and configure a station on the server. 

#### The Station Connector

The Station Connector is a Mendix [Add-On Module](https://docs.mendix.com/refguide/module-settings/#add-on-module). Upon calling SUB_MXPConn_Init (called in DS_GetStation), the connector creates websockets with all
the available devices (those that have a websocket server on the Player side). It contains a library of nanoflows that can be used by a developper to perform simple tasks like connecting to a device, sending a 
message... Every time that a device receives a message, the nanoflow EVT_onMessage is triggered. The initialization process also creates a communication channel between the Player and the Connector through a 
websocket.  Messages sent from the player contain a header that allows the Connector to determine what kind of data it receives (device list, device status update, error, ...)

## User Experience

When the user first opens the app, he is prompted for a username, a password, and the URL of the Station Management web service. A request is then sent to the web service service in the background.  
Multiple events may now take place: 
- If the computer of the user is recognized by the web service, then the configuration is received and processed by the player and the user is ready to go.
- If the computer of the user is not recognized, the user will be redirected automatically to the Onboarding page of the web service. In that case, a wizard will guide him so that he can create and setup his station. 

The user is now ready to use the web browser to interact with his web applications. Web Apps can be opened by clicking on their name/icon in the list of applications on the left of the window. The settings can be
 accessed by clicking the "Settings" button in the bottom left of the window. The Settings window allows the user to close applications and to access some diagnostic tools. Such diagnstic tools include the option
to send and receive messages to/from devices in the "Device List" section and the option to refresh the configuration of the station ("Refresh Config"). The latter will close all open processes, prompt the web
service for a new configuration and restart the initialization process. 

## Mendix Developer Experience

The process of creating a Mendix Application interacting with local peripherals through the Player has been designed to be simple. Before any communication can take place with the devices, the nanoflow 
SUB_MXPConn_Init
needs to be called. The recommended approach is to have a data view with DS_GetStation as a datasource in the page and to select a device by association. It is also recommended to have exactly one DS_GetStation 
called on the page.  

Once this is setup, the developer simply needs to define how to react to events (message, websocket open, websocket error, ...) in the module StationInterface, and to connect to a device using the provided nanoflows. 
Then, the developer can use the SUB_Send_Message nanoflow to communicate with the devices. 

### Template Applications

A multitude of template applications have been built to give examples as to how the connector can be used to connect to local devices.  
A non-exhaustive list of such applications can be found below: 
- StationSmartPrep
- Station Bluetooth Control
- Station Virtual Label Printer
- Station Printer Management
- Station Virtual Scale
- Station Scale Control
- Station Terminal



## Code Organization

Before going in details about the organization of the code, here is some basic information about Electron.js.  
Electron.js uses the [Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model).
In a few words, Electron.js apps have a main process that handles window management and the application's lifecycle and is the entry point to the application. This main process can spawn two types of processes:  
- Renderer processes
- Utility processes

Renderer processes run in a native Javascript environment with access to some of the Electron.js API and are used to display web contents.
Utility processes run in a node.js environment and are used to host CPU intensive tasks and crash prone components.

Back to the organization of the code. The main process can be found at `./src/main.js`, renderer processes in `./src/main_window`, ./src/login, and `./src/overlay`, and utility processes in `./src/connectors`.  
### Quick explanation of functionality of processes
- `./src/connectors` holds the library of drivers. They are utility processes spawned by the main process during the initialization of the app.
- `./src/error` contains a simple html file that is displayed when an error occurs during connection to a Web Application
- `./src/login` contains both an html and a script that gather input from user (login, password, web service) to log into the Station Management app and get the station configuration.
- `./src/main_window` holds the necessary files to render the main window of the application (the one that displays the Web Apps to the user)
- `./src/overlay` holds the necessary files to render the settings window.

### Files walkthrough

Every large file is separated into logical parts separated by large headers. Such headers include function definition, IPC, ...

#### main.js

- lines   0 -> 22: Import libraries
- lines  23 ->  49: Define global data structures used later in the program
- lines  50 -> 124: Create main window and start all rendering processes
- lines 125 -> 181: Define functions used later in the program
- lines 182 -> 454: Handle communication between the main process and the rendering processes
- lines 455 -> 532: Handle events triggered by windows (resize, ready-to-show, ...)
- lines 533 -> 618: Handle all the logic around getting the configuration file from the Station Management web service
- lines 619 -> 729: Create the driver processes and a communication channel between them and the main process
- lines 730 -> end: Define functions that relay messages from driver utility process to process communicating with Station Connector so that it can relay the message to the Connector

#### overlay.js

- lines   3 -> 100: Define functions that will be used later in the program
- lines 101 -> 182: Send and receive messages to/from main process and perform necessary actions depending on message
- lines 183 -> end: React to 'click' events

#### renderer.js

- lines   7 -> 106: Define functions that will be used later in the program
- lines 107 -> 197: Send and receive messages to/from main process and perform necessary actions depending on message
- lines 198 -> end: React to 'click' events

# TODO: explain drivers
