const { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell, Tray, nativeImage } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

let mainWindow = null;
let telemetryProcess = null;
let activeTelemetryPort = null;
let telemetryWatchdog = null;
let telemetryRecovery = null;
let quitting = false;
let consecutiveTelemetryFailures = 0;
let tray = null;

const DEFAULT_PORT = Number(process.env.STARLIGHT_TELEMETRY_PORT || 9224);
const COMPACT_HEIGHT = 96;
const EXPANDED_HEIGHT = 690;
const HUD_WIDTH = 760;
const EDGE_GAP = 16;
const TELEMETRY_WATCHDOG_MS = 10_000;

app.setName('Starlight Agent Pet');
app.setAppUserModelId('ai.frankx.starlight-agent-pet');
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

function loginItemOptions() {
  if (app.isPackaged) {
    return { path: process.execPath, args: ['--starlight-autostart'] };
  }
  return {
    path: process.execPath,
    args: [path.join(__dirname, 'main.js'), '--starlight-autostart'],
  };
}

function setLaunchAtLogin(enabled) {
  if (process.platform !== 'win32') return;
  const options = loginItemOptions();
  app.setLoginItemSettings({ ...options, openAtLogin: Boolean(enabled) });
}

function launchesAtLogin() {
  if (process.platform !== 'win32') return false;
  try {
    return app.getLoginItemSettings(loginItemOptions()).openAtLogin;
  } catch {
    return false;
  }
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
    const request = http.get({ hostname: '127.0.0.1', port, path: '/api/health', timeout: 1_500 }, (response) => {
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
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (await probeTelemetry(port)) return;
    if (launchError) throw launchError;
    if (childProcess.exitCode != null) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`The local telemetry service did not become ready on port ${port}.`);
}

async function ensureTelemetry() {
  if (activeTelemetryPort && await probeTelemetry(activeTelemetryPort)) return activeTelemetryPort;
  if (await probeTelemetry(DEFAULT_PORT)) return DEFAULT_PORT;

  if (telemetryProcess && telemetryProcess.exitCode == null) {
    telemetryProcess.kill();
    telemetryProcess = null;
  }

  const port = await findAvailablePort(DEFAULT_PORT);
  const nodeBinary = process.env.STARLIGHT_NODE_BINARY || 'node';
  const childProcess = spawn(nodeBinary, [path.join(__dirname, '..', 'bin', 'starlight-pet.js'), 'daemon'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, STARLIGHT_TELEMETRY_PORT: String(port) },
    stdio: 'ignore',
    windowsHide: true,
  });
  telemetryProcess = childProcess;
  childProcess.once('exit', () => {
    if (telemetryProcess === childProcess) telemetryProcess = null;
    if (!quitting) setTimeout(() => void recoverTelemetry(), 1_000);
  });
  await waitForTelemetry(port, childProcess);
  activeTelemetryPort = port;
  return port;
}

async function recoverTelemetry() {
  if (quitting) return;
  if (telemetryRecovery) return telemetryRecovery;
  telemetryRecovery = (async () => {
    const previousPort = activeTelemetryPort;
    if (previousPort && await probeTelemetry(previousPort)) return previousPort;
    const port = await ensureTelemetry();
    activeTelemetryPort = port;
    if (mainWindow && !mainWindow.isDestroyed() && previousPort && port !== previousPort) {
      await mainWindow.loadURL(`http://127.0.0.1:${port}/?mode=compact&desktop=1`);
    }
    return port;
  })().catch((error) => {
    console.error('[Starlight desktop] Telemetry recovery failed:', error);
    return null;
  }).finally(() => {
    telemetryRecovery = null;
  });
  return telemetryRecovery;
}

async function monitorTelemetry() {
  if (quitting || !activeTelemetryPort) return;
  if (await probeTelemetry(activeTelemetryPort)) {
    consecutiveTelemetryFailures = 0;
    return;
  }
  consecutiveTelemetryFailures += 1;
  if (consecutiveTelemetryFailures < 4) return;
  consecutiveTelemetryFailures = 0;
  await recoverTelemetry();
}

