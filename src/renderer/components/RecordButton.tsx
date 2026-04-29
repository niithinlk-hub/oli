import { useRecorder } from '../audio/useRecorder';

interface Props {
  meetingId: string;
  onStateChange?: (recording: boolean) => void;
}

export function RecordButton({ meetingId, onStateChange }: Props) {
  const { state, error, start, stop } = useRecorder(meetingId);

  const recording = state === 'recording' || state === 'starting';
  const busy = state === 'starting' || state === 'stopping';

  const handleClick = async () => {
    if (recording) {
      await stop({ runFinalPass: true });
      onStateChange?.(false);
    } else {
      await start();
      onStateChange?.(true);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {error && (
        <span className="text-caption text-oli-coral max-w-[260px] truncate" title={error}>
          {error}
        </span>
      )}
      <button
        onClick={handleClick}
        disabled={busy}
        className="flex items-center gap-2 px-4 py-2 rounded-button text-btn text-white shadow-floating disabled:opacity-50 transition hover:opacity-95"
        style={{
          background: recording
            ? 'linear-gradient(135deg, #FB7185 0%, #F59E0B 100%)'
            : 'var(--oli-gradient-primary)'
        }}
      >
        <span className="relative flex h-2.5 w-2.5">
          {recording && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 animate-ping" />
          )}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        {state === 'starting'
          ? 'Starting…'
          : state === 'stopping'
            ? 'Stopping…'
            : recording
              ? 'Stop'
              : 'Record'}
      </button>
    </div>
  );
}
