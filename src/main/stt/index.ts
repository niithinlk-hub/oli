/**
 * Speech-to-text provider router.
 *
 * Two providers supported:
 *   - 'local'  : whisper.cpp (privacy-first, offline, slower)
 *   - 'groq'   : Groq cloud Whisper (fast, free tier, audio leaves machine)
 *
 * Settings keys:
 *   stt.provider     : 'local' | 'groq'   (default 'local')
 *   stt.groq.model   : Groq Whisper model id (default 'whisper-large-v3-turbo')
 *   stt.chunk_secs   : chunk window seconds, 1..30 (default 3 for groq, 10 for local)
 *   stt.concurrency  : max parallel inflight requests (default 4 for groq, 1 for local)
 */
import { settingsRepo } from '../db/settings';
import { transcribeFile as localTranscribe, type WhisperSegment } from '../whisper/worker';
import { groqTranscribe, GROQ_DEFAULT_MODEL } from './groq';

export type SttProvider = 'local' | 'groq';

export const STT_KEYS = {
  provider: 'stt.provider',
  groqModel: 'stt.groq.model',
  chunkSecs: 'stt.chunk_secs',
  concurrency: 'stt.concurrency'
} as const;

export class SttNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SttNotConfiguredError';
  }
}

export function getSttProvider(): SttProvider {
  const v = settingsRepo.get(STT_KEYS.provider);
  return v === 'groq' ? 'groq' : 'local';
}

export function setSttProvider(p: SttProvider): void {
  settingsRepo.set(STT_KEYS.provider, p);
}

export function getGroqModel(): string {
  return settingsRepo.get(STT_KEYS.groqModel) ?? GROQ_DEFAULT_MODEL;
}

export function setGroqModel(model: string | null): void {
  if (model && model.trim()) settingsRepo.set(STT_KEYS.groqModel, model.trim());
  else settingsRepo.delete(STT_KEYS.groqModel);
}

export function getChunkSeconds(): number {
  const raw = settingsRepo.get(STT_KEYS.chunkSecs);
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 1 && n <= 30) return n;
  return getSttProvider() === 'groq' ? 3 : 10;
}

export function setChunkSeconds(n: number | null): void {
  if (n == null) {
    settingsRepo.delete(STT_KEYS.chunkSecs);
    return;
  }
  const clamped = Math.max(1, Math.min(30, Math.round(n)));
  settingsRepo.set(STT_KEYS.chunkSecs, String(clamped));
}

export function getConcurrency(): number {
  const raw = settingsRepo.get(STT_KEYS.concurrency);
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 1 && n <= 8) return n;
  return getSttProvider() === 'groq' ? 4 : 1;
}

export function setConcurrency(n: number | null): void {
  if (n == null) {
    settingsRepo.delete(STT_KEYS.concurrency);
    return;
  }
  const clamped = Math.max(1, Math.min(8, Math.round(n)));
  settingsRepo.set(STT_KEYS.concurrency, String(clamped));
}

export interface TranscribeOpts {
  wavPath: string;
  offsetMs?: number;
}

/**
 * Transcribe a WAV file via the active provider.
 *
 * Returns segment list with absolute start/end ms (offset already applied).
 * Throws SttNotConfiguredError if the provider is unconfigured (no API key,
 * missing whisper binary, etc).
 */
export async function transcribeWav(opts: TranscribeOpts): Promise<WhisperSegment[]> {
  const provider = getSttProvider();
  if (provider === 'groq') {
    return groqTranscribe({
      wavPath: opts.wavPath,
      offsetMs: opts.offsetMs ?? 0,
      model: getGroqModel()
    });
  }
  return localTranscribe({ wavPath: opts.wavPath, offsetMs: opts.offsetMs });
}

export type { WhisperSegment };
