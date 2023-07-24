let sideMenuOpen = true;
let menuOpenable = true;

let currentAppName = "";

let windowID;
/*##################################################################################/*
---------------------------------FUNCTION DEFINITION--------------------------------
/*##################################################################################*/

function openOverlay() {
    window.electronAPI.open_overlay(windowID);
}

// Input: boolean
// true = open menu
// false = close menu
function toggleSideMenu(open) {
    if (open) {
        // Change add app and minimize buttons by full name
        document.getElementById('minimizeButton').innerHTML = '<span class="material-symbols-outlined">menu</span>' +
                                                              '<div>Minimize</div>';
        document.getElementById('settingsButton').innerHTML = '<span class="material-symbols-outlined">settings</span>' +
                                                              '<div>Settings</div>';

        // Resize side menu
        document.getElementsByClassName('column-1')[0].style.width = '16.67%';
        document.getElementsByClassName('column-2')[0].style.width = '83.33%';

        // Change all side menu buttons
        var open = document.getElementsByClassName('menuItemOpen');
        for (i = 0; i < open.length; i++) {
            open[i].setAttribute('style', 'display:flex;');
        }
        var closed = document.getElementsByClassName('menuItemClosed');
        for (i = 0; i < open.length; i++) {
            closed[i].setAttribute('style', 'display:none;');
        }
    }
    else {
        // Change add app and minimize buttons by icons
        document.getElementById('minimizeButton').innerHTML = 
        '<span class="material-symbols-outlined">' +
            'menu' +
        '</span>';
        document.getElementById('settingsButton').innerHTML = 
        '<span class="material-symbols-outlined">' +
            'settings' +
        '</span>';

        // Resize side menu
        document.getElementsByClassName('column-1')[0].style.width = '50px';
        document.getElementsByClassName('column-2')[0].style.width = 
        (document.getElementsByTagName('body')[0].clientWidth - 50).toString() + 'px';

        // Change all side menu buttons
        var open = document.getElementsByClassName('menuItemOpen');
        for (i = 0; i < open.length; i++) {
            open[i].setAttribute('style', 'display:none;');
        }
        var closed = document.getElementsByClassName('menuItemClosed');
        for (i = 0; i < open.length; i++) {
            closed[i].setAttribute('style', 'display:flex;');
        }
    }
    window.electronAPI.toggle_side_menu(windowID);
}

function openApp(appName, appURL) {
    window.electronAPI.open_app(appName, appURL, windowID);
    document.getElementById(appName + '_open').setAttribute('onclick', "switchApp(this.dataset.name)");
    document.getElementById(appName + '_closed').setAttribute('onclick', "switchApp(this.dataset.name)");
}

function switchApp(appName) {
    window.electronAPI.switch_app(appName, windowID);
}

// Add buttons in left menu
function addMenuItem(name, url_app) {
    if (sideMenuOpen && menuOpenable) {
        document.getElementById('menuElts').innerHTML += 
        '<button class="menuItemOpen" id="' + name + '_open" class="menuItemOpen" onclick="javascript:openApp(this.dataset.name, this.dataset.url)" data-name="' + name + '" data-url="' + url_app + '">' + 
            '<img class="menuIcon" src="' + url_app +'/favicon.ico" onerror="this.onerror=null; this.src=' + "'./question_mark.svg'" + '">' +
            '<div class="menuText">' + name + '</div>' + 
            '<span id="' + name + '_open_status" class="material-symbols-outlined"></span>' +
        '</button>' +
        '<button class="menuItemClosed" id="' + name + '_closed" onclick="javascript:openApp(this.dataset.name, this.dataset.url)" data-name="' + name + '" data-url="' + url_app + '" style="display:none">' + 
            '<img class="menuIconClosed" src="' + url_app +'/favicon.ico" onerror="this.onerror=null; this.src=' + "'./question_mark.svg'" + '">' +
            '<span id="' + name + '_closed_status" class="material-symbols-outlined"></span>' +
        '</button>';
    }
    else {
        document.getElementById('menuElts').innerHTML += 
        '<button class="menuItemOpen" onclick="javascript:openApp(this.dataset.name, this.dataset.url)" data-name="' + name + '" data-url="' + url_app + '" class="open" style="display:none"; id="' + name + "_open" + '">' + 
            '<img class="menuIcon" src="' + url_app +'/favicon.ico" onerror="this.onerror=null; this.src=' + "'./question_mark.svg'" + '">' +
            '<div class="menuText">' + name + '</div>' + 
            '<span id="' + name + '_open_status" class="material-symbols-outlined"></span>' + 
        '</button>' +
        '<button id="' + name + '_closed" class="menuItemClosed" onclick="javascript:openApp(this.dataset.name, this.dataset.url)" data-name="' + name + '" data-url="' + url_app + '">' + 
            '<img class="menuIconClosed" src="' + url_app +'/favicon.ico" onerror="this.onerror=null; this.src=' + "'./question_mark.svg'" + '">' +
            '<span id="' + name + '_closed_status" class="material-symbols-outlined"></span>' +
        '</button>';
    }
}

