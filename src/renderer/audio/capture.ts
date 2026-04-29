import { createWorkletBlobUrl } from './pcm-worklet';
import { downsampleTo16k } from './resample';

export interface CaptureHandle {
  stop: () => Promise<void>;
}

export interface CaptureCallbacks {
  onChunk: (samples: Float32Array) => void;
  onError: (err: Error) => void;
}

/**
 * Capture system audio (via getDisplayMedia) + mic, mix in an AudioWorklet,
 * downsample to 16kHz mono, deliver Float32 chunks to caller.
 *
 * Note: Electron prompts the user to pick a screen/window when getDisplayMedia
 * fires. Ask them to share the window playing the meeting (Zoom/Teams/Meet)
 * with audio enabled. macOS requires Screen Recording permission.
 */
export async function startCapture(callbacks: CaptureCallbacks): Promise<CaptureHandle> {
  const ctx = new AudioContext();

  let displayStream: MediaStream | null = null;
  let micStream: MediaStream | null = null;

  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });
    if (displayStream.getAudioTracks().length === 0) {
      throw new Error(
        'Selected source has no audio. Pick a window/screen with "Share audio" enabled.'
      );
    }
  } catch (err) {
    callbacks.onError(err as Error);
    throw err;
  }

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
  } catch (err) {
    displayStream?.getTracks().forEach((t) => t.stop());
    callbacks.onError(err as Error);
    throw err;
  }

  const workletUrl = createWorkletBlobUrl();
  await ctx.audioWorklet.addModule(workletUrl);
  URL.revokeObjectURL(workletUrl);

  const sysSource = ctx.createMediaStreamSource(new MediaStream(displayStream.getAudioTracks()));
  const micSource = ctx.createMediaStreamSource(micStream);

  const node = new AudioWorkletNode(ctx, 'floyd-mixer', {
    numberOfInputs: 2,
    numberOfOutputs: 0
  });

  sysSource.connect(node, 0, 0);
  micSource.connect(node, 0, 1);

  let pending = new Float32Array(0);
  const TARGET_FLUSH_SAMPLES = 16000; // ~1s at 16kHz

  node.port.onmessage = (e: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => {
    try {
      const { samples, sampleRate } = e.data;
      const ds = downsampleTo16k(samples, sampleRate);
      const merged = new Float32Array(pending.length + ds.length);
      merged.set(pending, 0);
      merged.set(ds, pending.length);
      pending = merged;
      while (pending.length >= TARGET_FLUSH_SAMPLES) {
        const out = pending.slice(0, TARGET_FLUSH_SAMPLES);
        pending = pending.slice(TARGET_FLUSH_SAMPLES);
        callbacks.onChunk(out);
      }
    } catch (err) {
      callbacks.onError(err as Error);
    }
  };

  return {
    stop: async () => {
      try {
        node.disconnect();
        sysSource.disconnect();
        micSource.disconnect();
        displayStream?.getTracks().forEach((t) => t.stop());
        micStream?.getTracks().forEach((t) => t.stop());
        if (pending.length > 0) {
          callbacks.onChunk(pending);
          pending = new Float32Array(0);
        }
        await ctx.close();
      } catch (err) {
        callbacks.onError(err as Error);
      }
    }
  };
}
