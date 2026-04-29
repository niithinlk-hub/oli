import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

let mainWin: BrowserWindow | null = null;

export function initAutoUpdate(win: BrowserWindow): void {
  mainWin = win;
  if (!app.isPackaged) {
    console.log('auto-update: skipped in dev');
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.error('auto-update error:', err);
  });
  autoUpdater.on('update-available', (info) => {
    mainWin?.webContents.send('app:update-available', { version: info.version });
  });
  autoUpdater.on('update-downloaded', async (info) => {
    mainWin?.webContents.send('app:update-downloaded', { version: info.version });
    const choice = await dialog.showMessageBox(mainWin ?? new BrowserWindow(), {
      type: 'info',
      title: 'Update ready',
      message: `Oli ${info.version} is ready to install.`,
      detail: 'The app will restart to apply the update. Any unsaved notes are auto-saved.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1
    });
    if (choice.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn('auto-update check failed:', err.message);
  });

  // Re-check every 6 hours while app is open.
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('auto-update periodic check failed:', err.message);
    });
  }, 6 * 60 * 60_000);
}

export async function checkForUpdatesNow(): Promise<{ ok: boolean; message?: string }> {
  if (!app.isPackaged) return { ok: false, message: 'Updates only available in packaged app.' };
  try {
    const r = await autoUpdater.checkForUpdates();
    if (r?.updateInfo) {
      return { ok: true, message: `Latest: ${r.updateInfo.version}` };
    }
    return { ok: true, message: 'You are on the latest version.' };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
