import { useEffect, useState } from 'react';
import type { CalendarEvent } from '@shared/types';
import { OliIcon } from '../components/brand/OliIcon';
import { useMeetingsStore } from '../store/meetings';

interface Props {
  onOpenMeeting: () => void;
  onOpenEmail: () => void;
  onOpenSettings: () => void;
  onOpenBrand: () => void;
  onOpenCalendar: () => void;
}

function timeOfDayGreeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Late night';
}

function todayStr(d = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

export function Home({
  onOpenMeeting,
  onOpenEmail,
  onOpenSettings,
  onOpenBrand,
  onOpenCalendar
}: Props) {
  const meetings = useMeetingsStore((s) => s.meetings);
  const refresh = useMeetingsStore((s) => s.refresh);
  const select = useMeetingsStore((s) => s.select);
  const createMeeting = useMeetingsStore((s) => s.createMeeting);
  const [userName] = useState<string>('there');
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [hasSubs, setHasSubs] = useState<boolean | null>(null);

  useEffect(() => {
    void refresh();
    const refreshCal = async () => {
      const [evts, subs] = await Promise.all([
        window.floyd.calendar.forDay(Date.now()),
        window.floyd.calendar.subs.list()
      ]);
      setTodayEvents(evts);
      setHasSubs(subs.length > 0);
    };
    void refreshCal();
    const off = window.floyd.calendar.onUpdated(() => void refreshCal());
    return () => {
      off();
    };
  }, [refresh]);

  const recent = meetings.slice(0, 4);

  const startTestRecording = async () => {
    const m = await createMeeting('Test recording (auto-delete)');
    select(m.id);
    onOpenMeeting();
    // TODO(phase-1.9): wire 30s auto-stop + auto-delete-unless-saved guard.
    // For now lands the user in MeetingDetail with a flagged meeting; they
    // can record manually and decide to keep or delete.
  };

  return (
    <div
      className="h-screen w-full flex flex-col"
      style={{ background: 'var(--oli-gradient-soft-bg)' }}
    >
      <header className="titlebar-drag h-14 flex items-center justify-between px-6">
        <button
          onClick={onOpenBrand}
          className="rounded-md hover:bg-white/40 p-1 -m-1 transition flex items-center gap-2"
          title="Brand"
        >
          <OliIcon size={28} />
          <span className="text-h4 font-display">Oli</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="text-caption px-3 py-1.5 rounded-md text-ink-secondary hover:bg-white/60"
        >
          Settings ⚙
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto py-10">
        <div className="text-center max-w-3xl">
          <p className="text-caption uppercase tracking-wider text-ink-muted">{todayStr()}</p>
          <h1
            className="font-display mt-2 leading-tight"
            style={{
              fontSize: '3.25rem',
              backgroundImage: 'var(--oli-gradient-primary)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent'
            }}
          >
            {timeOfDayGreeting()}, {userName}.
          </h1>
          <p className="text-body text-ink-secondary mt-3">
            What do you want to do?
          </p>
        </div>

        {/* Today row */}
        <div className="mt-8 w-full max-w-5xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-caption uppercase tracking-wider text-ink-muted">Today</p>
            <button
              onClick={onOpenCalendar}
              className="text-caption text-oli-blue hover:underline"
            >
              Open calendar →
            </button>
          </div>
          {todayEvents.length === 0 ? (
            <div className="rounded-card border border-line bg-white px-4 py-3 text-body-sm text-ink-muted">
              {hasSubs === false ? (
                <>
                  No calendar connected.{' '}
                  <button
                    onClick={onOpenSettings}
                    className="text-oli-blue underline"
                  >
                    Connect a calendar →
                  </button>
                </>
              ) : (
                'Nothing on the calendar today.'
              )}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {todayEvents.map((ev) => (
                <EventCard
                  key={ev.id}
                  ev={ev}
                  onRecord={async () => {
                    const m = await createMeeting(ev.title);
                    select(m.id);
                    onOpenMeeting();
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">
          <TabCard
            title="Meeting recorder"
            tagline="Record · transcribe · enhance"
            body="Capture any meeting locally. Whisper transcribes — Groq cloud is fastest, local whisper.cpp is private. Then Oli turns rough notes into clean summaries, decisions, actions."
            cta="Start a meeting"
            gradient="var(--oli-gradient-primary)"
            onClick={onOpenMeeting}
          />
          <TabCard
            title="Email rephraser"
            tagline="Rewrite · reply · polish"
            body="Paste a draft. Pick a tone — professional, friendly, concise. Oli rewrites cleanly, fixes grammar, or drafts a reply. Ctrl+Enter to run."
            cta="Open rephraser"
            gradient="var(--oli-gradient-memory)"
            onClick={onOpenEmail}
          />
        </div>

        {/* Recent or empty-state */}
        {recent.length === 0 ? (
          <div className="mt-10 w-full max-w-3xl">
            <EmptyState onStartTest={startTestRecording} />
          </div>
        ) : (
          <div className="mt-10 w-full max-w-3xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-caption uppercase tracking-wider text-ink-muted">Recent</p>
              <kbd className="text-caption text-ink-muted font-mono">Ctrl+K to search</kbd>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recent.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    select(m.id);
                    onOpenMeeting();
                  }}
                  className="text-left rounded-card bg-white border border-line shadow-card hover:shadow-floating transition p-4"
                >
                  <p className="text-body-sm font-semibold truncate">{m.title}</p>
                  <p className="text-caption text-ink-muted mt-1">
                    {new Date(m.startedAt).toLocaleString()} · {m.status}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function EventCard({ ev, onRecord }: { ev: CalendarEvent; onRecord: () => void }) {
  const time = new Date(ev.startsAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  return (
    <div className="shrink-0 w-72 rounded-card border border-line bg-white shadow-card p-4">
      <p className="text-caption uppercase tracking-wider text-ink-muted">{time}</p>
      <p className="text-body-sm font-semibold mt-1 truncate">{ev.title}</p>
      {ev.attendees.length > 0 && (
        <p className="text-caption text-ink-muted truncate mt-0.5">
          {ev.attendees.length} attendee{ev.attendees.length === 1 ? '' : 's'}
        </p>
      )}
      <button
        onClick={onRecord}
        className="mt-3 w-full px-3 py-1.5 rounded-button text-btn text-white"
        style={{ background: 'var(--oli-gradient-primary)' }}
      >
        Record →
      </button>
    </div>
  );
}

function TabCard({
  title,
  tagline,
  body,
  cta,
  gradient,
  onClick
}: {
  title: string;
  tagline: string;
  body: string;
  cta: string;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-card bg-white border border-line shadow-card hover:shadow-floating transition overflow-hidden group"
    >
      <div className="h-2" style={{ background: gradient }} />
      <div className="p-6">
        <p className="text-caption uppercase tracking-wider text-ink-muted">{tagline}</p>
        <h2 className="text-h3 font-display mt-1">{title}</h2>
        <p className="text-body-sm text-ink-secondary mt-2 leading-relaxed">{body}</p>
        <span
          className="inline-block mt-5 px-4 py-2 rounded-button text-btn text-white"
          style={{ background: gradient }}
        >
          {cta} →
        </span>
      </div>
    </button>
  );
}

function EmptyState({ onStartTest }: { onStartTest: () => void }) {
  return (
    <div className="rounded-card border border-line bg-white p-8 shadow-card text-center">
      <div className="flex items-center justify-center gap-2 mb-4">
        <span
          className="h-6 w-6 rounded-full"
          style={{ background: 'var(--oli-gradient-primary)' }}
        />
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: 'var(--oli-gradient-memory)' }}
        />
        <span
          className="h-4 w-4 rounded-full"
          style={{ background: 'var(--oli-gradient-insight)' }}
        />
        <OliIcon size={28} />
        <span
          className="h-3 w-3 rounded-full bg-oli-coral"
        />
        <span
          className="h-5 w-5 rounded-full bg-oli-teal"
        />
      </div>
      <h3 className="text-h3 font-display">No meetings yet</h3>
      <p className="text-body-sm text-ink-secondary mt-2 max-w-md mx-auto">
        Run a quick 30-second test — Oli will record, transcribe, and enhance, so you can see the
        full pipeline before your next real meeting.
      </p>
      <button
        onClick={onStartTest}
        className="mt-5 px-5 py-2.5 rounded-button text-btn text-white shadow-floating"
        style={{ background: 'var(--oli-gradient-primary)' }}
      >
        Record a 30-second test
      </button>
    </div>
  );
}
