const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('starlightDesktop', {
  platform: process.platform,
  version: '1.0.0',
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
});
