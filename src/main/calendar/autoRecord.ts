/**
 * Calendar-driven auto-record.
 *
 * Setting `calendar.autoRecord` ∈ {'off', 'prompt', 'auto'}.
 *  - 'off'    — do nothing (default).
 *  - 'prompt' — show a native Notification 60s before each event with
 *               Start / Skip buttons. Click Start → renderer creates a
 *               meeting + begins recording.
 *  - 'auto'   — start recording automatically + toast "Auto-recording".
 *
 * Per-event override stored in `calendar_events.auto_record_override`.
 *
 * Implementation: tick once a minute. For events starting in [now+45s, now+75s],
 * fire the prompt/auto. Dedup map (`fired`) prevents repeats.
 */
import { BrowserWindow, Notification } from 'electron';
import { calendarEventsRepo } from './repo';
import { settingsRepo } from '../db/settings';

const KEY = 'calendar.autoRecord';
type Mode = 'off' | 'prompt' | 'auto';

let intervalHandle: NodeJS.Timeout | null = null;
const fired = new Map<string, number>();

export function getAutoRecordMode(): Mode {
  const v = settingsRepo.get(KEY);
  return v === 'prompt' || v === 'auto' ? v : 'off';
}

export function setAutoRecordMode(mode: Mode): void {
  settingsRepo.set(KEY, mode);
}

export function startAutoRecordScheduler(): void {
  stopAutoRecordScheduler();
  intervalHandle = setInterval(tick, 60_000);
  // First tick after a short delay so we don't race app startup.
  setTimeout(tick, 5_000);
}

export function stopAutoRecordScheduler(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

function broadcast<T>(channel: string, payload: T): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload);
}

function tick(): void {
  const mode = getAutoRecordMode();
  if (mode === 'off') return;

  const now = Date.now();
  const upcoming = calendarEventsRepo.upcoming(now, 90_000);
  for (const ev of upcoming) {
    if (ev.autoRecordOverride === false) continue;
    if (fired.has(ev.id)) continue;
    const delta = ev.startsAt - now;
    if (delta < 30_000 || delta > 90_000) continue;
    fired.set(ev.id, now);

    if (mode === 'auto') {
      broadcast('calendar:auto-record-start', { event: ev });
    } else {
      const n = new Notification({
        title: `Meeting starting: ${ev.title}`,
        body: 'Click to start recording in Oli, or ignore to skip.',
        silent: false
      });
      n.on('click', () => {
        broadcast('calendar:auto-record-start', { event: ev });
      });
      n.show();
    }
  }

  // Garbage-collect entries older than 1 hour.
  const cutoff = now - 60 * 60_000;
  for (const [id, t] of fired) if (t < cutoff) fired.delete(id);
}
