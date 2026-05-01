/**
 * Floating mini recorder window.
 *
 * Frameless, transparent, always-on-top, 320x140. Rendered by the same
 * renderer bundle but at the hash route `#/mini-recorder`, which mounts a
 * compact UI showing live amplitude + elapsed timer + stop button.
 *
 * Lifecycle:
 *  - `showMiniRecorder()` creates (or focuses) the window and broadcasts
 *    `recording:state` so the renderer knows to start animating.
 *  - When the main window is restored, we close the mini.
 *  - When recording stops, we close the mini.
 *
 * The renderer is responsible for actually capturing audio (AudioWorklet
 * lives there) — the mini window only visualises the existing amplitude
 * store via IPC pings forwarded by the main window.
 */
import { BrowserWindow, app, ipcMain, screen } from 'electron';
import { join } from 'node:path';

const isDev = !app.isPackaged;

let miniWin: BrowserWindow | null = null;

export function isMiniRecorderOpen(): boolean {
  return miniWin !== null && !miniWin.isDestroyed();
}

export function showMiniRecorder(): BrowserWindow {
  if (isMiniRecorderOpen()) {
    miniWin!.show();
    miniWin!.focus();
    return miniWin!;
  }

  const display = screen.getPrimaryDisplay();
  const wa = display.workArea;
  const width = 320;
  const height = 140;
  const x = wa.x + wa.width - width - 24;
  const y = wa.y + wa.height - height - 24;

  miniWin = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  miniWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void miniWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/mini-recorder`);
  } else {
    void miniWin.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/mini-recorder'
    });
  }

  miniWin.on('ready-to-show', () => miniWin?.show());
  miniWin.on('closed', () => {
    miniWin = null;
  });

  return miniWin;
}

export function closeMiniRecorder(): void {
  if (isMiniRecorderOpen()) {
    miniWin!.close();
    miniWin = null;
  }
}

export function broadcastToMini<T>(channel: string, payload: T): void {
  if (isMiniRecorderOpen()) {
    miniWin!.webContents.send(channel, payload);
  }
}

export function registerMiniRecorderIpc(): void {
  ipcMain.handle('mini:show', () => {
    showMiniRecorder();
  });
  ipcMain.handle('mini:close', () => {
    closeMiniRecorder();
  });
  ipcMain.handle('mini:isOpen', () => isMiniRecorderOpen());

  // Mini window forwards "amplitude" pings from main window into its own
  // store. We bridge them as broadcasts so any window can listen.
  ipcMain.on('mini:amplitude', (_e, payload) => {
    broadcastToMini('mini:amplitude', payload);
  });

  // Mini window's stop button posts here; we re-broadcast as the standard
  // recording-toggle so the main window's hooks fire.
  ipcMain.on('mini:toggle-record', () => {
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send('menu:toggle-record');
    }
  });

  // Renderer (main window) decides whether recording is active and asks
  // main to open the mini recorder. Avoids duplicating recording-state
  // tracking in main.
  ipcMain.handle('mini:openIfRecording', (_e, recording: boolean) => {
    if (recording) showMiniRecorder();
    else closeMiniRecorder();
  });
}
