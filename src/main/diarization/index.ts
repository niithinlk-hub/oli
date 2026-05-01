/**
 * Speaker diarization.
 *
 * Two providers supported behind the `diarization.provider` setting:
 *  - 'cloud-assemblyai' — default. POST /upload then /transcript with
 *                         speaker_labels=true. Returns AssemblyAI's
 *                         "Speaker A" / "Speaker B" labels per utterance.
 *  - 'local-pyannote'   — interface scaffold only this phase. Throws
 *                         "not implemented" — Phase 4+ wiring.
 *
 * Post-process: align provider utterance boundaries to existing transcript
 * segments by `startMs` (within 1s tolerance) and write `speaker_label`
 * back into transcript_segments.
 *
 * Renames are stored separately in the `speakers` table — this module just
 * writes raw provider labels.
 */
import { settingsRepo } from '../db/settings';
import { initDb } from '../db/repo';
import { meetingsRepo, transcriptRepo } from '../db/repo';
import { getSecret } from '../secrets';
import { readFile } from 'node:fs/promises';

export type DiarizationProvider = 'cloud-assemblyai' | 'local-pyannote';

export const DIAR_KEYS = {
  provider: 'diarization.provider',
  apiKey: 'assemblyai-key' // safeStorage secret name
} as const;

export class DiarizationNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiarizationNotConfiguredError';
  }
}

export function getDiarizationProvider(): DiarizationProvider {
  const v = settingsRepo.get(DIAR_KEYS.provider);
  return v === 'local-pyannote' ? 'local-pyannote' : 'cloud-assemblyai';
}

export function setDiarizationProvider(p: DiarizationProvider): void {
  settingsRepo.set(DIAR_KEYS.provider, p);
}

export async function setAssemblyAiKey(key: string | null): Promise<void> {
  // We piggy-back on the existing secrets API used by the LLM providers.
  const { setSecret, deleteSecret } = await import('../secrets');
  if (key) await setSecret(DIAR_KEYS.apiKey, key);
  else await deleteSecret(DIAR_KEYS.apiKey);
}

export async function hasAssemblyAiKey(): Promise<boolean> {
  const k = await getSecret(DIAR_KEYS.apiKey);
  return Boolean(k);
}

interface AaiSegment {
  speaker: string; // 'A' | 'B' | ...
  start: number; // ms
  end: number; // ms
  text: string;
}

async function uploadAudio(apiKey: string, wavPath: string): Promise<string> {
  const data = await readFile(wavPath);
  const r = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/octet-stream' },
    body: new Uint8Array(data)
  });
  if (!r.ok) throw new Error(`AAI upload ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { upload_url: string };
  return j.upload_url;
}

async function requestTranscript(apiKey: string, audioUrl: string): Promise<string> {
  const r = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl, speaker_labels: true })
  });
  if (!r.ok) throw new Error(`AAI transcript ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { id: string };
  return j.id;
}

async function pollUntilDone(apiKey: string, id: string, signal?: AbortSignal): Promise<AaiSegment[]> {
  const url = `https://api.assemblyai.com/v2/transcript/${id}`;
  for (;;) {
    if (signal?.aborted) throw new Error('aborted');
    const r = await fetch(url, { headers: { authorization: apiKey } });
    if (!r.ok) throw new Error(`AAI poll ${r.status}`);
    const j = (await r.json()) as {
      status: string;
      error?: string;
      utterances?: AaiSegment[];
    };
    if (j.status === 'completed') return j.utterances ?? [];
    if (j.status === 'error') throw new Error(j.error ?? 'AAI transcript failed');
    await new Promise((res) => setTimeout(res, 2500));
  }
}

export async function diarizeMeeting(
  meetingId: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; speakers: number; message?: string }> {
  const meeting = meetingsRepo.get(meetingId);
  if (!meeting?.audioPath) return { ok: false, speakers: 0, message: 'no audio recorded' };
  const provider = getDiarizationProvider();
  if (provider === 'local-pyannote') {
    return { ok: false, speakers: 0, message: 'local pyannote not implemented yet (Phase 4)' };
  }
  const apiKey = await getSecret(DIAR_KEYS.apiKey);
  if (!apiKey) {
    throw new DiarizationNotConfiguredError(
      'AssemblyAI key not set. Add it in Settings → Diarization.'
    );
  }
  const audioUrl = await uploadAudio(apiKey, meeting.audioPath);
  const id = await requestTranscript(apiKey, audioUrl);
  const utterances = await pollUntilDone(apiKey, id, signal);
  if (utterances.length === 0) return { ok: true, speakers: 0 };
  applySpeakers(meetingId, utterances);
  return {
    ok: true,
    speakers: new Set(utterances.map((u) => u.speaker)).size
  };
}

/**
 * Align AssemblyAI utterances to existing transcript_segments by start time
 * (within 1.5s tolerance). For unmatched segments we leave speaker_label NULL.
 */
function applySpeakers(meetingId: string, utterances: AaiSegment[]): void {
  const segments = transcriptRepo.list(meetingId);
  const db = initDb();
  const update = db.prepare(
    'UPDATE transcript_segments SET speaker_label = ? WHERE id = ?'
  );
  db.transaction(() => {
    for (const seg of segments) {
      const u = utterances.find(
        (x) =>
          Math.abs(x.start - seg.startMs) <= 1500 ||
          (seg.startMs >= x.start && seg.startMs <= x.end)
      );
      if (u) update.run(`Speaker ${u.speaker}`, seg.id);
    }
  })();
}

/* Speaker rename map. */

export interface SpeakerRename {
  rawLabel: string;
  displayName: string;
}

export const speakersRepo = {
  list(meetingId: string): SpeakerRename[] {
    const rows = initDb()
      .prepare('SELECT raw_label, display_name FROM speakers WHERE meeting_id = ?')
      .all(meetingId) as { raw_label: string; display_name: string }[];
    return rows.map((r) => ({ rawLabel: r.raw_label, displayName: r.display_name }));
  },
  rename(meetingId: string, rawLabel: string, displayName: string): void {
    initDb()
      .prepare(
        `INSERT INTO speakers (meeting_id, raw_label, display_name) VALUES (?, ?, ?)
         ON CONFLICT(meeting_id, raw_label) DO UPDATE SET display_name=excluded.display_name`
      )
      .run(meetingId, rawLabel, displayName);
  }
};
