const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const { FleetAggregator } = require('../dist/engine/aggregator');
const { FileSystemWatcher } = require('../dist/engine/watcher');
const { TelemetryServer } = require('../dist/engine/server');

let mainWindow = null;
let tray = null;
let server = null;
let watcher = null;

const COMPACT_HEIGHT = 96;
const EXPANDED_HEIGHT = 690;
const HUD_WIDTH = 760;

function resizeHud(expanded) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const current = mainWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(current);
  const width = Math.min(HUD_WIDTH, workArea.width - 24);
  const height = Math.min(expanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT, workArea.height - 24);
  const x = Math.max(workArea.x + 12, Math.min(current.x, workArea.x + workArea.width - width - 12));
  const y = Math.max(workArea.y + 12, Math.min(current.y, workArea.y + workArea.height - height - 12));
  mainWindow.setBounds({ x, y, width, height }, true);
}

async function createWindow() {
  const aggregator = new FleetAggregator();
  watcher = new FileSystemWatcher(aggregator);
  watcher.start();
  
  server = new TelemetryServer(aggregator, 9224);
  const port = await server.start();

  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.min(HUD_WIDTH, workArea.width - 24);

  mainWindow = new BrowserWindow({
    x: workArea.x + workArea.width - width - 16,
    y: workArea.y + 16,
    width,
    height: COMPACT_HEIGHT,
    minWidth: 520,
    minHeight: COMPACT_HEIGHT,
    title: 'Starlight Constellation HUD',
    backgroundColor: '#00000000',
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    }
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadURL(`http://localhost:${port}/?mode=compact&desktop=1`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1:4321/') || url.startsWith(`http://localhost:${port}/`)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ipcMain.on('starlight:set-expanded', (_event, expanded) => resizeHud(Boolean(expanded)));
  ipcMain.on('starlight:open-command-center', (_event, url) => {
    if (typeof url === 'string' && url.startsWith('http://127.0.0.1:4321/')) {
      shell.openExternal(url);
    }
  });
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
