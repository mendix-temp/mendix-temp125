let sideMenuOpen = true;

function openOverlay() {
    window.electronAPI.open_overlay();
}

function closeApp(appName) {
    window.electronAPI.close_app(appName);
    document.getElementById(appName + "_open").remove();
    document.getElementById(appName + "_closed").remove();
    // TODO: remove button from side menu
}

// Add buttons in left menu when event is received from main (when app is selected in overlay)
window.electronAPI.add_menu_item((event, name, url_app) => {
    if (sideMenuOpen) {
        document.getElementById('menuElts').innerHTML += 
        '<div class="open" id="' + name + "_open" + '">' +
            '<button class="menuItemOpen" onclick="window.electronAPI.switch_app(this.dataset.name)" data-name="' + name + '">' + 
                '<img class="menuIcon" src="' + url_app +'/favicon.ico">' +
                '<div class="menuText">' + name + '</div>' + 
            '</button>' +
            '<button class="closeButton" onclick="closeApp(this.dataset.name)" data-name="' + name + '">' +
                '<span class="material-symbols-outlined">' +
                    'close' +
                '</span>' +
            '</button>' +
        '</div>' +
        '<button class="menuItemClosed" onclick="window.electronAPI.switch_app(this.dataset.name)" data-name="' + name + '" style="display:none;" id="' + name + "_closed" + '">' + 
            '<img class="menuIcon" src="' + url_app +'/favicon.ico">' +
        '</button>';
    }
    else {
        document.getElementById('menuElts').innerHTML += 
        '<div class="open" style="display:none"; id="' + name + "_open" + '">' +
            '<button class="menuItemOpen" onclick="window.electronAPI.switch_app(this.dataset.name)" data-name="' + name + '">' + 
                '<img class="menuIcon" src="' + url_app +'/favicon.ico">' +
                '<div class="menuText">' + name + '</div>' + 
            '</button>' +
            '<button class="closeButton" onclick="closeApp(this.dataset.name)" data-name="' + name + '">' +
                '<span class="material-symbols-outlined">' +
                    'close' +
                '</span>' +
            '</button>' +
        '</div>' +
        '<button class="menuItemClosed" onclick="window.electronAPI.switch_app(this.dataset.name)" data-name="' + name + '" id="' + name + "_closed" + '">' + 
            '<img class="menuIcon" src="' + url_app +'/favicon.ico">' +
        '</button>';
    }
});

// Resize html body to fit page when window is resized
window.electronAPI.resize_body((event, height) => {
    document.getElementsByTagName('body')[0].style.height = height + 'px';
});

// Open overlay when "add app" button is pressed
document.getElementById('button_1').addEventListener('click', openOverlay);

// Open of close side menu
document.getElementById('button_2').addEventListener('click', function () {
    sideMenuOpen = !sideMenuOpen;
    if (sideMenuOpen) {
        // Change add app and minimize buttons by full name
        document.getElementById('button_2').innerHTML = 'Minimize';
        document.getElementById('button_1').innerHTML = 'App App';

        // Resize side menu
        document.getElementsByClassName('column-1')[0].style.width = '15%';
        document.getElementsByClassName('column-2')[0].style.width = '85%';

        // Change all side menu buttons
        var open = document.getElementsByClassName('open');
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
        document.getElementById('button_2').innerHTML = 
        '<span class="material-symbols-outlined">' +
            'menu' +
        '</span>';
        document.getElementById('button_1').innerHTML = 
        '<span class="material-symbols-outlined">' +
            'add' +
        '</span>';

        // Resize side menu
        document.getElementsByClassName('column-1')[0].style.width = '50px';
        document.getElementsByClassName('column-2')[0].style.width = 
        (document.getElementsByTagName('body')[0].clientWidth - 50).toString() + 'px';

        // Change all side menu buttons
        var open = document.getElementsByClassName('open');
        for (i = 0; i < open.length; i++) {
            open[i].setAttribute('style', 'display:none;');
        }
        var closed = document.getElementsByClassName('menuItemClosed');
        for (i = 0; i < open.length; i++) {
            closed[i].setAttribute('style', 'display:flex;');
        }
    }
    window.electronAPI.toggle_side_menu();
});
