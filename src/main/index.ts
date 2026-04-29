import { app, BrowserWindow, ipcMain, shell, session, desktopCapturer } from 'electron';
import { join } from 'node:path';
import { initDb } from './db/repo';
import { registerMeetingIpc } from './ipc/meetings';
import { registerRecordingIpc } from './ipc/recording';
import { registerSettingsIpc } from './ipc/settings';
import { registerLlmIpc } from './ipc/llm';
import { registerCalendarIpc } from './ipc/calendar';
import { registerExportIpc } from './ipc/export';
import { seedBuiltInTemplates } from './llm/templates';
import { startCalendarPoller, stopCalendarPoller } from './calendar/poller';
import { initTray, destroyTray } from './tray';
import { initAutoUpdate, checkForUpdatesNow } from './auto-update';
import { buildAppMenu } from './menu';
import { buildWindowIcon } from './window-icon';

const isDev = !app.isPackaged;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: '#F8FAFC',
    icon: buildWindowIcon(),
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.on('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  initDb();
  seedBuiltInTemplates();

  registerMeetingIpc();
  registerRecordingIpc();
  registerSettingsIpc();
  registerLlmIpc();
  registerCalendarIpc();
  registerExportIpc();
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:checkForUpdates', () => checkForUpdatesNow());

  buildAppMenu();

  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen', 'window'] })
        .then((sources) => {
          const screen = sources.find((s) => s.id.startsWith('screen:')) ?? sources[0];
          if (!screen) return callback({});
          callback({ video: screen, audio: 'loopback' });
        })
        .catch((err) => {
          console.error('display picker failed:', err);
          callback({});
        });
    },
    { useSystemPicker: true }
  );

  const win = createMainWindow();
  initTray();
  startCalendarPoller();
  initAutoUpdate(win);
});

app.on('window-all-closed', () => {
  stopCalendarPoller();
  destroyTray();
  app.quit();
});
