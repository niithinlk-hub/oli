import { useEffect } from 'react';
import { useMeetingsStore } from '../store/meetings';
import { OliLogoHorizontal } from './brand/OliLogoHorizontal';

interface Props {
  onOpenSettings?: () => void;
  onOpenBrand?: () => void;
  onOpenSearch?: () => void;
  upcomingSlot?: React.ReactNode;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function MeetingList({ onOpenSettings, onOpenBrand, onOpenSearch, upcomingSlot }: Props) {
  const { meetings, selectedId, refresh, select, createMeeting } = useMeetingsStore();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleNew = async () => {
    const title = `Meeting · ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    await createMeeting(title);
  };

  return (
    <aside className="w-80 shrink-0 border-r border-line bg-white flex flex-col">
      <div className="titlebar-drag h-14 flex items-center justify-between px-4 border-b border-line">
        <button
          onClick={onOpenBrand}
          className="rounded-md hover:bg-surface-ice p-1 -m-1 transition"
          title="Brand"
        >
          <OliLogoHorizontal iconSize={28} wordmarkSize={22} />
        </button>
        <div className="flex items-center gap-1">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="text-caption px-2 py-1.5 rounded-md text-ink-secondary hover:bg-surface-cloud"
              title="Settings"
            >
              ⚙
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-line space-y-2">
        <button
          onClick={handleNew}
          className="w-full px-3 py-2 rounded-button text-btn text-white shadow-floating hover:opacity-95 transition"
          style={{ background: 'var(--oli-gradient-primary)' }}
          title="Ctrl+N"
        >
          + New meeting
        </button>
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="w-full px-3 py-2 rounded-button text-btn border border-line bg-white hover:bg-surface-cloud text-ink-secondary flex items-center justify-between"
            title="Ctrl+F"
          >
            <span className="flex items-center gap-2">
              <span className="text-ink-muted">⌕</span>
              Search memory…
            </span>
            <kbd className="text-caption text-ink-muted font-mono">Ctrl+F</kbd>
          </button>
        )}
      </div>

      {upcomingSlot && (
        <div className="px-4 py-3 border-b border-line bg-surface-cloud">{upcomingSlot}</div>
      )}

      <div className="px-4 pt-3 pb-1 text-caption uppercase tracking-wider text-ink-muted">
        Recent
      </div>
      <div className="flex-1 overflow-y-auto">
        {meetings.length === 0 ? (
          <p className="text-ink-muted text-body-sm px-4 py-6">
            No meetings yet. Start with the button above — Oli is ready to listen.
          </p>
        ) : (
          meetings.map((m) => (
            <button
              key={m.id}
              onClick={() => select(m.id)}
              className={`w-full text-left px-4 py-3 border-b border-line/60 hover:bg-surface-cloud transition ${
                selectedId === m.id ? 'bg-surface-ice' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <StatusDot status={m.status} />
                <div className="text-body-sm font-medium truncate flex-1">{m.title}</div>
              </div>
              <div className="text-caption text-ink-muted mt-1 ml-4">
                {formatDate(m.startedAt)} · {m.status}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    recording: 'bg-oli-coral',
    transcribing: 'bg-oli-azure',
    enhancing: 'bg-oli-violet',
    done: 'bg-oli-teal',
    idle: 'bg-ink-muted',
    error: 'bg-oli-amber'
  };
  const cls = map[status] ?? 'bg-ink-muted';
  return <span className={`h-2 w-2 rounded-full shrink-0 ${cls}`} />;
}
