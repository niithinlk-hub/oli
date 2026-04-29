import { useEffect, useRef, useState } from 'react';
import type { Meeting } from '@shared/types';
import { useMeetingsStore } from '../store/meetings';

interface Result {
  meeting: Meeting;
  snippet: string;
  matchType: 'title' | 'notes' | 'transcript';
}

interface Props {
  openSignal: number;
}

export function SearchBar({ openSignal }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const select = useMeetingsStore((s) => s.select);

  useEffect(() => {
    if (openSignal > 0) {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [openSignal]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await window.floyd.meetings.search(q);
      setResults(r);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setQ('');
    setResults([]);
  };

  const pick = (m: Meeting) => {
    select(m.id);
    close();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-[12vh]"
      style={{ background: 'rgba(7, 26, 51, 0.55)', backdropFilter: 'blur(6px)' }}
      onClick={close}
    >
      <div
        className="w-[640px] max-w-[92vw] rounded-card bg-white shadow-floating overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <span
            className="h-7 w-7 rounded-md flex items-center justify-center text-white text-sm"
            style={{ background: 'var(--oli-gradient-insight)' }}
          >
            ⌕
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
            }}
            placeholder="Search your meeting memory…"
            className="flex-1 bg-transparent outline-none text-body placeholder:text-ink-muted"
          />
          <span className="text-caption text-ink-muted">Esc</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <p className="px-4 py-3 text-caption text-ink-muted">Searching…</p>}
          {!loading && q.trim() && results.length === 0 && (
            <p className="px-4 py-6 text-body-sm text-ink-muted text-center">
              No matches in titles, notes, or transcripts.
            </p>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.meeting.id}-${r.matchType}-${i}`}
              onClick={() => pick(r.meeting)}
              className="w-full text-left px-4 py-3 hover:bg-surface-cloud border-b border-line/60 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <Tag matchType={r.matchType} />
                <span className="text-body-sm font-medium truncate flex-1">
                  {r.meeting.title}
                </span>
                <span className="text-caption text-ink-muted shrink-0">
                  {new Date(r.meeting.startedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <p className="text-caption text-ink-secondary mt-1 line-clamp-2">{r.snippet}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tag({ matchType }: { matchType: Result['matchType'] }) {
  const map: Record<Result['matchType'], { label: string; cls: string }> = {
    title: { label: 'Title', cls: 'bg-oli-blue/10 text-oli-blue' },
    notes: { label: 'Notes', cls: 'bg-oli-violet/10 text-oli-violet' },
    transcript: { label: 'Transcript', cls: 'bg-oli-teal/10 text-oli-teal' }
  };
  const { label, cls } = map[matchType];
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium ${cls}`}>
      {label}
    </span>
  );
}
