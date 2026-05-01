import { useEffect, useState } from 'react';

/**
 * Mini recorder window content. Renders inside the frameless transparent
 * BrowserWindow created by `src/main/windows/miniRecorder.ts`.
 *
 * Receives amplitude data via IPC from the main window's recording pipeline.
 * Stop button posts a toggle-record back to the main window.
 */
export function MiniRecorder() {
  const [bars, setBars] = useState<number[]>(Array(36).fill(0));
  const [elapsed, setElapsed] = useState(0);
  const [startedAt] = useState(Date.now());

  useEffect(() => {
    const off = window.floyd.mini.onAmplitude((p) => setBars(p.bars));
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => clearInterval(t);
  }, [startedAt]);

  const stop = () => window.floyd.mini.toggleRecord();
  const close = () => void window.floyd.mini.close();

  const totalSec = Math.floor(elapsed / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

  return (
    <div
      className="h-screen w-screen p-2"
      style={{
        background: 'rgba(255,255,255,0)',
        WebkitAppRegion: 'drag'
      } as React.CSSProperties}
    >
      <div
        className="h-full w-full rounded-card shadow-floating flex items-center gap-3 px-4"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.96))',
          border: '1px solid var(--oli-border, #e1e8f1)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full animate-pulse"
          style={{ background: 'var(--oli-coral, #ff6b6b)' }}
        />
        <div className="flex-1 flex items-end gap-[3px] h-9">
          {bars.map((b, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm transition-[height] duration-75"
              style={{
                height: `${Math.max(2, b * 100)}%`,
                background: 'var(--oli-azure, #38bdf8)'
              }}
            />
          ))}
        </div>
        <div className="font-mono tabular-nums text-body-sm text-ink-primary">
          {mm}:{ss}
        </div>
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={stop}
            className="h-8 w-8 rounded-full flex items-center justify-center text-white shadow-card"
            style={{ background: 'var(--oli-coral, #ff6b6b)' }}
            title="Stop recording"
          >
            ■
          </button>
          <button
            onClick={close}
            className="h-7 w-7 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface-cloud"
            title="Close mini window"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
