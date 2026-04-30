/**
 * Downloadable whisper.cpp ggml models. Stored under `<userData>/models/`
 * after first run. The Settings + Onboarding UIs trigger downloads from
 * the public catalog below.
 *
 * Default catalog points at the project's GitHub Release assets so the
 * installer doesn't have to ship a 78MB+ blob. HuggingFace mirrors are
 * provided as fallback URLs.
 */
import { app, BrowserWindow } from 'electron';
import { mkdir, stat, rename, unlink } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { request } from 'node:https';
import { URL } from 'node:url';
import { join } from 'node:path';
import { settingsRepo, SETTINGS_KEYS } from '../db/settings';

export interface ModelEntry {
  id: string;
  label: string;
  bytes: number;
  description: string;
  urls: string[];
}

export const MODEL_CATALOG: ModelEntry[] = [
  {
    id: 'ggml-base.en-q8_0',
    label: 'base.en (q8_0) — 78 MB · fast',
    bytes: 81768872,
    description: 'Smallest English-only model. Fast on CPU, ~10% WER on clean audio.',
    urls: [
      'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q8_0.bin'
    ]
  },
  {
    id: 'ggml-small.en-q5_1',
    label: 'small.en (q5_1) — 180 MB · balanced',
    bytes: 181533024,
    description: 'Good middle ground for English meetings. ~7% WER.',
    urls: [
      'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin'
    ]
  },
  {
    id: 'ggml-medium.en-q5_0',
    label: 'medium.en (q5_0) — 514 MB · accurate',
    bytes: 539213824,
    description: 'High accuracy English. ~5% WER. Slower on CPU.',
    urls: [
      'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin'
    ]
  },
  {
    id: 'ggml-large-v3-turbo-q8_0',
    label: 'large-v3-turbo (q8_0) — 834 MB · multilingual',
    bytes: 874188440,
    description: 'Multilingual, near-large quality, 8× faster than full large-v3.',
    urls: [
      'https://github.com/niithinlk-hub/oli/releases/download/v0.1.4/ggml-large-v3-turbo-q8_0.bin',
      'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin'
    ]
  }
];

export function modelsDir(): string {
  return join(app.getPath('userData'), 'models');
}

export function modelFilePath(id: string): string {
  return join(modelsDir(), `${id}.bin`);
}

export async function listInstalledModels(): Promise<string[]> {
  const out: string[] = [];
  for (const m of MODEL_CATALOG) {
    if (existsSync(modelFilePath(m.id))) out.push(m.id);
  }
  return out;
}

export async function deleteModel(id: string): Promise<void> {
  const path = modelFilePath(id);
  if (existsSync(path)) await unlink(path);
}

export async function downloadModel(
  modelId: string,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const entry = MODEL_CATALOG.find((m) => m.id === modelId);
  if (!entry) throw new Error(`unknown model id: ${modelId}`);

  await mkdir(modelsDir(), { recursive: true });
  const final = modelFilePath(modelId);
  const tmp = `${final}.part`;

  // If the final file exists with the right size, skip.
  try {
    const s = await stat(final);
    if (s.size === entry.bytes) return final;
  } catch {
    /* continue */
  }

  let lastErr: Error | null = null;
  for (const url of entry.urls) {
    if (signal?.aborted) throw new Error('aborted');
    try {
      await downloadOne(url, tmp, entry.bytes, onProgress, signal);
      await rename(tmp, final);
      return final;
    } catch (err) {
      lastErr = err as Error;
      try {
        await unlink(tmp);
      } catch {
        /* ignore */
      }
      // Try next mirror.
    }
  }
  throw lastErr ?? new Error('download failed');
}

function downloadOne(
  rawUrl: string,
  destPath: string,
  expectedBytes: number,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
  redirectsLeft = 5
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(rawUrl);
    const req = request(
      {
        method: 'GET',
        hostname: url.hostname,
        path: url.pathname + url.search,
        port: url.port || 443,
        headers: {
          'User-Agent': 'Oli/0.1 (+https://github.com/niithinlk-hub/oli)',
          Accept: 'application/octet-stream'
        }
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          if (redirectsLeft <= 0) {
            res.resume();
            reject(new Error('too many redirects'));
            return;
          }
          const next = new URL(res.headers.location, rawUrl).toString();
          res.resume();
          downloadOne(next, destPath, expectedBytes, onProgress, signal, redirectsLeft - 1)
            .then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} from ${rawUrl}`));
          return;
        }

        const total = Number(res.headers['content-length']) || expectedBytes;
        let loaded = 0;
        const out = createWriteStream(destPath);
        res.on('data', (chunk: Buffer) => {
          loaded += chunk.length;
          onProgress?.(loaded, total);
        });
        res.on('error', (err) => {
          out.destroy();
          reject(err);
        });
        out.on('error', (err) => {
          res.destroy();
          reject(err);
        });
        res.pipe(out);
        out.on('finish', () => resolve());
        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              res.destroy();
              out.destroy();
              reject(new Error('aborted'));
            },
            { once: true }
          );
        }
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/** If a downloaded model exists and Settings has no path, point Settings at it. */
export function selectInstalledAsDefault(modelId: string): void {
  const path = modelFilePath(modelId);
  if (existsSync(path)) {
    settingsRepo.set(SETTINGS_KEYS.whisperModel, path);
  }
}

export function broadcastProgress(
  modelId: string,
  loaded: number,
  total: number
): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('whisper:download-progress', {
      modelId,
      loaded,
      total,
      percent: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
    });
  }
}
