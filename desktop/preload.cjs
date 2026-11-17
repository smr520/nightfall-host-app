const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nightfallDesktop', {
  saveBackupText: async (suggestedName, content) => {
    const result = await ipcRenderer.invoke('backup:save-text', { suggestedName, content });
    return !!result?.saved;
  },
  show: async input => {
    const result = await ipcRenderer.invoke('dialog:show', input);
    return !!result?.confirmed;
  },
});
