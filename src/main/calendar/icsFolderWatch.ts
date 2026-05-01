/**
 * Local .ics folder watcher.
 *
 * For each enabled `ics-folder` subscription, watch the folder for .ics files
 * (add / change). On any event, re-parse every .ics in the folder and
 * replace the events under that subscription.
 *
 * One chokidar watcher per subscription. Watchers are recreated on
 * subscription changes by `restart()`.
 */
import { app } from 'electron';
import chokidar, { type FSWatcher } from 'chokidar';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { calendarEventsRepo } from './repo';
import { calendarSubscriptionsRepo, type CalendarSubscription } from './subscriptions';
import { parseIcsBuffer } from './icsParse';

interface ActiveWatcher {
  subscriptionId: string;
  watcher: FSWatcher;
}

let active: ActiveWatcher[] = [];
let onEvents: (() => void) | null = null;

export function setFolderWatcherCallback(cb: (() => void) | null): void {
  onEvents = cb;
}

export function defaultFolderPath(): string {
  return join(app.getPath('documents'), 'Oli', 'Calendar');
}

async function syncFolder(sub: CalendarSubscription): Promise<void> {
  if (!sub.folderPath) return;
  try {
    await mkdir(sub.folderPath, { recursive: true });
    const entries = await readdir(sub.folderPath);
    const all: ReturnType<typeof parseIcsBuffer> = [];
    for (const f of entries.filter((n) => n.toLowerCase().endsWith('.ics'))) {
      const text = await readFile(join(sub.folderPath, f), 'utf8');
      all.push(...parseIcsBuffer(text, 'ics'));
    }
    calendarEventsRepo.replaceForSubscription(sub.id, all);
    calendarSubscriptionsRepo.markSynced(sub.id, null);
    onEvents?.();
  } catch (err) {
    calendarSubscriptionsRepo.markSynced(sub.id, (err as Error).message);
  }
}

export async function startFolderWatchers(): Promise<void> {
  await stopFolderWatchers();
  const subs = calendarSubscriptionsRepo
    .list()
    .filter((s) => s.kind === 'ics-folder' && s.enabled);
  for (const sub of subs) {
    if (!sub.folderPath) continue;
    await mkdir(sub.folderPath, { recursive: true }).catch(() => undefined);
    const watcher = chokidar.watch(`${sub.folderPath}/*.ics`, {
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 100 }
    });
    let pending: NodeJS.Timeout | null = null;
    const debounceSync = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        void syncFolder(sub);
      }, 300);
    };
    watcher.on('add', debounceSync);
    watcher.on('change', debounceSync);
    watcher.on('unlink', debounceSync);
    watcher.on('error', (err) => {
      calendarSubscriptionsRepo.markSynced(sub.id, (err as Error).message);
    });
    active.push({ subscriptionId: sub.id, watcher });
  }
}

export async function stopFolderWatchers(): Promise<void> {
  for (const a of active) {
    try {
      await a.watcher.close();
    } catch {
      /* ignore */
    }
  }
  active = [];
}
