// Data structure to store app data
class Menu {
    constructor() {
      this.numApps = 0;
      this.apps = new Map();
    }
    
    addApp(app) {
        this.numApps++;
        this.apps.set(app.name, app);
    }

    getApp(name) {
        return this.apps.get(name);
    }
}

class App {
    constructor(url, name) {
        this.url = url;
        this.name = name;
    }
}

function createMenu(data) {
    // Generate buttons in overlay
    document.getElementById('listItems').innerHTML += '<div class="row" id="row_0"></div>'
    for (i = 0; i < data.length; i++) {
        menu.addApp(new App(data[i].url, data[i].name))
        document.getElementById("row_" + Math.floor(i / 3).toString()).innerHTML += 
        '<div class="column">' +
            '<button onclick="buttonFunction(this, menu)" type="button" id=' + data[i].name + '>' +
                data[i].name +
            '</button>'
        '</div>'    
        if ((i + 1) % 3 == 0 && i !== 0 && (i + 1) < data.length) {
            document.getElementById('listItems').innerHTML += 
            '<div class="row" id="row_' + ((i + 1) / 3).toString() +'"></div>'
        }
    }
}

function buttonFunction(button, menu) {
    window.electronAPI.open_app(button.id, menu.getApp(button.id).url)
    document.getElementById(button.id).disabled = true
}

window.electronAPI.handle_json((event, jsonData) => {
    console.log(JSON.parse(jsonData))
    createMenu(JSON.parse(jsonData))
})

var menu = new Menu();
