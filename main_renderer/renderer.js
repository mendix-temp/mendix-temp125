class Menu {
    constructor() {
      this.numApps = 0;
      this.apps = new Map();

      this.recent = new Set();
    }
    
    addApp(app) {
        this.numApps++;
        this.apps.set(app.name, app);
    }

    addRecent(name) {
        this.recent.add(name)
    }

    isRecent(name) {
        return this.recent.has(name)
    }

    getApp(name) {
        return this.apps.get(name);
    }
}
let menu = new Menu()

class App {
    // add other member variables if needed
    constructor(url, name) {
        this.url = url;
        this.name = name;
    }
}
function readAppData() {
    // change this to fetch once web service is available
    var data = {
        "numApps": "2",
        "apps": [
            {
                "name": "google",
                "url": "https://google.com"
            },
            {
                "name": "github",
                "url": "https://github.com"
            }
        ]
    }

    for (i = 0; i < data.numApps; i++) {
        menu.addApp(new App(data.apps[i].url, data.apps[i].name))
    }
}

function openOverlay() {
    window.electronAPI.open_overlay()
}

window.electronAPI.add_menu_item((event, name) => {
    if (!menu.isRecent(name)) {
        document.getElementById('menuElts').innerHTML += 
        '<div class="row">' +
            '<button class="menuBtn" id="' + name + '">' + name + '</button>' +
        '</div>'
        menu.addRecent(name)

        
        //TODO: kinda inefficient, change with better solution
        var buttons = document.getElementsByClassName("menuBtn");
        var buttonsCount = buttons.length;
        for (var i = 0; i < buttonsCount; i += 1) {
            buttons[i].onclick = function() {
                window.electronAPI.switch_app(this.id)
            };
        } 
    }
})



readAppData();
document.getElementById('button_1').addEventListener('click', openOverlay) 