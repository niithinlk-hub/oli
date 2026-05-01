/**
 * Shared ICS parser. Pulled out of `ics.ts` so the URL subscription poller
 * and the local folder watcher both reuse the same VEVENT extraction logic
 * without depending on file IO.
 */
import type { CalendarEvent } from '@shared/types';

interface IcsEventLike {
  type?: string;
  uid?: string;
  summary?: string;
  start?: Date;
  end?: Date;
  attendee?: unknown;
  location?: string;
  url?: string;
}

type UpsertEvent = Omit<CalendarEvent, 'id' | 'subscriptionId' | 'autoRecordOverride'>;

export function parseIcsBuffer(text: string, provider: 'ics' | 'outlook'): UpsertEvent[] {
  // Lazy require — node-ical is heavy and CJS-only.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ical = require('node-ical') as {
    parseICS: (s: string) => Record<string, IcsEventLike>;
  };
  const parsed = ical.parseICS(text);
  const out: UpsertEvent[] = [];
  for (const key of Object.keys(parsed)) {
    const e = parsed[key];
    if (!e || e.type !== 'VEVENT') continue;
    if (!e.start || !e.end || !e.uid) continue;

    const attendees: string[] = [];
    if (Array.isArray(e.attendee)) {
      for (const a of e.attendee) attendees.push(...attendeeToStrings(a));
    } else if (e.attendee) {
      attendees.push(...attendeeToStrings(e.attendee));
    }

    out.push({
      provider,
      externalId: e.uid,
      title: e.summary ?? '(no title)',
      startsAt: e.start.getTime(),
      endsAt: e.end.getTime(),
      attendees,
      meetingUrl: e.url ?? null
    });
  }
  return out;
}

function attendeeToStrings(a: unknown): string[] {
  if (!a) return [];
  if (typeof a === 'string') return [a.replace(/^mailto:/i, '')];
  const obj = a as { val?: string; params?: { CN?: string } };
  const v = obj.val ?? obj.params?.CN;
  return v ? [String(v).replace(/^mailto:/i, '')] : [];
}
