import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  session,
  desktopCapturer,
  globalShortcut,
  protocol,
  net
} from 'electron';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { initDb } from './db/repo';
import { registerMeetingIpc } from './ipc/meetings';
import { registerRecordingIpc } from './ipc/recording';
import { registerSettingsIpc } from './ipc/settings';
import { meetingsRepo } from './db/repo';
import { registerLlmIpc } from './ipc/llm';
import { closeMiniRecorder, registerMiniRecorderIpc } from './windows/miniRecorder';
import { registerSttIpc } from './ipc/stt';
import { registerAiIpc } from './ipc/ai';
import { registerExtensionIpc } from './ipc/extension';
import { registerCalendarIpc } from './ipc/calendar';
import { registerExportIpc } from './ipc/export';
import { startLocalServer, stopLocalServer } from './server/localServer';
import { seedBuiltInTemplates } from './llm/templates';
import { startCalendarPoller, stopCalendarPoller } from './calendar/poller';
import { startAutoRecordScheduler, stopAutoRecordScheduler } from './calendar/autoRecord';
import { stopFolderWatchers } from './calendar/icsFolderWatch';
import { initTray, destroyTray, setTrayOpenHandler } from './tray';
import { initAutoUpdate, checkForUpdatesNow } from './auto-update';
import { buildAppMenu } from './menu';
import { buildWindowIcon } from './window-icon';

const isDev = !app.isPackaged;

// Custom audio protocol so the renderer can play meeting WAVs without
// loosening webSecurity. URL form: `oli-audio://{meetingId}`.
protocol.registerSchemesAsPrivileged([
  { scheme: 'oli-audio', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

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

  // Auto-open mini recorder when main window is hidden/minimized while
  // recording. We don't track recording state in main directly — we ask the
  // renderer via IPC. The renderer responds asynchronously via the mini
  // window itself if recording was active.
  const maybeOpenMini = () => {
    win.webContents.send('app:request-mini-on-hide');
  };
  win.on('minimize', maybeOpenMini);
  win.on('hide', maybeOpenMini);
  win.on('show', () => closeMiniRecorder());
  win.on('restore', () => closeMiniRecorder());

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

  protocol.handle('oli-audio', async (req) => {
    try {
      const url = new URL(req.url);
      // host carries the meeting id (URL parser lowercases hostnames, but our
      // ids are already lowercase UUIDs so this is fine).
      const meetingId = url.hostname;
      const m = meetingsRepo.get(meetingId);
      if (!m?.audioPath) return new Response('not found', { status: 404 });
      return net.fetch(pathToFileURL(m.audioPath).toString());
    } catch (err) {
      return new Response((err as Error).message, { status: 500 });
    }
  });

  registerMeetingIpc();
  registerRecordingIpc();
  registerSettingsIpc();
  registerLlmIpc();
  registerSttIpc();
  registerAiIpc();
  registerExtensionIpc();
  registerMiniRecorderIpc();
  void startLocalServer().catch((err) =>
    console.warn('local server failed to start:', (err as Error).message)
  );
  registerCalendarIpc();
  registerExportIpc();
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:checkForUpdates', () => checkForUpdatesNow());

  buildAppMenu();

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => {
        const screen = sources[0];
        if (!screen) return callback({});
        callback({ video: screen, audio: 'loopback' });
      })
      .catch((err) => {
        console.error('display picker failed:', err);
        callback({});
      });
  });

  let win = createMainWindow();
  initTray();
  setTrayOpenHandler(() => {
    if (BrowserWindow.getAllWindows().length === 0) {
      win = createMainWindow();
    }
  });
  startCalendarPoller();
  startAutoRecordScheduler();
  initAutoUpdate(win);

  // Global record toggle hotkey. Sends `menu:toggle-record` to whichever
  // window is focused — main window subscribes; mini-recorder window will too.
  // TODO(phase-1.8): make rebindable via Settings > Keyboard.
  const HOTKEY = 'CommandOrControl+Shift+R';
  const registered = globalShortcut.register(HOTKEY, () => {
    const focused = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!focused) {
      const w = createMainWindow();
      w.once('ready-to-show', () => w.webContents.send('menu:toggle-record'));
      return;
    }
    if (!focused.isVisible()) focused.show();
    focused.webContents.send('menu:toggle-record');
  });
  if (!registered) console.warn(`globalShortcut.register('${HOTKEY}') failed`);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('before-quit', () => {
  stopCalendarPoller();
  stopAutoRecordScheduler();
  void stopFolderWatchers();
  void stopLocalServer();
  destroyTray();
  globalShortcut.unregisterAll();
});

// On Windows we keep the process alive when the last window closes so the
// tray icon and calendar poller keep working. Quit happens via the tray
// menu's "Quit Oli" item or app menu File > Quit.
app.on('window-all-closed', () => {
  // intentionally empty
});