function startTelemetryWatchdog() {
  if (telemetryWatchdog) return;
  telemetryWatchdog = setInterval(() => void monitorTelemetry(), TELEMETRY_WATCHDOG_MS);
  telemetryWatchdog.unref?.();
}

function stopTelemetryWatchdog() {
  if (telemetryWatchdog) clearInterval(telemetryWatchdog);
  telemetryWatchdog = null;
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
    {
      label: 'Launch at sign-in',
      type: 'checkbox',
      checked: launchesAtLogin(),
      click: (item) => setLaunchAtLogin(item.checked),
    },
    { type: 'separator' },
    { label: 'Quit Starlight', click: () => app.quit() },
  ]);
}

function createTrayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#00f0ff"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function buildTrayMenu() {
  const isVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
  return Menu.buildFromTemplate([
    {
      label: isVisible ? 'Hide Starlight HUD' : 'Show Starlight HUD',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Local Services & Port Status',
      enabled: false,
    },
    {
      label: `● Telemetry Engine (:9224) - Active`,
      click: () => shell.openExternal(`http://127.0.0.1:${activeTelemetryPort || DEFAULT_PORT}`),
    },
    {
      label: '● Command Center (:4321)',
      click: () => shell.openExternal('http://127.0.0.1:4321/ops'),
    },
    { type: 'separator' },
    {
      label: 'Reap Idle Dev Servers (sds reap)',
      click: () => {
        const { exec } = require('child_process');
        exec('sds reap', (err, stdout) => {
          if (err) console.error('[Starlight desktop] sds reap error:', err);
          else console.log('[Starlight desktop] sds reap:', stdout);
        });
      },
    },
    {
      label: 'Launch at sign-in',
      type: 'checkbox',
      checked: launchesAtLogin(),
      click: (item) => setLaunchAtLogin(item.checked),
    },
    { type: 'separator' },
    {
      label: 'Quit Starlight',
      click: () => app.quit(),
    },
  ]);
}

function setupTray() {
  if (tray && !tray.isDestroyed()) return;
  try {
    const icon = createTrayIcon();
    tray = new Tray(icon);
    tray.setToolTip('Starlight Constellation & Telemetry Switchboard');
    tray.setContextMenu(buildTrayMenu());

    tray.on('click', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    tray.on('right-click', () => {
      if (tray && !tray.isDestroyed()) {
        tray.setContextMenu(buildTrayMenu());
      }
    });
  } catch (err) {
    console.error('[Starlight desktop] Tray creation error:', err);
  }
}


async function createWindow() {
  const port = await ensureTelemetry();
  activeTelemetryPort = port;
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
  mainWindow.webContents.on('render-process-gone', () => {
    if (quitting || !mainWindow || mainWindow.isDestroyed()) return;
    setTimeout(() => mainWindow?.reload(), 1_000);
  });

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

function shutDownRuntime() {
  quitting = true;
  stopTelemetryWatchdog();
  stopOwnedTelemetry();
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
  }
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
    if (process.env.STARLIGHT_DISABLE_AUTO_START !== '1') setLaunchAtLogin(true);
    ipcMain.on('starlight:set-expanded', (_event, expanded) => resizeHud(Boolean(expanded)));
    ipcMain.on('starlight:open-command-center', (_event, url) => {
      try {
        if (typeof url === 'string' && new URL(url).origin === 'http://127.0.0.1:4321') shell.openExternal(url);
      } catch {
        // Ignore malformed or untrusted navigation targets.
      }
    });

    createWindow().then(() => {
      setupTray();
      startTelemetryWatchdog();
    }).catch((error) => {
      console.error('[Starlight desktop] Startup failed:', error);
      dialog.showErrorBox('Starlight could not start', error instanceof Error ? error.message : String(error));
      app.quit();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().then(startTelemetryWatchdog).catch(console.error);
      }
    });
  });

  app.on('before-quit', shutDownRuntime);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
