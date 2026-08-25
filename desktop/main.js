const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const { FleetAggregator } = require('../dist/engine/aggregator');
const { FileSystemWatcher } = require('../dist/engine/watcher');
const { TelemetryServer } = require('../dist/engine/server');

let mainWindow = null;
let tray = null;
let server = null;
let watcher = null;

async function createWindow() {
  const aggregator = new FleetAggregator();
  watcher = new FileSystemWatcher(aggregator);
  watcher.start();
  
  server = new TelemetryServer(aggregator, 9224);
  const port = await server.start();

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    title: 'Starlight Agent Fleet Observatory',
    backgroundColor: '#06070a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (watcher) watcher.stop();
    if (server) server.stop();
    app.quit();
  }
});
