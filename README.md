# Mendix Workstation

## Pipeline

### How to run

Move to the directory containing the source code (with the node dependencies found on onedrive):
`cd ./.../.../mendix-temp125`
Then start the program:
`npm run start`

### How to debug

Open the directory in VS Code and use the default node.js debugger using Run script: Start configuration:  

![image](https://github.com/mendix-temp/mendix-temp125/assets/133011381/cd8b300a-bdde-4f03-aa81-6d18cd99d106)  

### How to make an executable

Move to the directory containing the source code (with the node dependencies found on onedrive):  
`cd ./.../.../mendix-temp125`  
Then run the make command:  
`npm run make`  

The executable can bu found at: `./out/make/Mendix Workstation-<version> Setup.exe`

### How to deploy for autoupdate

Make sure that all files are committed and pushed to the github repository

`git status`: show which files are going to be added to the commit  
`git add <fileName>` or `git add <folderName>: add the chosen file/folder to the next commit  
`git commit`: commit the files
`git push`: push the commited files to github repository  

Then, you need to go to log in the github repo and follow the following steps to set the last publish as the latest release (the one used by the autoupdate)  

<details>
  <summary><b>Steps</b></summary>
  <br>
   1.  
 
   ![Screenshot 2023-07-28 104513](https://github.com/mendix-temp/mendix-temp125/assets/133011381/11dd3380-3108-4f4e-8108-2af93dde4393)  

   2. 
   ![Screenshot 2023-07-28 104828](https://github.com/mendix-temp/mendix-temp125/assets/133011381/f100f8ce-6c18-48d3-bba3-79423be067f7)  

   3.
   ![Screenshot 2023-07-28 104931](https://github.com/mendix-temp/mendix-temp125/assets/133011381/a6f820a7-63f7-4485-ad03-378e98b660c3)  
</details>



### How to update version number

Change the "version" fields in package.json and package-lock.json to the correct number

### How to clone repository

Run the following command in the working directory to be to download the files:  
`git clone https://github.com/mendix-temp/mendix-temp125`  
Note that for privacy and technical reasons, the public github do not contain all the files needed to compile the application.  
The additional dependencies (forge.config.js and the node_modules folder) can be found in the shared onedrive. 

## Architecture

### High-level architecture

The utilization of the Mendix Workstation requires three components: the Workstation, the Workstation Management web service, and the Web Application. 

#### The Workstation

The Workstation is the main component. It is a native desktop application that runs client-side, not a Mendix client side runtime, is where the user interacts with the Web Application and is in charge of coordinating all 
the other components. 
It creates a connection with the peripherals so that they become available to any Mendix Web Application that contains the add-on module Workstation Connector, keeping the list of devices available in the Mendix 
Web Application updated and sending events when their status changes. It sends requests to the Workstation Manager to get the configuration of the current workstation. 

#### The Workstation Manager

The Workstation Manager is where a site administrator can decide which workstation (computer) has access to which devices and applications. The Devices are defined with a name, a logical class (scale, printer, ...), 
and a driver (Serial, TCP/IP, ...). Each type of driver has a list of properties that need to be filled to allow the connection to be created. The Applications are defined with a user friendly name and a URL. 

#### The Workstation Connector

The Workstation Connector is a Mendix Add-On Module that contains both Javascript code and Nanoflows that allow the communication with the local peripherals. It also provides a developer interface to easily 
respond to events coming from devices and handle incoming data. A list of [Template Applications](https://github.com/mendix-temp/mendix-temp125/blob/main/README.md#template-applications) has been created to give 
examples as to how the connector can be used.  

![image](https://github.com/mendix-temp/mendix-temp125/assets/133011381/f7840d20-c26b-4dcc-a863-24f937f9c31a)  
*High-level architecture overview*  

### Low-level architecture

#### The Workstation

The Mendix Workstation is built with the Electron.js framework. It is a native desktop application and is not a client-side mendix runtime. The main process of the application (main.js) handles the lifecycle of both 
the rendering (web content) and utility (device driver) processes and [Inter-Process Communication](https://www.electronjs.org/docs/latest/tutorial/ipc).  
The rendering processes take care of rendering the windows of the Workstation and run in a native javascript environment. They modify the visual interface depending on state and configuration.  
Utility processes run in node.js environment and include the drivers and the process used to communicate with the Workstation Connector. The drivers leverage existing node.js libraries (serialport, net, ...)
to streamline the development process and facilitate maintenance. Each driver connects to the device through a given protocol, decodes incoming message and sends them to the Web Application through a websocket, and 
receives messages from the Web Application through that same websocket, encodes it, and sends it to the device. 

#### The Workstation Manager

The Workstation Manager is a Mendix Web App running on a server that hosts a Rest API. This API gets the computer name from the URL parameter passed by the Workstation, gets the workstation configuration from the database if it 
exists, and returns a JSON file that either contains the configuration of the workstation, or a reason as to why the request failed and potentially an onboarding URL. This URL is to be used by the Workstation to show a 
workstation configuration wizard that is going to help the user create and configure a workstation on the server. 

#### The Workstation Connector

The Workstation Connector is a Mendix [Add-On Module](https://docs.mendix.com/refguide/module-settings/#add-on-module). Upon calling SUB_MXPConn_Init (called in DS_GetStation), the connector creates websockets with all
the available devices (those that have a websocket server on the Workstation side). It contains a library of nanoflows that can be used by a developper to perform simple tasks like connecting to a device, sending a 
message... Every time that a device receives a message, the nanoflow EVT_onMessage is triggered. The initialization process also creates a communication channel between the Workstation and the Connector through a 
websocket.  Messages sent from the Workstation contain a header that allows the Connector to determine what kind of data it receives (device list, device status update, error, ...)

## User Experience

When the user first opens the app, he is prompted for a username, a password, and the URL of the Workstation Management web service. A request is then sent to the web service service in the background.  
Multiple events may now take place: 
- If the computer of the user is recognized by the web service, then the configuration is received and processed by the Workstation and the user is ready to go.
- If the computer of the user is not recognized, the user will be redirected automatically to the Onboarding page of the web service. In that case, a wizard will guide him so that he can create and setup his workstation. 

The user is now ready to use the web browser to interact with his web applications. Web Apps can be opened by clicking on their name/icon in the list of applications on the left of the window. The settings can be
 accessed by clicking the "Settings" button in the bottom left of the window. The Settings window allows the user to close applications and to access some diagnostic tools. Such diagnstic tools include the option
to send and receive messages to/from devices in the "Device List" section and the option to refresh the configuration of the workstation ("Refresh Config"). The latter will close all open processes, prompt the web
service for a new configuration and restart the initialization process. 

### Additional information about Suffix settings in Serial and TCP/IP drivers

#### SuffixOutAwait

If a value for SuffixOutAwait is specified, the Workstation is going to buffer all incoming data from the web app until it receives the string specified in the
SuffixOutAwait field. Once received, all the buffer is sent directly to the device <b>without<b> the specified string.  

If unspecified, the Workstation is going to relay all the incoming messages from the web app to the devices one by one as they arrive. 

#### SuffixOutAdd

If a value for SuffixOutAdd is specified (for example a CRLF), the Workstation is going to add that suffix to every message that it sends to the devices. 

#### SuffixInRemove

If a value for SuffixInRemove is specified, the Workstation is going to buffer all the incoming data from the device until it receives the specified string (for 
example a CRLF). Once received, it is going to send the buffer to the web app <b>without<b> the specified suffix. 

If unspecified, the Workstation is going to relay all messages from the devices to the web app one by one as they arrive. This may mean that the messages will 
arrive character by character to the web app. 

## Mendix Developer Experience

The process of creating a Mendix Application interacting with local peripherals through the Workstation has been designed to be simple. Before any communication can take place with the devices, the nanoflow 
SUB_MXPConn_Init
needs to be called. The recommended approach is to have a data view with DS_GetStation as a datasource in the page and to select a device by association. It is also recommended to have exactly one DS_GetStation 
called on the page.  

Once this is setup, the developer simply needs to define how to react to events (message, websocket open, websocket error, ...) in the module StationInterface, and to connect to a device using the provided nanoflows. 
Then, the developer can use the SUB_Send_Message nanoflow to communicate with the devices. 

### Driver dependent message format
<details>
  <summary><b>Bluetooth BLE</b></summary>
  <br>
 
   Message to device:
  - 0#`ServiceUUID`#`CharacteristicUUID` : Subscribe to characteristic `CharacteristicUUID` from service `ServiceUUID`
  - 1#`ServiceUUID`#`CharacteristicUUID` : Unsubscribe from characteristic `CharacteristicUUID` from service `ServiceUUID`
  - 2#`ServiceUUID`#`CharacteristicUUID` : Read characteristic `CharacteristicUUID` from service `ServiceUUID`
  - 3#`ServiceUUID`#`CharacteristicUUID` : Write to characteristic `CharacteristicUUID` from service `ServiceUUID`

   Response from device: 
  - `CharacteristicUUID`#`Response`

## 
</details>

<details>
  <summary><b>PCSC Card Reader driver</b></summary>
  <br>
 
   Message to device:
  - Send instruction in hexadecimal as a string

   Response from device: 
  - 0# : Card connected
  - 1# : Card disconnected
  - 2#`Response` : `Response` from device as raw hexadecimal
  - 3#`Error` : `Error` message from device

## 
</details>

<details>
  <summary><b>File driver</b></summary>
  <br>
 
   Message to device:
  - 0#`Directory` : Watch for changes in `Directory` (if directory is a file path, then watch for changes in 
  - 1#`Directory` : Watch for changes in `Directory`  
  - 2#`File path` : Read file at `File path`
  - 3#`File path`#`flag` : Write to file at `File path`. `flag` can be 'w' for overwrite, 'a' for append, or empty ('w' by default)

   Response from device: 
  - R#`File name` : `File name` was renamed (also triggered when file is created and deleted)
  - C#`File name` : `File name` was changed
  - D#`Data` : `Data` from file read
  - E#`Error` : `Error` message from operating system

## 
</details>

## Template Applications

A multitude of template applications have been built to give examples as to how the connector can be used to connect to local devices.  
A non-exhaustive list of such applications can be found below: 
- StationSmartPrep
- Station Bluetooth Control
- Station Virtual Label Printer
- Station Printer Management
- Station Virtual Scale
- Station Scale Control
- Station Terminal

## Security

<p>The main purpose of the security model of the Workstation is to authenticate applications and users trying to access data, either from the devices or from the Workstation Management application, to ensure that no data leaks. To enforce this property, the Workstation Management application generates an access key for each web application that is assigned to a given station. These keys are sent to the Mendix Workstation when it asks the Workstation Management for the list of devices and applications (i.e. when it starts or when the config is manually reset by the user). <br>
  
Each web application that wants to communicate with the devices must have a secret that is shared with the Workstation Management. That secret is automatically generated by the Worstation Management and must be manually entered into the web Mendix Application. This secret is then used by the web application to request the access key from the Workstation Management through an encrypted REST request.<br>
  
Now, the web application and the Mendix Workstation share a secret access key. When a web application connects to a device, it must send this shared secret access key through the websocket before any communication can start.<br>
  
The security of the application relies on the fact that only an application that knows one of the secrets that is kept within the Mendix Workstation can access the devices. 
In case of a leak, these secrets can be individually reset in the Mendix Workstation to invalidate any future attempts to get the secret access key.<br> 

Moreover, the Mendix Workstation has a different private key that is used to generate the secret access keys. This key can be reset in the Mendix Workstation dashboard to invalidate any future attempt by a web application to communicate with devices through the Mendix Workstation (after the Mendix Workstation is restarted if it is already running). <br>

<ins>WARNING</ins>: The communications between the Mendix Workstation and the Web Application themselves are not encrypted for performance purposes. This means that it is only safe to use the application if the Mendix Workstation and the web application accessing the devices are running on the same device. If a web application running on a computer on the local network connects and authenticates itself to the websocket running on another computer on the local network, the secret access key and all future communications will be visible in plain text over the local network.  
<ins>Note:</ins> this behavior is not possible by default and is only possible through custom scripts. <br></p>

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
- `./src/login` contains both an html and a script that gather input from user (login, password, web service) to log into the Workstation Management app and get the workstation configuration.
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
- lines 533 -> 618: Handle all the logic around getting the configuration file from the Workstation Management web service
- lines 619 -> 729: Create the driver processes and a communication channel between them and the main process
- lines 730 -> end: Define functions that relay messages from driver utility process to process communicating with Workstation Connector so that it can relay the message to the Connector

#### overlay.js

- lines   3 -> 100: Define functions that will be used later in the program
- lines 101 -> 182: Send and receive messages to/from main process and perform necessary actions depending on message
- lines 183 -> end: React to 'click' events

#### renderer.js

- lines   7 -> 106: Define functions that will be used later in the program
- lines 107 -> 197: Send and receive messages to/from main process and perform necessary actions depending on message
- lines 198 -> end: React to 'click' events

