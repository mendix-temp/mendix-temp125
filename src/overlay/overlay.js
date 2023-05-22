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

let menu;

// data in the following format:
// [{"name": ..., "url": ...}, {"name": ..., "url": ...}, ...]
function createMenu(data) {
    // Generate buttons in overlay
    var menu = new Menu();
    document.getElementById('listItems').innerHTML += '<div class="row" id="row_0"></div>'
    for (i = 0; i < data.length; i++) {
        menu.addApp(new App(data[i].url, data[i].name))
        document.getElementById("row_" + Math.floor(i / 3).toString()).innerHTML += 
        /*'<div class="column">' +
            '<button onclick="buttonFunction(this, menu)" type="button" id=' + data[i].name + '>' +
                data[i].name +
            '</button>'
        '</div>'*/
        '<div class="column">' +
            '<button onclick="buttonFunction(this)" type="button" id=' + data[i].name + ' data-url="' + data[i].url + '">' +
                data[i].name +
            '</button>'
        '</div>'
        //button = document.getElementById(data[i].name);
        //button.addEventListener("click", buttonFunction);
        if ((i + 1) % 3 == 0 && i !== 0 && (i + 1) < data.length) {
            document.getElementById('listItems').innerHTML += 
            '<div class="row" id="row_' + ((i + 1) / 3).toString() +'"></div>'
        }
    }
}

window.electronAPI.handle_json((event, jsonData) => {
    menu = createMenu(JSON.parse(jsonData));
});

console.log(10)