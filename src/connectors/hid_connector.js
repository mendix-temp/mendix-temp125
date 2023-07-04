var HID = require('node-hid');
var devices = HID.devices();

console.log(devices);
devices.forEach((deviceInfo) => {
    let dev = new HID.HID(deviceInfo.path);
    try {
        dev.on('data', function(data) {
            console.log(this.vendorId);
            console.log(this.productId);
        }.bind(dev));
    }
    catch(err) {
        console.log('rere');
    }
});
