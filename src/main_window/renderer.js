
function openOverlay() {
    window.electronAPI.open_overlay();
}

// Add buttons in left menu when event is received from main (when app is selected in overlay)
window.electronAPI.add_menu_item((event, name) => {
    document.getElementById('menuElts').innerHTML += 
    '<div class="row">' +
        '<button class="menuItem" onclick="window.electronAPI.switch_app(this.id)" id="' + name + '">' + name + '</button>' +
    '</div>';
});

document.getElementById('button_1').addEventListener('click', openOverlay);
