import { app } from 'electron';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { WavWriter, writeWavFile } from './wav';
import type { RecordingStartArgs, RecordingStopResult } from '@shared/types';

const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const CHUNK_WINDOW_SECONDS = 10;
const CHUNK_WINDOW_SAMPLES = SAMPLE_RATE * CHUNK_WINDOW_SECONDS;

export interface ChunkWindow {
  meetingId: string;
  windowIndex: number;
  startMs: number;
  endMs: number;
  filePath: string;
}

export type WindowReadyCallback = (window: ChunkWindow) => void;

interface ActiveSession {
  meetingId: string;
  fullWriter: WavWriter;
  fullPath: string;
  startedAt: number;
  totalSamples: number;
  rollBuffer: Float32Array;
  rollOffset: number;
  windowIndex: number;
  windowDir: string;
  onWindowReady: WindowReadyCallback | null;
}

let session: ActiveSession | null = null;

function recordingsRoot(): string {
  return join(app.getPath('userData'), 'recordings');
}

export async function startRecording(args: RecordingStartArgs): Promise<{ audioPath: string }> {
  if (session) throw new Error('recording already in progress');

  const root = join(recordingsRoot(), args.meetingId);
  const windowDir = join(root, 'windows');
  await mkdir(windowDir, { recursive: true });

  const fullPath = join(root, 'mixed.wav');
  const fullWriter = new WavWriter({
    filePath: fullPath,
    sampleRate: SAMPLE_RATE,
    channels: CHANNELS,
    bitsPerSample: 16
  });
  await fullWriter.open();

  session = {
    meetingId: args.meetingId,
    fullWriter,
    fullPath,
    startedAt: Date.now(),
    totalSamples: 0,
    rollBuffer: new Float32Array(CHUNK_WINDOW_SAMPLES),
    rollOffset: 0,
    windowIndex: 0,
    windowDir,
    onWindowReady: null
  };

  return { audioPath: fullPath };
}

export function setWindowCallback(cb: WindowReadyCallback | null): void {
  if (session) session.onWindowReady = cb;
}

export async function appendChunk(meetingId: string, samples: Float32Array): Promise<void> {
  if (!session || session.meetingId !== meetingId) {
    throw new Error('no active session matches meetingId');
  }
  await session.fullWriter.appendFloat32(samples);
  session.totalSamples += samples.length;

  let offset = 0;
  while (offset < samples.length) {
    const space = CHUNK_WINDOW_SAMPLES - session.rollOffset;
    const take = Math.min(space, samples.length - offset);
    session.rollBuffer.set(samples.subarray(offset, offset + take), session.rollOffset);
    session.rollOffset += take;
    offset += take;
    if (session.rollOffset === CHUNK_WINDOW_SAMPLES) {
      await flushWindow(session);
    }
  }
}

async function flushWindow(s: ActiveSession): Promise<void> {
  const slice = s.rollBuffer.slice(0, s.rollOffset);
  const startMs = s.windowIndex * CHUNK_WINDOW_SECONDS * 1000;
  const endMs = startMs + (slice.length / SAMPLE_RATE) * 1000;
  const filePath = join(s.windowDir, `w${String(s.windowIndex).padStart(4, '0')}.wav`);
  await writeWavFile(filePath, slice, SAMPLE_RATE, CHANNELS);

  const win: ChunkWindow = {
    meetingId: s.meetingId,
    windowIndex: s.windowIndex,
    startMs,
    endMs,
    filePath
  };
  s.windowIndex += 1;
  s.rollOffset = 0;

  if (s.onWindowReady) {
    try {
      s.onWindowReady(win);
    } catch (err) {
      console.error('onWindowReady threw:', err);
    }
  }
}

export async function stopRecording(): Promise<RecordingStopResult> {
  if (!session) throw new Error('no active recording');
  const s = session;
  if (s.rollOffset > 0) {
    await flushWindow(s);
  }
  const { durationMs, totalSamples } = await s.fullWriter.close();
  session = null;
  return {
    meetingId: s.meetingId,
    audioPath: s.fullPath,
    durationMs,
    totalSamples
  };
}

export function isRecording(): boolean {
  return session !== null;
}

export function getActiveMeetingId(): string | null {
  return session?.meetingId ?? null;
}
