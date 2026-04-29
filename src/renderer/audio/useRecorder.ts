import { useCallback, useEffect, useRef, useState } from 'react';
import { startCapture, type CaptureHandle } from './capture';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'stopping' | 'error';

export function useRecorder(meetingId: string) {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<CaptureHandle | null>(null);

  useEffect(() => () => {
    void handleRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    setState('starting');
    setError(null);
    try {
      await window.floyd.recording.start({
        meetingId,
        sampleRate: 16000,
        channels: 1
      });
      const handle = await startCapture({
        onChunk: (samples) => {
          void window.floyd.recording.chunk(meetingId, samples);
        },
        onError: (err) => {
          setError(err.message);
          setState('error');
        }
      });
      handleRef.current = handle;
      setState('recording');
    } catch (err) {
      setError((err as Error).message);
      setState('error');
      try {
        await window.floyd.recording.stop({ runFinalPass: false });
      } catch {
        // best-effort cleanup
      }
    }
  }, [meetingId, state]);

  const stop = useCallback(async (opts: { runFinalPass?: boolean } = {}) => {
    if (state !== 'recording' && state !== 'starting') return;
    setState('stopping');
    try {
      await handleRef.current?.stop();
      handleRef.current = null;
      await window.floyd.recording.stop({ runFinalPass: opts.runFinalPass ?? true });
      setState('idle');
    } catch (err) {
      setError((err as Error).message);
      setState('error');
    }
  }, [state]);

  return { state, error, start, stop };
}
