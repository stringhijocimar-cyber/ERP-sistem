const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── Variáveis globais ─────────────────────────────────────────────────────
let mainWindow;
const isDev = process.env.NODE_ENV === 'development';
const APP_NAME  = 'Fraser Alexander ERP';
const APP_VER   = app.getVersion();

// ─── Prevenção de múltiplas instâncias ────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ─── Criação da janela principal ─────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: APP_NAME,
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Necessário para localStorage funcionar com file://
      webSecurity: false,
    },
    show: false, // Mostrar apenas quando pronto (evita flash branco)
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  // Carregar a aplicação
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '..', 'dist-desktop', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  // Mostrar janela suavemente ao carregar
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Abrir links externos no navegador padrão do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Menu nativo da aplicação ─────────────────────────────────────────────
function buildMenu() {
  const template = [
    // Menu Arquivo
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Recarregar',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.reload(),
        },
        { type: 'separator' },
        {
          label: 'Sair',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    // Menu Exibição
    {
      label: 'Exibição',
      submenu: [
        {
          label: 'Tela cheia',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          },
        },
        {
          label: 'Zoom padrão',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow && mainWindow.webContents.setZoomFactor(1),
        },
        {
          label: 'Aumentar zoom',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const f = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(Math.min(f + 0.1, 2.5));
            }
          },
        },
        {
          label: 'Reduzir zoom',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const f = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(Math.max(f - 0.1, 0.5));
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Ferramentas do desenvolvedor',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
      ],
    },
    // Menu Ajuda
    {
      label: 'Ajuda',
      submenu: [
        {
          label: `Versão ${APP_VER}`,
          enabled: false,
        },
        { type: 'separator' },
        {
          label: 'Sobre o Fraser Alexander ERP',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre',
              message: APP_NAME,
              detail: `Versão: ${APP_VER}\n\nSistema integrado de gestão de operações para mineração.\n\n© 2025 Fraser Alexander`,
              buttons: ['Fechar'],
              icon: path.join(__dirname, 'icon.png'),
            });
          },
        },
      ],
    },
  ];

  // macOS: adicionar menu "Fraser Alexander ERP" no início
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about', label: 'Sobre' },
        { type: 'separator' },
        { role: 'services', label: 'Serviços' },
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar' },
        { role: 'hideOthers', label: 'Ocultar outros' },
        { role: 'unhide', label: 'Mostrar todos' },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Ciclo de vida do app ─────────────────────────────────────────────────
app.whenReady().then(() => {
  buildMenu();
  createWindow();

  // macOS: recriar janela ao clicar no ícone do dock
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
