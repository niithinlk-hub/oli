import { useEffect, useState } from 'react';
import type { CalendarEvent } from '@shared/types';

function formatTime(ts: number): string {
  const now = Date.now();
  const d = new Date(ts);
  const diff = ts - now;
  const mins = Math.round(diff / 60_000);
  if (mins < 60 && mins > 0) return `in ${mins} min`;
  if (mins <= 0) return 'now';
  return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
}

export function UpcomingEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const load = async () => {
    const list = await window.floyd.calendar.upcoming(6 * 60 * 60_000);
    setEvents(list.slice(0, 4));
  };

  useEffect(() => {
    void load();
    const off = window.floyd.calendar.onUpdated(() => void load());
    const interval = setInterval(load, 60_000);
    return () => {
      off();
      clearInterval(interval);
    };
  }, []);

  if (events.length === 0) return null;

  return (
    <div>
      <div className="text-caption uppercase tracking-wider text-ink-muted mb-2">
        Upcoming
      </div>
      <ul className="space-y-1.5">
        {events.map((e) => (
          <li
            key={e.id}
            className="rounded-md bg-white border border-line px-3 py-2 hover:border-oli-blue/40 transition"
          >
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-oli-violet" />
              <div className="text-body-sm font-medium truncate flex-1">{e.title}</div>
            </div>
            <div className="ml-3.5 text-caption text-ink-muted">{formatTime(e.startsAt)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
