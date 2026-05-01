import { useEffect, useRef, useState } from 'react';
import type { TranscriptSegment } from '@shared/types';

interface Props {
  segments: TranscriptSegment[];
  /** When `true`, auto-scroll on new segments. Defaults true. */
  autoScroll?: boolean;
}

/**
 * Live captions panel. Auto-scrolls to bottom on new segments. Older lines
 * fade to 60% opacity. Latest segment gets a single pulse animation on
 * arrival. Inflight indicator shows up to 4 dots animating from the
 * `recording:inflight` IPC stream.
 *
 * Speaker labels render as colored chips — Phase 3 will populate from
 * diarization. For now everyone shows "Speaker".
 */
export function LiveCaptions({ segments, autoScroll = true }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [inflight, setInflight] = useState(0);
  const [queued, setQueued] = useState(0);
  const lastIdRef = useRef<number | null>(null);

  useEffect(() => {
    const off = window.floyd.recording.onInflight((p) => {
      setInflight(p.inflight);
      setQueued(p.queued);
    });
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segments, autoScroll]);

  // Track newest id for the pulse animation.
  useEffect(() => {
    const last = segments[segments.length - 1];
    if (last && last.id !== lastIdRef.current) {
      lastIdRef.current = last.id ?? null;
    }
  }, [segments]);

  return (
    <div className="flex flex-col h-full">
      <InflightDots inflight={inflight} queued={queued} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {segments.length === 0 ? (
          <p className="text-ink-muted text-body-sm">
            Live captions appear here while recording…
          </p>
        ) : (
          segments.map((s, i) => {
            const isLatest = i === segments.length - 1;
            const opacity = i < segments.length - 4 ? 0.6 : 1;
            return (
              <p
                key={`${s.id ?? i}-${s.startMs}`}
                className={`mb-2 text-body-sm leading-relaxed ${isLatest ? 'caption-pulse' : ''}`}
                style={{ opacity }}
              >
                <SpeakerChip speaker={(s as TranscriptSegment & { speaker?: string }).speaker ?? 'Speaker'} />
                <span className="font-mono text-caption text-ink-muted mx-2 tabular-nums">
                  {fmtTime(s.startMs)}
                </span>
                <span className="text-ink-primary">{s.text}</span>
              </p>
            );
          })
        )}
      </div>
    </div>
  );
}

function InflightDots({ inflight, queued }: { inflight: number; queued: number }) {
  if (inflight === 0 && queued === 0) return null;
  const slots = 4;
  return (
    <div className="flex items-center gap-1.5 px-6 pt-3 pb-1 text-caption text-ink-muted">
      <span>Transcribing</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: slots }).map((_, i) => {
          const active = i < inflight;
          return (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${active ? 'animate-pulse' : ''}`}
              style={{
                background: active
                  ? 'var(--oli-azure, #38bdf8)'
                  : 'var(--oli-border, #e1e8f1)'
              }}
            />
          );
        })}
      </div>
      {queued > 0 && <span className="ml-1">+ {queued} queued</span>}
    </div>
  );
}

function SpeakerChip({ speaker }: { speaker: string }) {
  // Hash speaker label to one of a fixed palette.
  const palette = [
    'bg-oli-blue/15 text-oli-blue',
    'bg-oli-violet/15 text-oli-violet',
    'bg-oli-teal/15 text-oli-teal',
    'bg-oli-amber/20 text-oli-amber',
    'bg-oli-coral/15 text-oli-coral'
  ];
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) hash = (hash * 31 + speaker.charCodeAt(i)) >>> 0;
  const cls = palette[hash % palette.length];
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-caption font-medium ${cls}`}>
      {speaker}
    </span>
  );
}

function fmtTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
