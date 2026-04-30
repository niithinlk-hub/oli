import { Tray, Menu, BrowserWindow, app } from 'electron';
import { buildTrayIcon } from './window-icon';

let tray: Tray | null = null;
let onOpenWindow: (() => void) | null = null;

export function setTrayOpenHandler(fn: () => void): void {
  onOpenWindow = fn;
}

function showAndFocus(): void {
  const wins = BrowserWindow.getAllWindows();
  const win = wins[0];
  if (!win) {
    onOpenWindow?.();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

export function initTray(): void {
  if (tray) return;

  const img = buildTrayIcon();

  try {
    tray = new Tray(img);
  } catch (err) {
    console.warn('tray init failed:', (err as Error).message);
    return;
  }
  tray.setToolTip('Oli — your AI meeting memory');

  const menu = Menu.buildFromTemplate([
    { label: 'Open Oli', click: showAndFocus },
    { type: 'separator' },
    { label: 'Quit Oli', click: () => { app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showAndFocus);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
