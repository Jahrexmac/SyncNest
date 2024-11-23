const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    onDatabaseUpdate: (callback) => ipcRenderer.on('db-updated', callback),
    getIpAddress: (callback) => ipcRenderer.on('send-ip', (event, ipAddress) => { callback(ipAddress) }),
    notifyMainProcess: () => ipcRenderer.send('network-status'),
    syncNestTab: () => ipcRenderer.send('syncNestTab')

});
