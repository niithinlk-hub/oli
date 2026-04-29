import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { settingsRepo, SETTINGS_KEYS } from '../db/settings';

export interface WhisperSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface WhisperRunOptions {
  wavPath: string;
  language?: string;
  threads?: number;
  /** Offset in ms applied to all returned segments (for chunk windows). */
  offsetMs?: number;
  /** Override binary/model path; otherwise pulled from settings. */
  binaryPath?: string;
  modelPath?: string;
}

export class WhisperNotConfiguredError extends Error {
  constructor() {
    super(
      'whisper.cpp not configured. Set the binary path (e.g. main.exe / whisper-cli) and a downloaded ggml model in Settings.'
    );
  }
}

function resolveConfig(opts: WhisperRunOptions): { binary: string; model: string } {
  const binary = opts.binaryPath ?? settingsRepo.get(SETTINGS_KEYS.whisperBinary);
  const model = opts.modelPath ?? settingsRepo.get(SETTINGS_KEYS.whisperModel);
  if (!binary || !model) throw new WhisperNotConfiguredError();
  return { binary, model };
}

/**
 * Run whisper.cpp once on a WAV file and return parsed segments.
 *
 * whisper.cpp's `main`/`whisper-cli` binary writes a JSON file alongside the
 * input when invoked with `-oj`. We rely on that artifact rather than parsing
 * stdout, which is more brittle.
 */
export async function transcribeFile(opts: WhisperRunOptions): Promise<WhisperSegment[]> {
  const { binary, model } = resolveConfig(opts);
  const args = [
    '-m', model,
    '-f', opts.wavPath,
    '-l', opts.language ?? 'en',
    '-t', String(opts.threads ?? 4),
    '-oj',           // output JSON next to input
    '-nt',           // no timestamps in stdout
    '-np'            // no progress prints
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderrBuf = '';
    child.stderr.on('data', (c) => (stderrBuf += c.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`whisper exit ${code}: ${stderrBuf.slice(0, 500)}`));
    });
  });

  const jsonPath = opts.wavPath + '.json';
  const raw = await readFile(jsonPath, 'utf8');
  return parseWhisperJson(raw, opts.offsetMs ?? 0);
}

function parseWhisperJson(raw: string, offsetMs: number): WhisperSegment[] {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const segments: WhisperSegment[] = [];
  const list: any[] = parsed.transcription ?? parsed.segments ?? [];
  for (const s of list) {
    const offsets = s.offsets ?? {};
    const startMs = (offsets.from ?? s.t0 ?? 0) + offsetMs;
    const endMs = (offsets.to ?? s.t1 ?? startMs) + offsetMs;
    const text = (s.text ?? '').trim();
    if (text) segments.push({ startMs, endMs, text });
  }
  return segments;
}
