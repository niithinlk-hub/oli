import { useCallback, useEffect, useRef, useState } from 'react';
import { startCapture, startMicCapture, type CaptureHandle } from './capture';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'stopping' | 'error';

export function useRecorder(meetingId: string) {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<CaptureHandle | null>(null);

  useEffect(() => () => {
    void handleRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const start = useCallback(async () => {
    if (state !== 'idle' && state !== 'error') return;
    setState('starting');
    setError(null);
    try {
      await window.floyd.recording.start({
        meetingId,
        sampleRate: 16000,
        channels: 1
      });

      let handle: CaptureHandle;
      const nativeAvailable = await window.floyd.recording.nativeAvailable();
      if (nativeAvailable) {
        try {
          await window.floyd.recording.startNative(meetingId);
          const micHandle = await startMicCapture({
            onChunk: (samples) => {
              void window.floyd.recording.micChunk(meetingId, samples);
            },
            onError: (err) => {
              setError(err.message);
              setState('error');
            }
          });
          handle = {
            stop: async () => {
              await micHandle.stop();
              await window.floyd.recording.stopNative(meetingId);
            }
          };
        } catch (err) {
          console.warn('native capture unavailable, falling back to getDisplayMedia:', err);
          await window.floyd.recording.stopNative(meetingId).catch(() => undefined);
          handle = await startCapture({
            onChunk: (samples) => {
              void window.floyd.recording.chunk(meetingId, samples);
            },
            onError: (captureErr) => {
              setError(captureErr.message);
              setState('error');
            }
          });
        }
      } else {
        handle = await startCapture({
          onChunk: (samples) => {
            void window.floyd.recording.chunk(meetingId, samples);
          },
          onError: (err) => {
            setError(err.message);
            setState('error');
          }
        });
      }
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

  return { state, error, start, stop, reset };
}
