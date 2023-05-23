let sideMenuOpen = true;

function openOverlay() {
    window.electronAPI.open_overlay();
}

// Add buttons in left menu when event is received from main (when app is selected in overlay)
window.electronAPI.add_menu_item((event, name, url_app) => {
    if (sideMenuOpen) {
        document.getElementById('menuElts').innerHTML += 
        '<button class="menuItemOpen" onclick="window.electronAPI.switch_app(this.id)" id="' + name + '">' + 
            '<img class="menuIcon" src="' + url_app +'/favicon.ico">' +
            '<div class="menuText">' + name + '</div>' + 
         '</button>' +
        '<button class="menuItemClosed" onclick="window.electronAPI.switch_app(this.id)" id="' + name + '" hidden="hidden">' + 
            '<img class="menuIcon" src="' + url_app +'/favicon.ico">' +
        '</button>';
    }
    else {
        document.getElementById('menuElts').innerHTML += 
        '<button class="menuItemOpen" onclick="window.electronAPI.switch_app(this.id)" id="' + name + '" hidden="hidden">' + 
            '<img class="menuIcon" src="' + url_app +'/favicon.ico">' +
            '<div class="menuText">' + name + '</div>' + 
         '</button>' +
        '<button class="menuItemClosed" onclick="window.electronAPI.switch_app(this.id)" id="' + name + '">' + 
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

// Minimizes side bar
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
        var open = document.getElementsByClassName('menuItemOpen');
        for (i = 0; i < open.length; i++) {
            open[i].removeAttribute("hidden");
        }
        var closed = document.getElementsByClassName('menuItemClosed');
        for (i = 0; i < open.length; i++) {
            closed[i].setAttribute("hidden", "hidden");
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
        var open = document.getElementsByClassName('menuItemOpen');
        for (i = 0; i < open.length; i++) {
            open[i].setAttribute("hidden", "hidden");
        }
        var closed = document.getElementsByClassName('menuItemClosed');
        for (i = 0; i < open.length; i++) {
            closed[i].removeAttribute("hidden");
        }
    }
    window.electronAPI.toggle_side_menu();
});
