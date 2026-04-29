import { createWorkletBlobUrl } from './pcm-worklet';
import { downsampleTo16k } from './resample';

export interface CaptureHandle {
  stop: () => Promise<void>;
}

export interface CaptureCallbacks {
  onChunk: (samples: Float32Array) => void;
  onError: (err: Error) => void;
}

function handleWorkletChunks(
  node: AudioWorkletNode,
  callbacks: CaptureCallbacks
): () => Float32Array {
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

  return () => {
    const out = pending;
    pending = new Float32Array(0);
    return out;
  };
}

async function installMixerWorklet(ctx: AudioContext): Promise<void> {
  const workletUrl = createWorkletBlobUrl();
  await ctx.audioWorklet.addModule(workletUrl);
  URL.revokeObjectURL(workletUrl);
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

  await installMixerWorklet(ctx);

  const sysSource = ctx.createMediaStreamSource(new MediaStream(displayStream.getAudioTracks()));
  const micSource = ctx.createMediaStreamSource(micStream);

  const node = new AudioWorkletNode(ctx, 'floyd-mixer', {
    numberOfInputs: 2,
    numberOfOutputs: 0
  });

  sysSource.connect(node, 0, 0);
  micSource.connect(node, 0, 1);

  const drainPending = handleWorkletChunks(node, callbacks);

  return {
    stop: async () => {
      try {
        node.disconnect();
        sysSource.disconnect();
        micSource.disconnect();
        displayStream?.getTracks().forEach((t) => t.stop());
        micStream?.getTracks().forEach((t) => t.stop());
        const pending = drainPending();
        if (pending.length > 0) callbacks.onChunk(pending);
        await ctx.close();
      } catch (err) {
        callbacks.onError(err as Error);
      }
    }
  };
}

/**
 * Native WASAPI loopback runs in the main process. The renderer still owns mic
 * permissions and streams 16kHz mono mic chunks over IPC for main-process mixing.
 */
export async function startMicCapture(callbacks: CaptureCallbacks): Promise<CaptureHandle> {
  const ctx = new AudioContext();
  let micStream: MediaStream | null = null;

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
  } catch (err) {
    callbacks.onError(err as Error);
    throw err;
  }

  await installMixerWorklet(ctx);

  const micSource = ctx.createMediaStreamSource(micStream);
  const node = new AudioWorkletNode(ctx, 'floyd-mixer', {
    numberOfInputs: 1,
    numberOfOutputs: 0
  });

  micSource.connect(node, 0, 0);
  const drainPending = handleWorkletChunks(node, callbacks);

  return {
    stop: async () => {
      try {
        node.disconnect();
        micSource.disconnect();
        micStream?.getTracks().forEach((t) => t.stop());
        const pending = drainPending();
        if (pending.length > 0) callbacks.onChunk(pending);
        await ctx.close();
      } catch (err) {
        callbacks.onError(err as Error);
      }
    }
  };
}
