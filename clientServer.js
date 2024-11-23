const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
function getIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

const ip = getIPAddress();
process.env.REACT_APP_SERVER_IP = ip;

// Serve static files from the React app's build folder
app.use(express.static(path.join(__dirname, 'ClientBuild')));

// Route all other requests to React's index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'ClientBuild', 'index.html'));
});

const PORT = process.env.PORT || 5000;
const clientServer = app.listen(PORT, () => {
});

module.exports = clientServer;