import { BrowserWindow, Notification } from 'electron';
import { isConnected as googleConnected, fetchUpcomingEvents as googleFetch } from './google';
import {
  isConnected as outlookConnected,
  fetchUpcomingEvents as outlookFetch
} from './outlook';
import { calendarEventsRepo } from './repo';
import { calendarSubscriptionsRepo } from './subscriptions';
import { syncIcsSubscription } from './icsSubscription';
import { syncOutlookCom } from './outlookCom';
import { startFolderWatchers, setFolderWatcherCallback } from './icsFolderWatch';
import type { CalendarEvent } from '@shared/types';

const POLL_INTERVAL_MS = 5 * 60_000;
const LOOKAHEAD_MS = 12 * 60 * 60_000; // 12h
const NOTIFY_LEAD_MS = 2 * 60_000;     // 2 min before

const notified = new Map<string, number>(); // externalId -> startsAt
const PRUNE_AFTER_MS = 60 * 60_000; // drop entries 1h after they fired
let pollTimer: ReturnType<typeof setInterval> | null = null;

function pruneNotified(): void {
  const cutoff = Date.now() - PRUNE_AFTER_MS;
  for (const [id, startsAt] of notified) {
    if (startsAt < cutoff) notified.delete(id);
  }
}

function broadcast<T>(channel: string, payload: T): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

async function pollOnce(): Promise<void> {
  let touched = false;
  try {
    if (await googleConnected()) {
      await googleFetch(LOOKAHEAD_MS);
      touched = true;
    }
  } catch (err) {
    console.warn('google poll failed:', (err as Error).message);
  }
  try {
    if (await outlookConnected()) {
      await outlookFetch(LOOKAHEAD_MS);
      touched = true;
    }
  } catch (err) {
    console.warn('outlook poll failed:', (err as Error).message);
  }

  // Phase 2 subscriptions: ICS URLs + Outlook COM. Folder watcher pushes
  // events out-of-band via chokidar; poller doesn't drive it.
  for (const sub of calendarSubscriptionsRepo.list().filter((s) => s.enabled)) {
    const dueAt = (sub.lastSyncedAt ?? 0) + sub.pollMinutes * 60_000;
    if (dueAt > Date.now()) continue;
    try {
      if (sub.kind === 'ics-url') {
        const r = await syncIcsSubscription(sub);
        if (r.ok) touched = true;
      } else if (sub.kind === 'outlook-com') {
        const r = await syncOutlookCom(sub);
        if (r.ok) touched = true;
      }
    } catch (err) {
      console.warn(`subscription ${sub.id} (${sub.kind}) poll failed:`, (err as Error).message);
    }
  }

  if (touched) broadcast('calendar:updated', { at: Date.now() });
}

function scheduleNotifications(): void {
  pruneNotified();
  const now = Date.now();
  const upcoming = calendarEventsRepo.upcoming(now, NOTIFY_LEAD_MS + 60_000);
  for (const ev of upcoming) {
    if (notified.has(ev.externalId)) continue;
    const fireAt = ev.startsAt - NOTIFY_LEAD_MS;
    const delay = Math.max(0, fireAt - now);
    notified.set(ev.externalId, ev.startsAt);
    setTimeout(() => fireMeetingNotification(ev), delay);
  }
}

function fireMeetingNotification(ev: CalendarEvent): void {
  const minsTo = Math.round((ev.startsAt - Date.now()) / 60_000);
  const body = `${ev.title}${minsTo > 0 ? ` · starts in ${minsTo} min` : ' · starting now'}`;
  if (!Notification.isSupported()) return;
  const notif = new Notification({
    title: 'Oli — meeting starting',
    body,
    silent: false
  });
  notif.on('click', () => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.show();
      win.focus();
      win.webContents.send('calendar:notify-clicked', { event: ev });
    }
  });
  notif.show();
}

export function startCalendarPoller(): void {
  if (pollTimer) return;
  setFolderWatcherCallback(() => broadcast('calendar:updated', { at: Date.now() }));
  void startFolderWatchers();
  void pollOnce().then(scheduleNotifications);
  pollTimer = setInterval(async () => {
    await pollOnce();
    scheduleNotifications();
  }, POLL_INTERVAL_MS);
}

export function stopCalendarPoller(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  notified.clear();
}
