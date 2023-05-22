function submitForm() {
    url = document.getElementById("webService").value;
    if (!isValidUrl(url)) {
        alert("Invalid URL")
        return;
    }
    window.electronAPI.update_station(url);
}

window.electronAPI.no_config((event) => {
    var choice = window.confirm("Could not get config from API and no config found on computer.\nDo you want to try another URL/login/password combination?");
    if (!choice) {
        window.electronAPI.quit_app();
    }
});  

function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (err) {
      return false;
    }
  }

// document.getElementById("submitForm").addEventListener("submit", submitForm)
