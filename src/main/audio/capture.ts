import { app } from 'electron';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { appendChunk } from './recorder';

const SAMPLE_RATE = 16000;
const FLUSH_SAMPLES = SAMPLE_RATE;
const SINGLE_SOURCE_GRACE_SAMPLES = SAMPLE_RATE / 2;

type CaptureCallback = (err: Error | null, chunk?: Buffer | ArrayBuffer | Uint8Array) => void;
type Samples = Float32Array<ArrayBufferLike>;

interface LoopbackCapture {
  start: (cb: CaptureCallback) => void;
  stop: () => void;
}

interface NativeLoopbackAddon {
  LoopbackCapture: new () => LoopbackCapture;
}

interface NativeSession {
  meetingId: string;
  capture: LoopbackCapture;
  mixer: NativeMixer;
}

let addonCache: NativeLoopbackAddon | null | undefined;
let nativeSession: NativeSession | null = null;

const requireNative = createRequire(import.meta.url);

function nativeSearchPaths(): string[] {
  const appPath = app.getAppPath();
  return [
    join(appPath, 'native', 'win-loopback'),
    join(process.resourcesPath, 'native', 'win-loopback'),
    join(process.resourcesPath, 'app.asar.unpacked', 'native', 'win-loopback'),
    join(__dirname, '../../native/win-loopback')
  ];
}

function loadNativeAddon(): NativeLoopbackAddon | null {
  if (addonCache !== undefined) return addonCache;

  for (const basePath of nativeSearchPaths()) {
    if (!existsSync(basePath)) continue;
    try {
      const addon = requireNative(basePath) as NativeLoopbackAddon;
      if (typeof addon?.LoopbackCapture === 'function') {
        addonCache = addon;
        return addon;
      }
    } catch (err) {
      console.warn(`native loopback load failed from ${basePath}:`, (err as Error).message);
    }
  }

  addonCache = null;
  return null;
}

function concat(a: Samples, b: Samples): Float32Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function splitHead(
  samples: Samples,
  length: number
): { head: Samples; rest: Samples } {
  if (length >= samples.length) {
    return { head: samples, rest: new Float32Array(0) };
  }
  return {
    head: samples.slice(0, length),
    rest: samples.slice(length)
  };
}

function toFloat32Samples(chunk: Buffer | ArrayBuffer | Uint8Array): Float32Array {
  if (chunk instanceof ArrayBuffer) {
    return new Float32Array(chunk.slice(0));
  }
  const view = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
  const copy = view.slice();
  return new Float32Array(copy.buffer, copy.byteOffset, Math.floor(copy.byteLength / 4));
}

function mix(mic: Samples, loopback: Samples, length: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let value = (mic[i] ?? 0) + (loopback[i] ?? 0);
    if (value > 1) value = 1;
    else if (value < -1) value = -1;
    out[i] = value;
  }
  return out;
}

class NativeMixer {
  private mic: Samples = new Float32Array(0);
  private loopback: Samples = new Float32Array(0);
  private timer: NodeJS.Timeout | null = null;
  private writeChain = Promise.resolve();

  constructor(
    private readonly meetingId: string,
    private readonly onError: (err: Error) => void
  ) {}

  start(): void {
    this.timer = setInterval(() => this.drain(false), 250);
    this.timer.unref?.();
  }

  appendMic(samples: Float32Array): void {
    this.mic = concat(this.mic, samples);
    this.drain(false);
  }

  appendLoopback(samples: Float32Array): void {
    this.loopback = concat(this.loopback, samples);
    this.drain(false);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.drain(true);
    await this.writeChain;
  }

  private drain(force: boolean): void {
    for (;;) {
      const length = this.nextDrainLength(force);
      if (length <= 0) return;

      const micSplit = splitHead(this.mic, length);
      const loopbackSplit = splitHead(this.loopback, length);
      this.mic = micSplit.rest;
      this.loopback = loopbackSplit.rest;
      this.enqueue(mix(micSplit.head, loopbackSplit.head, length));
    }
  }

  private nextDrainLength(force: boolean): number {
    if (this.mic.length > 0 && this.loopback.length > 0) {
      return Math.min(this.mic.length, this.loopback.length, FLUSH_SAMPLES);
    }

    if (force) {
      return Math.min(Math.max(this.mic.length, this.loopback.length), FLUSH_SAMPLES);
    }

    if (this.mic.length >= SINGLE_SOURCE_GRACE_SAMPLES && this.loopback.length === 0) {
      return Math.min(this.mic.length, FLUSH_SAMPLES);
    }

    if (this.loopback.length >= SINGLE_SOURCE_GRACE_SAMPLES && this.mic.length === 0) {
      return Math.min(this.loopback.length, FLUSH_SAMPLES);
    }

    return 0;
  }

  private enqueue(samples: Float32Array): void {
    this.writeChain = this.writeChain
      .then(() => appendChunk(this.meetingId, samples))
      .catch((err) => {
        this.onError(err as Error);
      });
  }
}

export function isNativeLoopbackAvailable(): boolean {
  return loadNativeAddon() !== null;
}

export function startNativeLoopbackRecording(
  meetingId: string,
  onError: (err: Error) => void
): void {
  if (nativeSession) throw new Error('native loopback capture already in progress');

  const addon = loadNativeAddon();
  if (!addon) throw new Error('native loopback addon is not available');

  const mixer = new NativeMixer(meetingId, onError);
  const capture = new addon.LoopbackCapture();
  capture.start((err, chunk) => {
    if (err) {
      onError(err);
      return;
    }
    if (!chunk) return;
    try {
      mixer.appendLoopback(toFloat32Samples(chunk));
    } catch (cause) {
      onError(cause as Error);
    }
  });
  mixer.start();

  nativeSession = { meetingId, capture, mixer };
}

export function appendNativeMicChunk(meetingId: string, samples: Float32Array): void {
  if (!nativeSession || nativeSession.meetingId !== meetingId) return;
  nativeSession.mixer.appendMic(samples);
}

export async function stopNativeLoopbackRecording(meetingId?: string): Promise<void> {
  if (!nativeSession) return;
  if (meetingId && nativeSession.meetingId !== meetingId) return;

  const session = nativeSession;
  nativeSession = null;
  try {
    session.capture.stop();
  } finally {
    await session.mixer.stop();
  }
}
