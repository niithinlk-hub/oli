import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CalendarEvent } from '@shared/types';
import { OliIcon } from '../components/brand/OliIcon';
import { useMeetingsStore } from '../store/meetings';

interface Props {
  onOpenMeeting: () => void;
  onOpenSettings: () => void;
  onHome: () => void;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function Calendar({ onOpenMeeting, onOpenSettings, onHome }: Props) {
  const [day, setDay] = useState<Date>(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const select = useMeetingsStore((s) => s.select);
  const createMeeting = useMeetingsStore((s) => s.createMeeting);

  const refresh = useCallback(async () => {
    const list = await window.floyd.calendar.forDay(day.getTime());
    setEvents(list);
    if (list.length > 0 && !list.some((e) => e.id === selectedId)) {
      setSelectedId(list[0].id);
    }
  }, [day, selectedId]);

  useEffect(() => {
    void refresh();
    const off = window.floyd.calendar.onUpdated(() => void refresh());
    return () => {
      off();
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.attendees.some((a) => a.toLowerCase().includes(q))
    );
  }, [events, search]);

  const selected = filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  const recordForEvent = async (ev: CalendarEvent) => {
    const m = await createMeeting(ev.title);
    select(m.id);
    onOpenMeeting();
  };

  const setOverride = async (ev: CalendarEvent, value: boolean | null) => {
    await window.floyd.calendar.setEventOverride(ev.id, value);
    await refresh();
  };

  return (
    <div className="h-screen flex flex-col bg-surface-cloud text-ink-primary">
      <header className="titlebar-drag h-14 flex items-center justify-between px-6 bg-white border-b border-line">
        <div className="flex items-center gap-3">
          <button
            onClick={onHome}
            className="text-caption px-2 py-1.5 rounded-md text-ink-secondary hover:bg-surface-cloud"
          >
            ← Home
          </button>
          <div className="flex items-center gap-2">
            <OliIcon size={22} />
            <span className="text-h4 font-display">Calendar</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DayPicker day={day} onChange={setDay} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events…"
            className="px-3 py-1.5 rounded-md border border-line bg-white text-body-sm w-56"
          />
          <button
            onClick={onOpenSettings}
            className="text-caption px-2 py-1.5 rounded-md text-ink-secondary hover:bg-surface-cloud"
          >
            Settings ⚙
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[360px_1fr] overflow-hidden">
        {/* Timeline */}
        <aside className="border-r border-line bg-white overflow-y-auto">
          <div className="px-5 py-3 border-b border-line">
            <p className="text-caption uppercase tracking-wider text-ink-muted">{fmtDay(day)}</p>
            <p className="text-body-sm text-ink-secondary mt-1">
              {filtered.length === 0 ? 'No events.' : `${filtered.length} events`}
            </p>
          </div>
          {filtered.length === 0 ? (
            <div className="px-5 py-6 text-body-sm text-ink-muted">
              No events for this day.{' '}
              <button
                onClick={onOpenSettings}
                className="underline text-oli-blue"
              >
                Connect a calendar →
              </button>
            </div>
          ) : (
            filtered.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelectedId(ev.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  void setOverride(ev, ev.autoRecordOverride === false ? null : false);
                }}
                className={`w-full text-left px-5 py-3 border-b border-line/60 hover:bg-surface-cloud transition ${
                  selected?.id === ev.id ? 'bg-surface-ice' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-caption text-ink-muted tabular-nums"
                  >
                    {fmtTime(ev.startsAt)}
                  </span>
                  <ProviderChip provider={ev.provider} />
                  {ev.autoRecordOverride === false && (
                    <span className="text-caption text-oli-coral">no auto</span>
                  )}
                </div>
                <div className="text-body-sm font-medium mt-1 truncate">{ev.title}</div>
                {ev.attendees.length > 0 && (
                  <div className="text-caption text-ink-muted mt-0.5 truncate">
                    {ev.attendees.length} attendee{ev.attendees.length === 1 ? '' : 's'}
                  </div>
                )}
              </button>
            ))
          )}
        </aside>

        {/* Detail */}
        <section className="overflow-y-auto p-8">
          {!selected ? (
            <div className="text-ink-muted">Select an event to see details.</div>
          ) : (
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-caption text-ink-muted">
                <ProviderChip provider={selected.provider} />
                <span>·</span>
                <span>
                  {fmtTime(selected.startsAt)} – {fmtTime(selected.endsAt)}
                </span>
              </div>
              <h2 className="text-h2 font-display mt-2">{selected.title}</h2>
              {selected.meetingUrl && (
                <a
                  href={selected.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-oli-blue underline text-body-sm mt-2 inline-block"
                >
                  {selected.meetingUrl}
                </a>
              )}
              {selected.attendees.length > 0 && (
                <div className="mt-4">
                  <p className="text-caption uppercase tracking-wider text-ink-muted">
                    Attendees
                  </p>
                  <ul className="mt-1 text-body-sm text-ink-secondary space-y-0.5">
                    {selected.attendees.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex items-center gap-2">
                <button
                  onClick={() => void recordForEvent(selected)}
                  className="px-5 py-2.5 rounded-button text-btn text-white shadow-floating"
                  style={{ background: 'var(--oli-gradient-primary)' }}
                >
                  Start recording for this event
                </button>
                {selected.autoRecordOverride === false ? (
                  <button
                    onClick={() => void setOverride(selected, null)}
                    className="text-btn px-3 py-2 rounded-button border border-line bg-white hover:bg-surface-cloud"
                  >
                    Re-enable auto
                  </button>
                ) : (
                  <button
                    onClick={() => void setOverride(selected, false)}
                    className="text-btn px-3 py-2 rounded-button border border-line bg-white hover:bg-surface-cloud"
                  >
                    Don&rsquo;t auto-record
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DayPicker({ day, onChange }: { day: Date; onChange: (d: Date) => void }) {
  const shift = (delta: number) => {
    const next = new Date(day);
    next.setDate(next.getDate() + delta);
    onChange(startOfDay(next));
  };
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => shift(-1)}
        className="text-caption px-2 py-1.5 rounded-md text-ink-secondary hover:bg-surface-cloud"
      >
        ‹
      </button>
      <button
        onClick={() => onChange(startOfDay(new Date()))}
        className="text-caption px-2 py-1.5 rounded-md text-ink-secondary hover:bg-surface-cloud"
      >
        Today
      </button>
      <button
        onClick={() => shift(1)}
        className="text-caption px-2 py-1.5 rounded-md text-ink-secondary hover:bg-surface-cloud"
      >
        ›
      </button>
      <input
        type="date"
        value={`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`}
        onChange={(e) => onChange(startOfDay(new Date(e.target.value)))}
        className="px-2 py-1 rounded-md border border-line bg-white text-body-sm"
      />
    </div>
  );
}

function ProviderChip({ provider }: { provider: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    google: { label: 'Google', cls: 'bg-oli-blue/15 text-oli-blue' },
    outlook: { label: 'Outlook', cls: 'bg-oli-violet/15 text-oli-violet' },
    ics: { label: 'ICS', cls: 'bg-oli-teal/15 text-oli-teal' }
  };
  const it = map[provider] ?? { label: provider, cls: 'bg-surface-cloud text-ink-muted' };
  return (
    <span className={`text-caption px-1.5 py-0.5 rounded font-medium ${it.cls}`}>
      {it.label}
    </span>
  );
}
