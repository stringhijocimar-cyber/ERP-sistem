// preload.js – ponte segura entre o processo Electron e a página web
// Expõe apenas o necessário via contextBridge

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Versão do app
  getVersion: () => ipcRenderer.invoke('get-version'),
  // Plataforma (win32 | darwin | linux)
  platform: process.platform,
  // Flag que identifica que está rodando dentro do Electron
  isDesktop: true,
});
