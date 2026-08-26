const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('starlightDesktop', {
  platform: process.platform,
  version: '1.0.0',
  setExpanded: (expanded) => ipcRenderer.send('starlight:set-expanded', Boolean(expanded)),
  openCommandCenter: (url) => ipcRenderer.send('starlight:open-command-center', String(url || '')),
});
