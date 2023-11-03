let log_id = 0;

let error_count = 0;
let warning_count = 0;

let current_status = 'normal';

window.electronAPI.receive_log((event, log) => {
    log_id = log_id + 1;
    let date = new Date();
    switch (log.type[0]) {
        // error
        case 'e':
            error_count++;
            if (log.header == "port_in_use") {
                document.getElementById('logs').innerHTML +=
                    `<div class="log log-error" id="log-${log_id}">` + 
                        '<div class="status">' +
                            '<span class="material-symbols-outlined">error</span>' + 
                            date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0') +
                        '</div>' +
                        '<div class="log-content">' +
                            `<div>${log.error_message}</div>` +
                            `<button class="buttons" onclick="ignore(this)" id="${log_id}">Ignore</button>` +
                        '</div>' +
                    '</div>';
            }
            else if (log.header == "device_error") {
                document.getElementById('logs').innerHTML +=
                    `<div class="log log-error" id="log-${log_id}">` + 
                        '<div class="status">' +
                            '<span class="material-symbols-outlined">error</span>' + 
                            date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0') +
                        '</div>' +
                        '<div class="log-content">' +
                            `<div>${log.error_message}</div>` +
                            `<div id="buttons-${log_id}" style="display: flex;
                                                                flex-direction: row;
                                                                width: 160px;
                                                                justify-content: space-between;">` +
                                `<button class="buttons" onclick="retryConnection(this)" data-logid="${log_id}" data-deviceid="${parseInt(log.deviceID)}">Retry</button>` +
                                `<button class="buttons" onclick="ignoreAndUpdate(this)" data-logid="${log_id}" data-deviceid="${parseInt(log.deviceID)}" data-error="${log.error}">Ignore</button>` +
                            '</div>' +
                        '</div>' +
                    '</div>';
            }
            break;
        // warning
        case 'w':
            warning_count++;
            break;

        // information
        case 'i':
            
            break;
    
        default:
            break;
    }
    determineStatus();
});

function determineStatus() {
    let new_status = null;
    if (current_status != 'error' && error_count > 0) {
        new_status = 'error';
    }
    else if (current_status != 'warning' && warning_count > 0) {
        new_status = 'warning';
    }
    else if (error_count == 0 && warning_count == 0) {
        new_status = 'normal';
    }
    if (new_status == null) {
        return;
    }
    window.electronAPI.change_status(new_status);
    current_status = new_status;
}

function ignore(button) {
    const log = document.getElementById(`log-${button.id}`);
    log.children[0].children[0].innerHTML = 'info';
    log.children[0].children[0].setAttribute('style', 'color: black;');
    document.getElementById(`${button.id}`).remove();
    error_count--;
    determineStatus();
} 

function ignoreAndUpdate(button) {
    const log = document.getElementById(`log-${button.dataset.logid}`);
    log.children[0].children[0].innerHTML = 'info';
    log.children[0].children[0].setAttribute('style', 'color: black;');
    document.getElementById(`buttons-${button.dataset.logid}`).remove();
    window.electronAPI.ignore_and_update(button.dataset.deviceid, button.dataset.error);
    error_count--;
    determineStatus();
}

function retryConnection(button) {
    const log = document.getElementById(`log-${button.dataset.logid}`);
    log.children[0].children[0].innerHTML = 'info';
    log.children[0].children[0].setAttribute('style', 'color: black;');
    document.getElementById(`buttons-${button.dataset.logid}`).remove();
    window.electronAPI.retry_connection(button.dataset.deviceid);
    error_count--;
    determineStatus();
}