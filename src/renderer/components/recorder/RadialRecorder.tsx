import { useEffect, useRef } from 'react';
import { useAmplitude } from '../../store/amplitude';
import type { RecorderState } from '../../audio/useRecorder';

interface Props {
  state: RecorderState;
  onToggle: () => void;
  size?: number;
}

/**
 * 200px circular record button. Gradient ring static when idle; 36 radial
 * amplitude bars animate when recording. Bars driven by useAmplitude store
 * (smoothed via requestAnimationFrame so we render at display rate, not chunk
 * rate).
 *
 * Two small VU meters live alongside (rendered by VuColumn below) — they tap
 * the same store but show RMS, not bar-level.
 */
export function RadialRecorder({ state, onToggle, size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isRecording = state === 'recording';
  const isError = state === 'error';

  // RAF loop pulls latest bars from the store every frame and paints them.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    // Smoothed bars decay back to zero between chunks for a nicer feel.
    let smoothed = new Array<number>(36).fill(0);

    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = size;
      const h = size;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const innerR = w / 2 - 24; // bars sit just outside the button
      const barLenMax = 18;

      const { micBars, loopbackBars } = useAmplitude.getState();
      // Combine mic + loopback by max for visualization
      const target = micBars.map((m, i) => Math.max(m, loopbackBars[i] ?? 0));
      smoothed = smoothed.map((s, i) => {
        const t = target[i] ?? 0;
        // Attack fast, release slower
        return t > s ? s + (t - s) * 0.5 : s + (t - s) * 0.12;
      });

      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2 - Math.PI / 2;
        const len = (isRecording ? smoothed[i] : 0) * barLenMax + 2;
        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * (innerR + len);
        const y2 = cy + Math.sin(angle) * (innerR + len);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isRecording ? `rgba(56, 189, 248, ${0.4 + smoothed[i] * 0.6})` : 'rgba(180, 192, 210, 0.45)';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [size, isRecording]);

  const buttonSize = size - 96;
  const ringStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: isError
      ? 'var(--oli-coral, #ff6b6b)'
      : 'conic-gradient(from 220deg, var(--oli-blue), var(--oli-azure), var(--oli-teal), var(--oli-blue))',
    padding: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  };

  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div className="relative" style={ringStyle}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ width: size, height: size }}
        />
        <button
          onClick={onToggle}
          className="rounded-full bg-white shadow-floating flex items-center justify-center transition active:scale-95"
          style={{ width: buttonSize, height: buttonSize }}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? (
            <span
              className="h-6 w-6 rounded-sm"
              style={{ background: 'var(--oli-coral, #ff6b6b)' }}
            />
          ) : state === 'starting' || state === 'stopping' ? (
            <span className="text-h3 font-display">…</span>
          ) : (
            <span
              className="block h-6 w-6 rounded-full"
              style={{ background: 'var(--oli-coral, #ff6b6b)' }}
            />
          )}
        </button>
        {isRecording && (
          <span
            className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full animate-pulse"
            style={{ background: 'var(--oli-coral, #ff6b6b)' }}
          />
        )}
      </div>
      <div className="flex items-center gap-3">
        <VuColumn label="Mic" source="mic" />
        <VuColumn label="Loopback" source="loopback" />
      </div>
    </div>
  );
}

function VuColumn({ label, source }: { label: string; source: 'mic' | 'loopback' }) {
  const rms = useAmplitude((s) => (source === 'mic' ? s.micRms : s.loopbackRms));
  const muted = useAmplitude((s) => (source === 'mic' ? s.micMuted : s.loopbackMuted));
  const setMuted = useAmplitude((s) =>
    source === 'mic' ? s.setMicMuted : s.setLoopbackMuted
  );
  const pct = Math.min(1, rms * 1.4); // mild boost so quiet speech reads
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-12 w-2 rounded-full bg-surface-cloud overflow-hidden flex flex-col-reverse">
        <div
          className="w-full transition-[height] duration-75"
          style={{
            height: muted ? 0 : `${pct * 100}%`,
            background:
              pct > 0.85
                ? 'var(--oli-coral, #ff6b6b)'
                : pct > 0.6
                  ? 'var(--oli-amber, #f4b400)'
                  : 'var(--oli-teal, #14b8a6)'
          }}
        />
      </div>
      <button
        onClick={() => setMuted(!muted)}
        className={`text-caption px-1.5 py-0.5 rounded ${
          muted ? 'bg-oli-coral/20 text-oli-coral' : 'text-ink-muted hover:bg-surface-cloud'
        }`}
        title={muted ? `Unmute ${label}` : `Mute ${label}`}
      >
        {muted ? `🔇 ${label}` : label}
      </button>
    </div>
  );
}
