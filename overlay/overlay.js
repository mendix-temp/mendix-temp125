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
    // add other member variables if needed
    constructor(url, name) {
        this.url = url;
        this.name = name;
    }
}
function createMenu(menu) {
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
    var htmlInjection = '<div class="row">'
    for (i = 0; i < data.numApps; i++) {
        menu.addApp(new App(data.apps[i].url, data.apps[i].name))
        htmlInjection += 
        '<div class="column">' +
            '<button type="button" id=' + data.apps[i].name + '>' +
                data.apps[i].name +
            '</button>'
        '</div>'    
        if ((i + 1) % 3 == 0 && i !== 0) {
            htmlInjection += '</div>'
        }
    }
    document.getElementById('listItems').innerHTML = htmlInjection

    var buttons = document.getElementsByTagName("button");
    var buttonsCount = buttons.length;
    for (var i = 0; i < buttonsCount; i += 1) {
        buttons[i].onclick = function() {
            window.electronAPI.open_app(this.id, menu.getApp(this.id).url)
            document.getElementById(this.id).disabled = true
        };
    }
}

var menu = new Menu();
createMenu(menu);