/*###################################################################################/*
-----------------------------------------IPC-----------------------------------------
/*###################################################################################*/
// Resize html body to fit page when window is resized
window.electronAPI.resize_body((event, height) => {
    document.getElementsByTagName('body')[0].style.height = height + 'px';
});

// TODO: update open status in left menu when app is closed
window.electronAPI.close_app((event, appName) => {
    document.getElementById(appName + '_open').setAttribute('onclick', "javascript:openApp(this.dataset.name, this.dataset.url)");
    document.getElementById(appName + '_closed').setAttribute('onclick', "javascript:openApp(this.dataset.name, this.dataset.url)");
    document.getElementById(appName + '_open_status').innerHTML = "";
    document.getElementById(appName + '_closed_status').innerHTML = "";
    currentAppName = "";
});

// Update left menu button when app is opened from overlay
window.electronAPI.app_opened_overlay((event, appName) => {
    document.getElementById(appName + '_open').setAttribute('onclick', "switchApp(this.dataset.name)");
    document.getElementById(appName + '_closed').setAttribute('onclick', "switchApp(this.dataset.name)");
    document.getElementById(appName + '_open_status').innerHTML = "radio_button_checked";
    document.getElementById(appName + '_closed_status').innerHTML = "radio_button_checked";
    // Does not update HTML if no app is opened
    if (currentAppName !== "") {
        document.getElementById(currentAppName + '_open_status').innerHTML = "circle";
        document.getElementById(currentAppName + '_closed_status').innerHTML = "circle";
    }
    currentAppName = appName;
});

// Add buttons to left menu when event is reveived from main
window.electronAPI.json((event, json) => {
    json = JSON.parse(json);
    for (i = 0; i < json.length; i++) {
        addMenuItem(json[i].name, json[i].url);
    }
});

// Lock or Unlock menu expansion
window.electronAPI.toggle_block_menu((event) => {
    if (menuOpenable) {
        // Close side menu if it was unlocked and becomes locked
        // (window is too small)
        if (sideMenuOpen) {
            toggleSideMenu(false);
        }
        document.getElementById("minimizeButton").setAttribute('style', 'display:none;');
    }
    else {
        // Open side menu if it was open before getting locked closed
        if (sideMenuOpen) {
            toggleSideMenu(true);
        }
        document.getElementById("minimizeButton").setAttribute('style', 'display:flex;');
    }
    menuOpenable = !menuOpenable;
});

// Remove side menu elements when refreshing config
window.electronAPI.refresh_config((event) => {
    Array.from(document.getElementsByClassName('menuItemOpen')).forEach(function (element) {
        element.remove();
    });
    Array.from(document.getElementsByClassName('menuItemClosed')).forEach(function (element) {
        element.remove();
    });
});

// Update app status when app is opened from main
window.electronAPI.update_status_switched((event, name) => {
    document.getElementById(name + '_open_status').innerHTML = "radio_button_checked";
    document.getElementById(name + '_closed_status').innerHTML = "radio_button_checked";
    // Does not update HTML if no app is opened
    if (currentAppName !== "") {
        document.getElementById(currentAppName + '_open_status').innerHTML = "circle";
        document.getElementById(currentAppName + '_closed_status').innerHTML = "circle";
    }
    currentAppName = name;
});

// Disable/Enable goForward button in current view
window.electronAPI.set_go_forward((event, disabled) => {
    document.getElementById('goForward').disabled = disabled;
});

// Disable/Enable goBack button in current view
window.electronAPI.set_go_back((event, disabled) => {
    document.getElementById('goBack').disabled = disabled;
});

/*###################################################################################/*
----------------------------------------EVENTS---------------------------------------
/*###################################################################################*/
// Open overlay when "add app" button is pressed
document.getElementById('settingsButton').addEventListener('click', openOverlay);

// Open or close side menu
document.getElementById('minimizeButton').addEventListener('click', function () {
    sideMenuOpen = !sideMenuOpen;
    toggleSideMenu(sideMenuOpen);
});

// Create new window when newWindow button is pressed
document.getElementById('newWindow').addEventListener('click', function () {
    window.electronAPI.new_window();
});

// Refresh current BrowserView when refresh button is pressed
document.getElementById('reload').addEventListener('click', function() {
    window.electronAPI.reload(windowID);
});

// Go back in current BrowserView when goBack button is pressed
document.getElementById('goBack').addEventListener('click', function() {
    window.electronAPI.go_back(windowID);
});

// Go forward in current BrowserView when goForward button is pressed
document.getElementById('goForward').addEventListener('click', function() {
    window.electronAPI.go_forward(windowID);
});

// Open dev tools when button is pressed
document.getElementById('toggle_dev_tools').addEventListener('click', function() {
    window.electronAPI.toggle_dev_tools(windowID);
});