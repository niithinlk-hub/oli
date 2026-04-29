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
    meetingUrl: r.meeting_url
  };
}

export const calendarEventsRepo = {
  upsertMany(events: Omit<CalendarEvent, 'id'>[]): void {
    const db = initDb();
    const stmt = db.prepare(
      `INSERT INTO calendar_events (id, provider, external_id, title, starts_at, ends_at, attendees_json, meeting_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, external_id) DO UPDATE SET
         title=excluded.title,
         starts_at=excluded.starts_at,
         ends_at=excluded.ends_at,
         attendees_json=excluded.attendees_json,
         meeting_url=excluded.meeting_url`
    );
    const tx = db.transaction((items: Omit<CalendarEvent, 'id'>[]) => {
      for (const e of items) {
        stmt.run(
          randomUUID(),
          e.provider,
          e.externalId,
          e.title,
          e.startsAt,
          e.endsAt,
          JSON.stringify(e.attendees),
          e.meetingUrl
        );
      }
    });
    tx(events);
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
  byExternalId(provider: string, externalId: string): CalendarEvent | null {
    const r = initDb()
      .prepare('SELECT * FROM calendar_events WHERE provider = ? AND external_id = ?')
      .get(provider, externalId) as any;
    return r ? rowTo(r) : null;
  }
};
