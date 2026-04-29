import { readFile } from 'node:fs/promises';
import { calendarEventsRepo } from './repo';

interface IcsEventLike {
  type?: string;
  uid?: string;
  summary?: string;
  start?: Date;
  end?: Date;
  attendee?: any;
  location?: string;
  url?: string;
}

export async function importIcsFile(filePath: string): Promise<{ imported: number }> {
  const raw = await readFile(filePath, 'utf8');
  // Lazy-load node-ical (heavy CommonJS module).
  const ical = (await import('node-ical')) as unknown as {
    parseICS: (text: string) => Record<string, IcsEventLike>;
  };
  const parsed = ical.parseICS(raw);

  const events: Parameters<typeof calendarEventsRepo.upsertMany>[0] = [];
  for (const key of Object.keys(parsed)) {
    const e = parsed[key];
    if (!e || e.type !== 'VEVENT') continue;
    if (!e.start || !e.end || !e.uid) continue;

    const attendees: string[] = [];
    if (Array.isArray(e.attendee)) {
      for (const a of e.attendee) {
        const v = typeof a === 'string' ? a : a?.val ?? a?.params?.CN;
        if (v) attendees.push(String(v).replace(/^mailto:/i, ''));
      }
    } else if (e.attendee) {
      const a = e.attendee as any;
      const v = typeof a === 'string' ? a : a?.val ?? a?.params?.CN;
      if (v) attendees.push(String(v).replace(/^mailto:/i, ''));
    }

    events.push({
      provider: 'ics',
      externalId: e.uid,
      title: e.summary ?? '(no title)',
      startsAt: e.start.getTime(),
      endsAt: e.end.getTime(),
      attendees,
      meetingUrl: e.url ?? null
    });
  }

  if (events.length > 0) calendarEventsRepo.upsertMany(events);
  return { imported: events.length };
}
