const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings:      ()     => ipcRenderer.invoke('get-settings'),
  saveSettings:     (data) => ipcRenderer.invoke('save-settings', data),
  injectText:       (text) => ipcRenderer.invoke('inject-text', text),
  hideWindow:       ()     => ipcRenderer.invoke('hide-window'),
  toggleRecording:  ()     => ipcRenderer.invoke('toggle-recording'),
  onRecordingState: (cb)   => ipcRenderer.on('recording-state', (_, val) => cb(val))
});