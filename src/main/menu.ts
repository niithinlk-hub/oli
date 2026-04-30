import { Menu, BrowserWindow, type MenuItemConstructorOptions } from 'electron';

function send(channel: string, ...args: unknown[]): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (!win) return;
  win.webContents.send(channel, ...args);
}

export function buildAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New meeting',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('menu:new-meeting')
        },
        {
          label: 'Save notes',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('menu:save-notes')
        },
        {
          label: 'Export meeting…',
          accelerator: 'CmdOrCtrl+E',
          click: () => send('menu:export-meeting')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Search memory',
          accelerator: 'CmdOrCtrl+F',
          click: () => send('menu:search')
        }
      ]
    },
    {
      label: 'Meeting',
      submenu: [
        {
          label: 'Toggle recording',
          accelerator: 'CmdOrCtrl+R',
          click: () => send('menu:toggle-record')
        },
        {
          label: 'Ask Oli',
          accelerator: 'CmdOrCtrl+K',
          click: () => send('menu:ask-oli')
        },
        {
          label: 'Delete meeting',
          accelerator: 'CmdOrCtrl+Backspace',
          click: () => send('menu:delete-meeting')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'reload' },
        { label: 'Force reload', accelerator: 'CmdOrCtrl+Shift+F5', role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Oli',
          click: () => send('menu:about')
        },
        {
          label: 'Brand',
          click: () => send('menu:brand')
        },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => send('menu:settings')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
