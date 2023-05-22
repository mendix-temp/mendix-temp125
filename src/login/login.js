// Called when user presses submit in login form
// Send an event to add station URL to config.json if it is valid
// If not, displays the warning banner
function submitForm() {
    url = document.getElementById("webService").value;
    if (!isValidUrl(url)) {
        var banner = document.getElementById('alert');
        banner.innerHTML = 
        '<span class="closebtn" onclick="this.parentElement.style.visibility=' +"'hidden'"+ ';">&times;</span>' + 
        'Invalid URL.';
        banner.style.visibility = 'visible';
        return;
    }
    window.electronAPI.update_station(url);
}

// Alert user that no config was found and that connection to API failed
window.electronAPI.no_config((event) => {
    var banner = document.getElementById('alert');
        document.getElementById('alert').innerHTML = 
        '<span class="closebtn" onclick="this.parentElement.style.visibility=' +"'hidden'"+ ';">&times;</span>' + 
        'Could not get config from API and no config found on computer. Please, try another URL/login/password combination.';
        banner.style.visibility='visible';
});  

// Return true if URL is in valid format
function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (err) {
      return false;
    }
  }
