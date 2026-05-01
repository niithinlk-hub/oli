import { initDb } from '../db/repo';
import type { CalendarEvent } from '@shared/types';
import { randomUUID } from 'node:crypto';

function rowTo(r: any): CalendarEvent {
  return {
    id: r.id,
    provider: r.provider,
    externalId: r.external_id,
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    attendees: JSON.parse(r.attendees_json) as string[],
    meetingUrl: r.meeting_url,
    subscriptionId: r.subscription_id ?? null,
    autoRecordOverride:
      r.auto_record_override == null ? null : r.auto_record_override === 1
  };
}

type UpsertEvent = Omit<CalendarEvent, 'id' | 'subscriptionId' | 'autoRecordOverride'> & {
  subscriptionId?: string | null;
};

export const calendarEventsRepo = {
  upsertMany(events: UpsertEvent[]): void {
    const db = initDb();
    const stmt = db.prepare(
      `INSERT INTO calendar_events
         (id, provider, external_id, title, starts_at, ends_at, attendees_json, meeting_url, subscription_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, external_id) DO UPDATE SET
         title=excluded.title,
         starts_at=excluded.starts_at,
         ends_at=excluded.ends_at,
         attendees_json=excluded.attendees_json,
         meeting_url=excluded.meeting_url,
         subscription_id=excluded.subscription_id`
    );
    const tx = db.transaction((items: UpsertEvent[]) => {
      for (const e of items) {
        stmt.run(
          randomUUID(),
          e.provider,
          e.externalId,
          e.title,
          e.startsAt,
          e.endsAt,
          JSON.stringify(e.attendees),
          e.meetingUrl,
          e.subscriptionId ?? null
        );
      }
    });
    tx(events);
  },
  /** Replace every event for a subscription with the supplied list. */
  replaceForSubscription(subscriptionId: string, events: UpsertEvent[]): void {
    const db = initDb();
    db.transaction(() => {
      db.prepare('DELETE FROM calendar_events WHERE subscription_id = ?').run(subscriptionId);
      this.upsertMany(events.map((e) => ({ ...e, subscriptionId })));
    })();
  },
  upcoming(now: number, withinMs: number): CalendarEvent[] {
    const rows = initDb()
      .prepare(
        `SELECT * FROM calendar_events
         WHERE starts_at >= ? AND starts_at <= ?
         ORDER BY starts_at ASC`
      )
      .all(now, now + withinMs) as any[];
    return rows.map(rowTo);
  },
  /** Events on a single calendar day, for the Calendar view. */
  forDay(dayStart: number, dayEnd: number): CalendarEvent[] {
    const rows = initDb()
      .prepare(
        `SELECT * FROM calendar_events
         WHERE starts_at < ? AND ends_at > ?
         ORDER BY starts_at ASC`
      )
      .all(dayEnd, dayStart) as any[];
    return rows.map(rowTo);
  },
  byExternalId(provider: string, externalId: string): CalendarEvent | null {
    const r = initDb()
      .prepare('SELECT * FROM calendar_events WHERE provider = ? AND external_id = ?')
      .get(provider, externalId) as any;
    return r ? rowTo(r) : null;
  },
  setAutoRecordOverride(eventId: string, override: boolean | null): void {
    initDb()
      .prepare('UPDATE calendar_events SET auto_record_override = ? WHERE id = ?')
      .run(override == null ? null : override ? 1 : 0, eventId);
  }
};
