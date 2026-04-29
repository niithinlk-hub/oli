import { BrowserWindow, Notification } from 'electron';
import { isConnected as googleConnected, fetchUpcomingEvents as googleFetch } from './google';
import {
  isConnected as outlookConnected,
  fetchUpcomingEvents as outlookFetch
} from './outlook';
import { calendarEventsRepo } from './repo';
import type { CalendarEvent } from '@shared/types';

const POLL_INTERVAL_MS = 5 * 60_000;
const LOOKAHEAD_MS = 12 * 60 * 60_000; // 12h
const NOTIFY_LEAD_MS = 2 * 60_000;     // 2 min before

const notified = new Set<string>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

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
  if (touched) broadcast('calendar:updated', { at: Date.now() });
}

function scheduleNotifications(): void {
  const now = Date.now();
  const upcoming = calendarEventsRepo.upcoming(now, NOTIFY_LEAD_MS + 60_000);
  for (const ev of upcoming) {
    if (notified.has(ev.externalId)) continue;
    const fireAt = ev.startsAt - NOTIFY_LEAD_MS;
    const delay = Math.max(0, fireAt - now);
    notified.add(ev.externalId);
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
