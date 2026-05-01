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
import {
  calendarSubscriptionsRepo,
  type SubscriptionKind,
  type NewSubscription
} from '../calendar/subscriptions';
import { syncIcsSubscription } from '../calendar/icsSubscription';
import { syncOutlookCom, isOutlookInstalled } from '../calendar/outlookCom';
import {
  startFolderWatchers,
  stopFolderWatchers,
  defaultFolderPath
} from '../calendar/icsFolderWatch';
import { getAutoRecordMode, setAutoRecordMode } from '../calendar/autoRecord';
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

  ipcMain.handle('calendar:forDay', (_e, dayMs: number) => {
    const start = new Date(dayMs);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return calendarEventsRepo.forDay(start.getTime(), end.getTime());
  });

  ipcMain.handle('calendar:setEventOverride', (_e, eventId: string, override: boolean | null) =>
    calendarEventsRepo.setAutoRecordOverride(eventId, override)
  );

  // Subscriptions CRUD
  ipcMain.handle('calendar:subs:list', () => calendarSubscriptionsRepo.list());
  ipcMain.handle('calendar:subs:add', async (_e, input: NewSubscription) => {
    const sub = calendarSubscriptionsRepo.create(input);
    if (sub.kind === 'ics-folder') {
      await startFolderWatchers();
    }
    if (sub.kind === 'ics-url') {
      void syncIcsSubscription(sub);
    }
    if (sub.kind === 'outlook-com') {
      void syncOutlookCom(sub);
    }
    return sub;
  });
  ipcMain.handle('calendar:subs:update', async (_e, id: string, patch: Partial<{ name: string; url: string | null; folderPath: string | null; color: string | null; pollMinutes: number; enabled: boolean }>) => {
    const sub = calendarSubscriptionsRepo.update(id, patch);
    if (sub.kind === 'ics-folder') await startFolderWatchers();
    return sub;
  });
  ipcMain.handle('calendar:subs:remove', async (_e, id: string) => {
    const sub = calendarSubscriptionsRepo.get(id);
    calendarSubscriptionsRepo.delete(id);
    if (sub?.kind === 'ics-folder') await startFolderWatchers();
  });
  ipcMain.handle('calendar:subs:sync', async (_e, id: string) => {
    const sub = calendarSubscriptionsRepo.get(id);
    if (!sub) return { ok: false, message: 'subscription not found' };
    if (sub.kind === 'ics-url') return syncIcsSubscription(sub);
    if (sub.kind === 'outlook-com') return syncOutlookCom(sub);
    if (sub.kind === 'ics-folder') {
      await stopFolderWatchers();
      await startFolderWatchers();
      return { ok: true, message: 'folder watcher restarted' };
    }
    return { ok: false, message: `unknown kind: ${sub.kind as SubscriptionKind}` };
  });

  // Outlook COM probe + folder defaults
  ipcMain.handle('calendar:outlookComAvailable', () => isOutlookInstalled());
  ipcMain.handle('calendar:defaultFolderPath', () => defaultFolderPath());

  // Auto-record settings
  ipcMain.handle('calendar:autoRecord:get', () => getAutoRecordMode());
  ipcMain.handle('calendar:autoRecord:set', (_e, mode: 'off' | 'prompt' | 'auto') =>
    setAutoRecordMode(mode)
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
