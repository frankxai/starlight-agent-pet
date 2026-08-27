const { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

let mainWindow = null;
let telemetryProcess = null;

const DEFAULT_PORT = Number(process.env.STARLIGHT_TELEMETRY_PORT || 9224);
const COMPACT_HEIGHT = 96;
const EXPANDED_HEIGHT = 690;
const HUD_WIDTH = 760;
const EDGE_GAP = 16;

app.setName('Starlight Agent Pet');
app.setPath(
  'userData',
  process.env.STARLIGHT_DESKTOP_STATE_DIR || path.join(app.getPath('appData'), 'Starlight Agent Pet'),
);

// Transparent Chromium windows can crash the GPU process on some Windows drivers.
// Software compositing keeps this tiny telemetry surface stable and predictable.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
if (process.env.STARLIGHT_DISABLE_GPU_SANDBOX === '1') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}
const rendererSandboxEnabled = process.env.STARLIGHT_DISABLE_RENDERER_SANDBOX !== '1';
if (!rendererSandboxEnabled) app.commandLine.appendSwitch('no-sandbox');

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

function windowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowPosition() {
  try {
    const value = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'));
    if (Number.isFinite(value.x) && Number.isFinite(value.y)) return { x: value.x, y: value.y };
  } catch {
    // First launch or invalid state falls back to the top-right corner.
  }
  return null;
}

function saveWindowPosition() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { x, y } = mainWindow.getBounds();
  try {
    fs.mkdirSync(path.dirname(windowStatePath()), { recursive: true });
    fs.writeFileSync(windowStatePath(), JSON.stringify({ x, y }), 'utf8');
  } catch {
    // Position persistence is helpful, but never blocks the companion from closing.
  }
}

function probeTelemetry(port) {
  return new Promise((resolve) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/api/health', timeout: 700 }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(preferredPort) {
  for (let port = preferredPort; port < preferredPort + 10; port += 1) {
    if (await canBindPort(port)) return port;
  }
  throw new Error('No local telemetry port is available.');
}

async function waitForTelemetry(port, childProcess) {
  let launchError = null;
  childProcess.once('error', (error) => {
    launchError = error;
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await probeTelemetry(port)) return;
    if (launchError) throw launchError;
    if (childProcess.exitCode != null) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`The local telemetry service did not become ready on port ${port}.`);
}

async function ensureTelemetry() {
  if (await probeTelemetry(DEFAULT_PORT)) return DEFAULT_PORT;

  const port = await findAvailablePort(DEFAULT_PORT);
  const nodeBinary = process.env.STARLIGHT_NODE_BINARY || 'node';
  telemetryProcess = spawn(nodeBinary, [path.join(__dirname, '..', 'bin', 'starlight-pet.js'), 'daemon'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, STARLIGHT_TELEMETRY_PORT: String(port) },
    stdio: 'ignore',
    windowsHide: true,
  });
  telemetryProcess.once('exit', () => {
    telemetryProcess = null;
  });
  await waitForTelemetry(port, telemetryProcess);
  return port;
}

function resizeHud(expanded) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const current = mainWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(current);
  const width = Math.min(HUD_WIDTH, workArea.width - EDGE_GAP * 2);
  const height = Math.min(expanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT, workArea.height - EDGE_GAP * 2);
  const x = clamp(current.x, workArea.x + EDGE_GAP, workArea.x + workArea.width - width - EDGE_GAP);
  const y = clamp(current.y, workArea.y + EDGE_GAP, workArea.y + workArea.height - height - EDGE_GAP);
  mainWindow.setBounds({ x, y, width, height }, true);
}

function createContextMenu() {
  return Menu.buildFromTemplate([
    { label: 'Open command center', click: () => shell.openExternal('http://127.0.0.1:4321/ops') },
    { type: 'separator' },
    { label: 'Quit Starlight', click: () => app.quit() },
  ]);
}

async function createWindow() {
  const port = await ensureTelemetry();
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.min(HUD_WIDTH, workArea.width - EDGE_GAP * 2);
  const savedPosition = loadWindowPosition();
  const x = clamp(
    savedPosition?.x ?? workArea.x + workArea.width - width - EDGE_GAP,
    workArea.x + EDGE_GAP,
    workArea.x + workArea.width - width - EDGE_GAP,
  );
  const y = clamp(
    savedPosition?.y ?? workArea.y + EDGE_GAP,
    workArea.y + EDGE_GAP,
    workArea.y + workArea.height - COMPACT_HEIGHT - EDGE_GAP,
  );

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height: COMPACT_HEIGHT,
    minWidth: 520,
    minHeight: COMPACT_HEIGHT,
    title: 'Starlight constellation companion',
    backgroundColor: '#00000000',
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: rendererSandboxEnabled,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  await mainWindow.loadURL(`http://127.0.0.1:${port}/?mode=compact&desktop=1`);

  const allowedExternalOrigins = new Set(['http://127.0.0.1:4321', `http://127.0.0.1:${port}`]);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (allowedExternalOrigins.has(new URL(url).origin)) shell.openExternal(url);
    } catch {
      // Ignore malformed or untrusted navigation targets.
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('context-menu', () => createContextMenu().popup({ window: mainWindow }));

  mainWindow.on('close', saveWindowPosition);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function stopOwnedTelemetry() {
  if (!telemetryProcess) return;
  telemetryProcess.kill();
  telemetryProcess = null;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    ipcMain.on('starlight:set-expanded', (_event, expanded) => resizeHud(Boolean(expanded)));
    ipcMain.on('starlight:open-command-center', (_event, url) => {
      try {
        if (typeof url === 'string' && new URL(url).origin === 'http://127.0.0.1:4321') shell.openExternal(url);
      } catch {
        // Ignore malformed or untrusted navigation targets.
      }
    });

    createWindow().catch((error) => {
      console.error('[Starlight desktop] Startup failed:', error);
      dialog.showErrorBox('Starlight could not start', error instanceof Error ? error.message : String(error));
      app.quit();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', stopOwnedTelemetry);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
