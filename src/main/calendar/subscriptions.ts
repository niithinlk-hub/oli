/**
 * Calendar subscriptions repo.
 *
 * Three kinds of subscription source supported:
 *  - 'ics-url'     — public/secret iCal URL polled every N minutes
 *  - 'ics-folder'  — local folder watched via chokidar; any .ics inside is
 *                    parsed and upserted
 *  - 'outlook-com' — Windows-only PowerShell COM bridge against the locally
 *                    installed Outlook desktop client
 *
 * The existing Google + Outlook OAuth paths don't use this table — they
 * remain attached via secrets + settings keys. This table is purely for the
 * admin-policy-bypass ingest paths added in Phase 2.
 */
import { randomUUID } from 'node:crypto';
import { initDb } from '../db/repo';

export type SubscriptionKind = 'ics-url' | 'ics-folder' | 'outlook-com';

export interface CalendarSubscription {
  id: string;
  kind: SubscriptionKind;
  name: string;
  url: string | null;
  folderPath: string | null;
  color: string | null;
  pollMinutes: number;
  enabled: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

interface Row {
  id: string;
  kind: SubscriptionKind;
  name: string;
  url: string | null;
  folder_path: string | null;
  color: string | null;
  poll_minutes: number;
  enabled: number;
  last_synced_at: number | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

function rowToSub(r: Row): CalendarSubscription {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    url: r.url,
    folderPath: r.folder_path,
    color: r.color,
    pollMinutes: r.poll_minutes,
    enabled: r.enabled === 1,
    lastSyncedAt: r.last_synced_at,
    lastError: r.last_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export interface NewSubscription {
  kind: SubscriptionKind;
  name: string;
  url?: string | null;
  folderPath?: string | null;
  color?: string | null;
  pollMinutes?: number;
}

export const calendarSubscriptionsRepo = {
  list(): CalendarSubscription[] {
    const rows = initDb()
      .prepare('SELECT * FROM calendar_subscriptions ORDER BY created_at ASC')
      .all() as Row[];
    return rows.map(rowToSub);
  },

  get(id: string): CalendarSubscription | null {
    const row = initDb()
      .prepare('SELECT * FROM calendar_subscriptions WHERE id = ?')
      .get(id) as Row | undefined;
    return row ? rowToSub(row) : null;
  },

  create(input: NewSubscription): CalendarSubscription {
    const now = Date.now();
    const id = randomUUID();
    initDb()
      .prepare(
        `INSERT INTO calendar_subscriptions
         (id, kind, name, url, folder_path, color, poll_minutes, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(
        id,
        input.kind,
        input.name,
        input.url ?? null,
        input.folderPath ?? null,
        input.color ?? null,
        input.pollMinutes ?? 15,
        now,
        now
      );
    return this.get(id)!;
  },

  update(id: string, patch: Partial<CalendarSubscription>): CalendarSubscription {
    const cur = this.get(id);
    if (!cur) throw new Error(`subscription ${id} not found`);
    const merged = { ...cur, ...patch, updatedAt: Date.now() };
    initDb()
      .prepare(
        `UPDATE calendar_subscriptions SET
           kind=?, name=?, url=?, folder_path=?, color=?, poll_minutes=?, enabled=?,
           last_synced_at=?, last_error=?, updated_at=?
         WHERE id=?`
      )
      .run(
        merged.kind,
        merged.name,
        merged.url,
        merged.folderPath,
        merged.color,
        merged.pollMinutes,
        merged.enabled ? 1 : 0,
        merged.lastSyncedAt,
        merged.lastError,
        merged.updatedAt,
        id
      );
    return this.get(id)!;
  },

  delete(id: string): void {
    initDb().prepare('DELETE FROM calendar_subscriptions WHERE id = ?').run(id);
  },

  markSynced(id: string, error: string | null = null): void {
    initDb()
      .prepare(
        `UPDATE calendar_subscriptions SET last_synced_at=?, last_error=?, updated_at=? WHERE id=?`
      )
      .run(Date.now(), error, Date.now(), id);
  }
};
