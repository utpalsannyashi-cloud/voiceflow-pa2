const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, nativeImage } = require('electron');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

let win, tray;
let isRecording = false;
let store = { apiKey: '', hotkey: 'CommandOrControl+Shift+Space', mode: 'polish', language: 'english' };
const storePath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(storePath)) store = { ...store, ...JSON.parse(fs.readFileSync(storePath, 'utf8')) };
  } catch {}
}
function saveSettings(data) {
  store = { ...store, ...data };
  fs.writeFileSync(storePath, JSON.stringify(store), 'utf8');
}

function injectText(text) {
  clipboard.writeText(text);
  const isMac = process.platform === 'darwin';
  try {
    if (isMac) {
      execSync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
    } else {
      execSync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`);
    }
  } catch (e) {
    console.error('Inject error:', e.message);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 420, height: 620, resizable: false,
    frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile('index.html');
  win.on('blur', () => { if (!isRecording) win.hide(); });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('VoiceFlow PA-2');
  const menu = Menu.buildFromTemplate([
    { label: 'Open VoiceFlow', click: () => { win.show(); win.focus(); } },
    { label: 'Start Recording', accelerator: store.hotkey, click: () => toggleRecording() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => { win.isVisible() ? win.hide() : (win.show(), win.focus()); });
}

function registerHotkey(hotkey) {
  globalShortcut.unregisterAll();
  globalShortcut.register(hotkey || store.hotkey, () => toggleRecording());
}

function toggleRecording() {
  isRecording = !isRecording;
  win.show(); win.focus();
  win.webContents.send('recording-state', isRecording);
}

ipcMain.handle('get-settings', () => store);
ipcMain.handle('save-settings', (_, data) => { saveSettings(data); if (data.hotkey) registerHotkey(data.hotkey); return store; });
ipcMain.handle('inject-text', (_, text) => { win.hide(); setTimeout(() => injectText(text), 300); return true; });
ipcMain.handle('hide-window', () => win.hide());
ipcMain.handle('toggle-recording', () => { toggleRecording(); return isRecording; });

app.whenReady().then(() => {
  loadSettings(); createWindow(); createTray(); registerHotkey();
  if (process.platform === 'darwin') app.dock?.hide();
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());