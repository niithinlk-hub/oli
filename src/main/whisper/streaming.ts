import { transcribeFile, type WhisperSegment, WhisperNotConfiguredError } from './worker';
import type { ChunkWindow } from '../audio/recorder';

export interface StreamingTranscriberCallbacks {
  onSegments: (window: ChunkWindow, segments: WhisperSegment[]) => void;
  onError: (window: ChunkWindow, err: Error) => void;
}

/**
 * Serial whisper executor: queue chunk windows as recording produces them,
 * transcribe in order, deliver segments via callback. Skips silently when
 * whisper isn't configured (live transcript pane just stays empty).
 */
export class StreamingTranscriber {
  private queue: ChunkWindow[] = [];
  private running = false;
  private cancelled = false;
  private warnedNotConfigured = false;
  constructor(private cb: StreamingTranscriberCallbacks) {}

  enqueue(window: ChunkWindow): void {
    if (this.cancelled) return;
    this.queue.push(window);
    void this.tick();
  }

  cancel(): void {
    this.cancelled = true;
    this.queue = [];
  }

  private async tick(): Promise<void> {
    if (this.running || this.cancelled) return;
    const next = this.queue.shift();
    if (!next) return;
    this.running = true;
    try {
      const segs = await transcribeFile({
        wavPath: next.filePath,
        offsetMs: next.startMs
      });
      if (!this.cancelled) this.cb.onSegments(next, segs);
    } catch (err) {
      if (err instanceof WhisperNotConfiguredError) {
        if (!this.warnedNotConfigured) {
          console.warn('whisper not configured — skipping live transcription');
          this.warnedNotConfigured = true;
        }
      } else {
        this.cb.onError(next, err as Error);
      }
    } finally {
      this.running = false;
      if (!this.cancelled && this.queue.length > 0) void this.tick();
    }
  }
}
