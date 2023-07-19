# Mendix Player

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

## User Experience

When the user first opens the app, he is prompted for a username, a password, and the URL of the Station Management web service. A GET request is then sent to the web service service in the background.  
Multiple events may now take place: 
- If the computer of the user is recognized by the web service, then the configuration is received and processed by the player and the user is ready to go.
- If the computer of the user is not recognized, the user will be redirected automatically to the Onboarding page of the web service. In that case, a wizard will guide him so that he can create and setup his station.  

The user is now ready to use the web browser to interact with his web applications. Web Apps can be opened by clicking on their name/icon in the list of applications on the left of the window. The settings can be
 accessed by clicking the "Settings" button in the bottom left of the window. The Settings window allows the user to close applications and to access some diagnostic tools. Such diagnstic tools include the option
to send and receive messages to/from devices in the "Device List" section and the option to refresh the configuration of the station ("Refresh Config"). The latter will close all open processes, prompt the web
service for a new configuration and restart the initialization process. 

## Architecture

### High-level architecture

The utilization of the Mendix Player requires three components: the Player, the Station Management web service, and the Web Application. 

#### The Player

The player is the main component. It is a native desktop application that runs client-side, is where the user interacts with the Web Application and is in charge of coordinating all the other components. 
It creates a connection with the peripherals so that they become available to any Mendix Web Application that contains the add-on module Station Connector, keeping the list of devices available in the Mendix 
Web Application updated and sending events when their status changes. It sends requests to the Station Manager to get the configuration of the current station. 

#### The Station Manager

The Station Manager is where a site administrator can decide which station (computer) has access to which devices and applications. The Devices are defined with a name, a logical class (scale, printer, ...), 
and a driver (Serial, TCP/IP, ...). Each type of driver has a list of properties that need to be filled to allow the connection to be created. The Applications are defined with a user friendly name and a URL. 

#### The Station Connector

The Station Connector is a Mendix Add-On Module that contains both Javascript code and Nanoflows that allow the communication with the local peripherals. It also provides a developer interface to easily 
respond to events coming from devices and handle incoming data. A list of [Template Application](https://github.com/mendix-temp/mendix-temp125/edit/main/README.md#template-applications) has been created to give examples as to how the connector can be used. 


![High-level architecture](https://github.com/mendix-temp/mendix-temp125/assets/133011381/41c2c959-5b48-476f-91da-a967e37e0a36)


### Low-level architecture



## Mendix Developer Experience

### Template Applications


