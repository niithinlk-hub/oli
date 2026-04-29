import { ipcMain, BrowserWindow, dialog } from 'electron';
import {
  connect as connectGoogle,
  disconnect as disconnectGoogle,
  isConnected as googleIsConnected,
  GOOGLE_SETTINGS_KEYS,
  fetchUpcomingEvents as googleFetch
} from '../calendar/google';
import {
  connect as connectOutlook,
  disconnect as disconnectOutlook,
  isConnected as outlookIsConnected,
  OUTLOOK_SETTINGS_KEYS,
  fetchUpcomingEvents as outlookFetch
} from '../calendar/outlook';
import { importIcsFile } from '../calendar/ics';
import { calendarEventsRepo } from '../calendar/repo';
import { settingsRepo } from '../db/settings';

export function registerCalendarIpc(): void {
  ipcMain.handle('calendar:status', async () => ({
    googleConnected: await googleIsConnected(),
    googleClientId: settingsRepo.get(GOOGLE_SETTINGS_KEYS.clientId),
    outlookConnected: await outlookIsConnected(),
    outlookClientId: settingsRepo.get(OUTLOOK_SETTINGS_KEYS.clientId)
  }));

  ipcMain.handle('calendar:setGoogleClientId', (_e, clientId: string | null) => {
    if (clientId) settingsRepo.set(GOOGLE_SETTINGS_KEYS.clientId, clientId);
    else settingsRepo.delete(GOOGLE_SETTINGS_KEYS.clientId);
  });
  ipcMain.handle('calendar:connectGoogle', () => connectGoogle());
  ipcMain.handle('calendar:disconnectGoogle', () => disconnectGoogle());

  ipcMain.handle('calendar:setOutlookClientId', (_e, clientId: string | null) => {
    if (clientId) settingsRepo.set(OUTLOOK_SETTINGS_KEYS.clientId, clientId);
    else settingsRepo.delete(OUTLOOK_SETTINGS_KEYS.clientId);
  });
  ipcMain.handle('calendar:connectOutlook', () => connectOutlook());
  ipcMain.handle('calendar:disconnectOutlook', () => disconnectOutlook());

  ipcMain.handle('calendar:importIcs', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: 'Import ICS calendar file',
      properties: ['openFile'],
      filters: [{ name: 'iCalendar', extensions: ['ics'] }]
    });
    if (res.canceled || res.filePaths.length === 0) return { ok: false, message: 'Cancelled.' };
    try {
      const r = await importIcsFile(res.filePaths[0]);
      return { ok: true, imported: r.imported };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  });

  ipcMain.handle('calendar:upcoming', (_e, withinMs: number = 12 * 60 * 60_000) =>
    calendarEventsRepo.upcoming(Date.now(), withinMs)
  );

  ipcMain.handle('calendar:refresh', async () => {
    const errors: string[] = [];
    if (await googleIsConnected()) {
      try {
        await googleFetch(12 * 60 * 60_000);
      } catch (err) {
        errors.push(`google: ${(err as Error).message}`);
      }
    }
    if (await outlookIsConnected()) {
      try {
        await outlookFetch(12 * 60 * 60_000);
      } catch (err) {
        errors.push(`outlook: ${(err as Error).message}`);
      }
    }
    return { ok: errors.length === 0, message: errors.join('; ') };
  });
}
