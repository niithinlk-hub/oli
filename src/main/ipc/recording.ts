import { ipcMain, BrowserWindow } from 'electron';
import {
  startRecording,
  stopRecording,
  appendChunk,
  setWindowCallback,
  isRecording
} from '../audio/recorder';
import {
  appendNativeMicChunk,
  isNativeLoopbackAvailable,
  startNativeLoopbackRecording,
  stopNativeLoopbackRecording
} from '../audio/capture';
import { StreamingTranscriber } from '../whisper/streaming';
import { transcribeWav } from '../stt';
import { meetingsRepo, transcriptRepo } from '../db/repo';
import type { PartialTranscriptEvent, RecordingStartArgs } from '@shared/types';

let activeStream: StreamingTranscriber | null = null;

function broadcast<T>(channel: string, payload: T): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

export function registerRecordingIpc(): void {
  ipcMain.handle('recording:native-available', () => isNativeLoopbackAvailable());

  ipcMain.handle('recording:start', async (_e, args: RecordingStartArgs) => {
    const meeting = meetingsRepo.get(args.meetingId);
    if (!meeting) throw new Error(`meeting ${args.meetingId} not found`);

    const result = await startRecording(args);
    meetingsRepo.update(args.meetingId, {
      status: 'recording',
      audioPath: result.audioPath,
      startedAt: Date.now()
    });

    activeStream = new StreamingTranscriber({
      onSegments: (window, segments) => {
        for (const s of segments) {
          transcriptRepo.insert({
            meetingId: window.meetingId,
            startMs: s.startMs,
            endMs: s.endMs,
            text: s.text,
            source: 'mixed'
          });
          const event: PartialTranscriptEvent = {
            meetingId: window.meetingId,
            startMs: s.startMs,
            endMs: s.endMs,
            text: s.text,
            source: 'mixed',
            isPartial: true
          };
          broadcast('transcript:partial', event);
        }
      },
      onError: (window, err) => {
        console.error(`whisper window ${window.windowIndex} failed:`, err);
        broadcast('recording:error', { meetingId: window.meetingId, message: err.message });
      }
    });

    setWindowCallback((window) => activeStream?.enqueue(window));
    return result;
  });

  ipcMain.handle(
    'recording:chunk',
    async (
      _e,
      meetingId: string,
      buffer: ArrayBuffer | Uint8Array
    ) => {
      if (!isRecording()) return;
      const ab =
        buffer instanceof Uint8Array
          ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
          : buffer;
      const samples = new Float32Array(ab);
      await appendChunk(meetingId, samples);
    }
  );

  ipcMain.handle('recording:start-native', async (_e, meetingId: string) => {
    if (!isRecording()) throw new Error('recording must be started before native capture');
    startNativeLoopbackRecording(meetingId, (err) => {
      console.error('native loopback capture failed:', err);
      broadcast('recording:error', { meetingId, message: err.message });
    });
    return { ok: true };
  });

  ipcMain.handle(
    'recording:mic-chunk',
    async (_e, meetingId: string, buffer: ArrayBuffer | Uint8Array) => {
      if (!isRecording()) return;
      const ab =
        buffer instanceof Uint8Array
          ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
          : buffer;
      appendNativeMicChunk(meetingId, new Float32Array(ab));
    }
  );

  ipcMain.handle('recording:stop-native', async (_e, meetingId?: string) => {
    await stopNativeLoopbackRecording(meetingId);
    return { ok: true };
  });

  ipcMain.handle('recording:stop', async (_e, opts: { runFinalPass?: boolean } = {}) => {
    if (!isRecording()) return null;
    await stopNativeLoopbackRecording();
    const result = await stopRecording();
    setWindowCallback(null);
    activeStream?.cancel();
    activeStream = null;

    meetingsRepo.update(result.meetingId, {
      status: opts.runFinalPass ? 'transcribing' : 'done',
      endedAt: Date.now()
    });

    if (opts.runFinalPass) {
      try {
        const segs = await transcribeWav({ wavPath: result.audioPath, offsetMs: 0 });
        transcriptRepo.deleteForMeeting(result.meetingId);
        for (const s of segs) {
          transcriptRepo.insert({
            meetingId: result.meetingId,
            startMs: s.startMs,
            endMs: s.endMs,
            text: s.text,
            source: 'mixed'
          });
        }
        meetingsRepo.update(result.meetingId, { status: 'done' });
        broadcast('transcript:final', { meetingId: result.meetingId, segments: segs.length });
      } catch (err) {
        console.error('final whisper pass failed:', err);
        meetingsRepo.update(result.meetingId, { status: 'done' });
      }
    }

    return result;
  });

  ipcMain.handle('recording:active', () => isRecording());
}
