const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const clientServer = require('./clientServer');
const mainServer = require('./server');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const os = require('os');

let mainWindow = null;
let dbLastUpdated = null;
let ipAddress = false;
let syncWindowArray = []
let db;
const homeDirectory = os.homedir();
const dbFolder = path.join(homeDirectory, 'SyncNestDb');
const dbPath = path.join(dbFolder, 'data.db');

// Function to get the IP address
function getIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const interfaceInfo = interfaces[interfaceName];
    for (const iface of interfaceInfo) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ipAddress = iface.address
        return ipAddress;
      }
    }
  }
  return ipAddress; // Default to localhost if no external IP is found
}

ipcMain.on('network-status', (event) => {
  ipAddress = false;

  while (!ipAddress) {
    ipAddress = getIPAddress();
    if (!ipAddress) {
    }
  }
  mainWindow.webContents.send('send-ip', ipAddress);
});

ipcMain.on('syncNestTab', (event) => {
  function createSyncWindow() {
    let syncWindow = new BrowserWindow({
      width: 800,
      height: 600,
    });

    // Load desktop UI in one window
    syncWindow.loadURL('http://localhost:5000'); // Desktop React app URL

    syncWindowArray.push(syncWindow)
  }
  createSyncWindow()

})

function createWindow() {
  // Desktop UI Window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
    },
  });

  // Load desktop UI in one window
  // win.loadFile('build/index.html');
  mainWindow.loadFile('DesktopBuild/index.html'); // Desktop React app URL
  Menu.setApplicationMenu(null);

  mainWindow.webContents.on('did-finish-load', () => {
    const ipAddress = getIPAddress();
    mainWindow.webContents.send('send-ip', ipAddress); // Send IP address to renderer
  });


  mainWindow.on('close', () => {
    syncWindowArray.forEach((win) => {
      if (!win.isDestroyed()) {
        win.close(); // Close the window if it isn't already destroyed
      }
    });

    syncWindowArray = [];

    // Close the database connection
    if (db) {
      db.close((err) => {

      });
    }

    // Optionally, delete the database file (if you want to completely remove it)
    fs.unlinkSync(dbPath);
    clientServer.close(() => { });
    mainServer.close(() => { });

    console.log(BrowserWindow.getAllWindows().length)
  })



}





// Function to watch the database for changes
function watchDatabase() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return;
    }
  });

  setInterval(() => {
    db.get('SELECT MAX(id) AS lastId FROM events', (err, row) => {
      if (err) {
        console.error("Database error:", err);
        return;
      }

      const currentUpdate = row.lastId;
      if (dbLastUpdated !== currentUpdate) {
        dbLastUpdated = currentUpdate;
        // Notify renderer about the update
        mainWindow.webContents.send('db-updated');
      }
    });


  }, 3000); // Check every 3 seconds
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit(); // Quit the second instance
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Focus the existing main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

  });
}

app.on('ready', () => {
  if (!mainWindow) {
    createWindow();
    watchDatabase(); // Start watching the database
  } else {
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindows();
});
