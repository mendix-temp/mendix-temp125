# Mendix Player

## Code Organization

Before going in details about the organization of the code, here is some basic information about Electron.js.  
Electron.js uses the [Process Model]([https://duckduckgo.com](https://www.electronjs.org/docs/latest/tutorial/process-model)https://www.electronjs.org/docs/latest/tutorial/process-model).
In a few words, Electron.js apps have a main process that handles window management and the application's lifecycle and is the entry point to the application. This main process can spawn two types of processes:  
- Renderer processes
- Utility processes
Renderer processes run in a native Javascript environment with access to some of the Electron.js API and are used to display web contents.
Utility processes run in a node.js environment and are used to host CPU intensive tasks and crash prone components.

Back to the organization of the code. The main process can be found at ./src/main.js 

## User Experience

## Architecture


