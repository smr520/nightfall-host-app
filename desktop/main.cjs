const { app, BrowserWindow, Menu, dialog, ipcMain, protocol } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const APP_ORIGIN = 'nightfall://app';
const APP_HOST = 'app';
const APP_ROOT = path.join(__dirname, 'app');
const MAX_BACKUP_CHARACTERS = 5_000_000;
const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.wasm', 'application/wasm'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'nightfall',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function localPathForRequest(requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== 'nightfall:' || url.hostname !== APP_HOST) return null;
  const rawPath = decodeURIComponent(url.pathname);
  const requested = rawPath === '/' || path.extname(rawPath) === '' ? '/index.html' : rawPath;
  const normalized = path.posix.normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolved = path.resolve(APP_ROOT, `.${normalized}`);
  const relative = path.relative(APP_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function responseHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; '),
  };
}

async function registerAppProtocol() {
  await protocol.handle('nightfall', async request => {
    const filePath = localPathForRequest(request.url);
    if (!filePath) return new Response('Not found', { status: 404 });
    try {
      const body = await fs.readFile(filePath);
      const contentType = MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
      return new Response(body, { status: 200, headers: responseHeaders(contentType) });
    } catch (error) {
      if (error && error.code === 'ENOENT') return new Response('Not found', { status: 404 });
      throw error;
    }
  });
}

function installApplicationMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ]));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#FFFFFF',
    title: '夜幕 · 主持助手',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged || process.env.NIGHTFALL_DESKTOP_SMOKE === '1',
      backgroundThrottling: false,
      webSecurity: true,
    },
  });

  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(`${APP_ORIGIN}/`)) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  void window.loadURL(`${APP_ORIGIN}/`);
}

ipcMain.handle('backup:save-text', async (event, payload) => {
  if (!payload || typeof payload.content !== 'string' || typeof payload.suggestedName !== 'string') {
    throw new Error('备份保存参数无效');
  }
  if (payload.content.length > MAX_BACKUP_CHARACTERS) throw new Error('备份文件过大');
  const safeName = path.basename(payload.suggestedName).replace(/[^\w.-]+/g, '-');
  const filename = safeName.endsWith('.json') ? safeName : `${safeName}.json`;
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(owner ?? undefined, {
    title: '保存夜幕本机备份',
    defaultPath: filename,
    filters: [{ name: '夜幕备份', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { saved: false };
  await fs.writeFile(result.filePath, payload.content, 'utf8');
  return { saved: true };
});

ipcMain.handle('dialog:show', async (event, payload) => {
  if (!payload || typeof payload.title !== 'string' || typeof payload.message !== 'string') {
    throw new Error('对话框参数无效');
  }
  if (payload.title.length > 200 || payload.message.length > 10_000) throw new Error('对话框内容过长');
  const hasCancel = typeof payload.cancelLabel === 'string' && payload.cancelLabel.length > 0;
  const buttons = hasCancel
    ? [String(payload.cancelLabel).slice(0, 40), String(payload.confirmLabel || '确定').slice(0, 40)]
    : [String(payload.confirmLabel || '确定').slice(0, 40)];
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showMessageBox(owner ?? undefined, {
    type: payload.destructive ? 'warning' : 'question',
    title: payload.title.slice(0, 200),
    message: payload.title.slice(0, 200),
    detail: payload.message.slice(0, 10_000),
    buttons,
    defaultId: buttons.length - 1,
    cancelId: hasCancel ? 0 : 0,
    noLink: true,
  });
  return { confirmed: result.response === buttons.length - 1 };
});

app.setAppUserModelId('com.nightfall.werewolfhost');

app.whenReady().then(async () => {
  await registerAppProtocol();
  installApplicationMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
