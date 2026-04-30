/**
 * Groq cloud Whisper STT.
 *
 * Uses the Groq API's audio.transcriptions endpoint with whisper-large-v3-turbo
 * (default) or whisper-large-v3. Returns verbose_json so we get per-segment
 * start/end timestamps suitable for the live transcript UI.
 *
 * Reuses the Groq API key already stored under the LLM provider abstraction
 * (settingsRepo + safeStorage secret 'groq-key').
 */
import Groq from 'groq-sdk';
import { createReadStream } from 'node:fs';
import { getProviderKey } from '../llm/providers';
import { SttNotConfiguredError } from './index';
import type { WhisperSegment } from '../whisper/worker';

export const GROQ_DEFAULT_MODEL = 'whisper-large-v3-turbo';

export const GROQ_MODELS: { id: string; label: string; note: string }[] = [
  {
    id: 'whisper-large-v3-turbo',
    label: 'whisper-large-v3-turbo',
    note: 'Fastest, recommended. ~7% WER, ~10x realtime.'
  },
  {
    id: 'whisper-large-v3',
    label: 'whisper-large-v3',
    note: 'Highest accuracy. ~5% WER, ~5x realtime.'
  },
  {
    id: 'distil-whisper-large-v3-en',
    label: 'distil-whisper-large-v3-en',
    note: 'English-only, lighter. ~8% WER, fastest.'
  }
];

export interface GroqTranscribeOpts {
  wavPath: string;
  offsetMs: number;
  model?: string;
  language?: string;
  signal?: AbortSignal;
}

export async function groqTranscribe(opts: GroqTranscribeOpts): Promise<WhisperSegment[]> {
  const key = await getProviderKey('groq');
  if (!key) {
    throw new SttNotConfiguredError(
      'Groq API key not set. Add it in Settings → AI provider (Groq), then enable cloud STT.'
    );
  }

  const client = new Groq({ apiKey: key });
  const model = opts.model ?? GROQ_DEFAULT_MODEL;

  // groq-sdk accepts a Node Readable stream as `file`. createReadStream lets
  // the SDK build the multipart body without us holding the whole WAV in RAM.
  const r = (await client.audio.transcriptions.create(
    {
      file: createReadStream(opts.wavPath) as unknown as File,
      model,
      response_format: 'verbose_json',
      language: opts.language ?? 'en',
      temperature: 0
    },
    opts.signal ? { signal: opts.signal } : undefined
  )) as unknown as GroqVerboseResponse;

  const segments = parseGroqSegments(r, opts.offsetMs);
  if (segments.length > 0) return segments;

  // Fallback: response had only a top-level `text` (no segments returned).
  // Synthesize a single segment spanning the chunk.
  const text = (r.text ?? '').trim();
  if (!text) return [];
  return [
    {
      startMs: opts.offsetMs,
      endMs: opts.offsetMs + 1,
      text
    }
  ];
}

interface GroqSegmentRaw {
  id?: number;
  start: number;
  end: number;
  text: string;
}

interface GroqVerboseResponse {
  text?: string;
  segments?: GroqSegmentRaw[];
  language?: string;
  duration?: number;
}

function parseGroqSegments(r: GroqVerboseResponse, offsetMs: number): WhisperSegment[] {
  const segs = r.segments ?? [];
  const out: WhisperSegment[] = [];
  for (const s of segs) {
    const text = (s.text ?? '').trim();
    if (!text) continue;
    out.push({
      startMs: Math.round(s.start * 1000) + offsetMs,
      endMs: Math.round(s.end * 1000) + offsetMs,
      text
    });
  }
  return out;
}

/**
 * Validate a Groq STT key + model by sending a tiny silent WAV.
 * Used by Settings UI to give immediate feedback when the user enables Groq STT.
 */
export async function pingGroqStt(model: string = GROQ_DEFAULT_MODEL): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    const key = await getProviderKey('groq');
    if (!key) return { ok: false, message: 'No Groq API key configured.' };
    const client = new Groq({ apiKey: key });
    // 1 second of silence at 16kHz mono, 16-bit PCM, in a minimal WAV.
    const wav = buildSilentWav(1, 16000);
    const file = new Blob([new Uint8Array(wav)], { type: 'audio/wav' });
    await client.audio.transcriptions.create({
      file: file as unknown as File,
      model,
      response_format: 'json',
      language: 'en'
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

function buildSilentWav(seconds: number, sampleRate: number): ArrayBuffer {
  const numSamples = sampleRate * seconds;
  const dataBytes = numSamples * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  let p = 0;
  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(p++, s.charCodeAt(i));
  };
  writeStr('RIFF');
  v.setUint32(p, 36 + dataBytes, true);
  p += 4;
  writeStr('WAVE');
  writeStr('fmt ');
  v.setUint32(p, 16, true);
  p += 4;
  v.setUint16(p, 1, true);
  p += 2;
  v.setUint16(p, 1, true);
  p += 2;
  v.setUint32(p, sampleRate, true);
  p += 4;
  v.setUint32(p, sampleRate * 2, true);
  p += 4;
  v.setUint16(p, 2, true);
  p += 2;
  v.setUint16(p, 16, true);
  p += 2;
  writeStr('data');
  v.setUint32(p, dataBytes, true);
  p += 4;
  return buf;
}
