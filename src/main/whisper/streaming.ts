import { transcribeWav, getConcurrency, SttNotConfiguredError } from '../stt';
import type { WhisperSegment } from './worker';
import { WhisperNotConfiguredError } from './worker';
import type { ChunkWindow } from '../audio/recorder';

export interface StreamingTranscriberCallbacks {
  onSegments: (window: ChunkWindow, segments: WhisperSegment[]) => void;
  onError: (window: ChunkWindow, err: Error) => void;
}

/**
 * Concurrent STT executor. Multiple chunk windows can transcribe in parallel
 * — bounded by `getConcurrency()` (defaults: 4 for cloud Groq, 1 for local
 * whisper.cpp where parallel spawns thrash the CPU).
 *
 * Order is NOT preserved on the wire — but each segment carries absolute
 * startMs/endMs anchored to the window's offset, so the renderer can sort.
 */
export class StreamingTranscriber {
  private queue: ChunkWindow[] = [];
  private inflight = 0;
  private cancelled = false;
  private warnedNotConfigured = false;
  private maxConcurrent: number;

  constructor(private cb: StreamingTranscriberCallbacks) {
    this.maxConcurrent = Math.max(1, getConcurrency());
  }

  enqueue(window: ChunkWindow): void {
    if (this.cancelled) return;
    this.queue.push(window);
    this.tick();
  }

  cancel(): void {
    this.cancelled = true;
    this.queue = [];
  }

  private tick(): void {
    if (this.cancelled) return;
    while (this.inflight < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) break;
      this.inflight += 1;
      void this.runOne(next).finally(() => {
        this.inflight -= 1;
        if (!this.cancelled && this.queue.length > 0) this.tick();
      });
    }
  }

  private async runOne(window: ChunkWindow): Promise<void> {
    try {
      const segs = await transcribeWav({
        wavPath: window.filePath,
        offsetMs: window.startMs
      });
      if (!this.cancelled) this.cb.onSegments(window, segs);
    } catch (err) {
      if (err instanceof WhisperNotConfiguredError || err instanceof SttNotConfiguredError) {
        if (!this.warnedNotConfigured) {
          console.warn('STT not configured — skipping live transcription:', (err as Error).message);
          this.warnedNotConfigured = true;
        }
        return;
      }
      this.cb.onError(window, err as Error);
    }
  }
}
