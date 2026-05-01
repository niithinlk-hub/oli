/**
 * Embeddings store + chunker + indexer.
 *
 * MVP storage: TEXT column with JSON-encoded vector array. Cosine similarity
 * computed in JS at query time. Fast enough for <50k chunks (sub-100ms full
 * scan). Phase 4+ swaps in sqlite-vss for true ANN.
 *
 * Chunking strategy:
 *  - Transcripts → ~200 word sliding window with 40-word overlap.
 *  - Summaries / action items / notes → embed whole row.
 *
 * Indexer is idempotent: replaceForMeeting() wipes prior chunks for a
 * meeting, then inserts fresh embeddings.
 */
import { initDb } from '../db/repo';
import { transcriptRepo, meetingsRepo, notesRepo } from '../db/repo';
import { decisionsRepo, actionItemsRepo } from '../db/structured';
import { embedBatch, embedDimensions, embedModelName } from '../llm/providers';
import type { EmbedProvider } from '../llm/providers';
import { settingsRepo } from '../db/settings';
import { htmlToMarkdown } from '../llm/html-to-markdown';

export const EMBED_KEYS = {
  provider: 'embeddings.provider'
} as const;

export type EmbeddingKind = 'transcript_chunk' | 'summary' | 'action_item' | 'note';

export interface EmbeddingRow {
  id: number;
  meetingId: string;
  segmentId: number | null;
  kind: EmbeddingKind;
  content: string;
  vector: number[];
  vectorDim: number;
  model: string;
  createdAt: number;
}

export function getEmbedProvider(): EmbedProvider {
  const v = settingsRepo.get(EMBED_KEYS.provider);
  return v === 'openai-large' ? 'openai-large' : 'openai-small';
}

export function setEmbedProvider(p: EmbedProvider): void {
  settingsRepo.set(EMBED_KEYS.provider, p);
}

/**
 * Sliding-window chunker: ~200 word chunks with 40 word overlap. Returns
 * { content, segmentRef } pairs where segmentRef points at the dominant
 * source segment (first segment that overlaps the chunk).
 */
function chunkTranscript(
  segments: { id: number; text: string; startMs: number; endMs: number; speakerLabel?: string | null }[]
): { content: string; segmentId: number }[] {
  const wordsPerChunk = 200;
  const overlap = 40;
  const flat: { word: string; segmentId: number }[] = [];
  for (const s of segments) {
    const speaker = s.speakerLabel ? `${s.speakerLabel}: ` : '';
    const tokens = (speaker + s.text).split(/\s+/).filter(Boolean);
    for (const t of tokens) flat.push({ word: t, segmentId: s.id });
  }
  if (flat.length === 0) return [];
  const out: { content: string; segmentId: number }[] = [];
  let i = 0;
  while (i < flat.length) {
    const slice = flat.slice(i, i + wordsPerChunk);
    if (slice.length === 0) break;
    out.push({
      content: slice.map((s) => s.word).join(' '),
      segmentId: slice[0].segmentId
    });
    if (i + wordsPerChunk >= flat.length) break;
    i += wordsPerChunk - overlap;
  }
  return out;
}

/** Replace every embedding for a meeting with freshly computed ones. */
export async function reindexMeeting(meetingId: string): Promise<{ count: number }> {
  const meeting = meetingsRepo.get(meetingId);
  if (!meeting) throw new Error(`meeting ${meetingId} not found`);
  const provider = getEmbedProvider();
  const model = embedModelName(provider);
  const dim = embedDimensions(provider);

  const segments = transcriptRepo.list(meetingId).map((s) => ({
    id: s.id ?? 0,
    text: s.text,
    startMs: s.startMs,
    endMs: s.endMs,
    speakerLabel: (s as unknown as { speakerLabel?: string | null }).speakerLabel ?? null
  }));
  const chunks = chunkTranscript(segments);

  const note = notesRepo.get(meetingId);
  const decisions = decisionsRepo.list(meetingId);
  const actions = actionItemsRepo.list(meetingId);

  type Item = {
    kind: EmbeddingKind;
    content: string;
    segmentId: number | null;
  };
  const items: Item[] = [];
  for (const c of chunks) {
    items.push({ kind: 'transcript_chunk', content: c.content, segmentId: c.segmentId });
  }
  if (note?.enhancedMarkdown) {
    // enhancedMarkdown is already MD (LLM output) — no conversion needed.
    items.push({ kind: 'summary', content: note.enhancedMarkdown, segmentId: null });
  }
  if (note?.rawMarkdown) {
    // rawMarkdown column actually stores TipTap-emitted HTML (legacy column
    // name). Convert to MD before embedding so retrieval scores against
    // human-readable text, not tag soup.
    const md = htmlToMarkdown(note.rawMarkdown).trim();
    if (md) items.push({ kind: 'note', content: md, segmentId: null });
  }
  for (const a of actions) {
    items.push({
      kind: 'action_item',
      content: `${a.owner ? a.owner + ': ' : ''}${a.task}${a.due ? ' (due ' + a.due + ')' : ''}`,
      segmentId: a.segmentRef ?? null
    });
  }
  for (const d of decisions) {
    items.push({ kind: 'summary', content: d.text, segmentId: d.segmentRef ?? null });
  }

  if (items.length === 0) return { count: 0 };

  // Batch in groups of 64 to keep payloads sane.
  const vectors: number[][] = [];
  for (let i = 0; i < items.length; i += 64) {
    const batch = items.slice(i, i + 64).map((it) => it.content);
    const v = await embedBatch(batch, provider);
    vectors.push(...v);
  }

  const db = initDb();
  db.transaction(() => {
    db.prepare('DELETE FROM embeddings WHERE meeting_id = ?').run(meetingId);
    const stmt = db.prepare(
      `INSERT INTO embeddings (meeting_id, segment_id, kind, content, vector_json, vector_dim, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const now = Date.now();
    for (let i = 0; i < items.length; i++) {
      stmt.run(
        meetingId,
        items[i].segmentId,
        items[i].kind,
        items[i].content,
        JSON.stringify(vectors[i]),
        dim,
        model,
        now
      );
    }
  })();

  return { count: items.length };
}

export async function reindexAll(): Promise<{ meetings: number; chunks: number }> {
  const all = meetingsRepo.list();
  let total = 0;
  for (const m of all) {
    if (m.status !== 'done') continue;
    try {
      const r = await reindexMeeting(m.id);
      total += r.count;
    } catch (err) {
      console.warn(`reindex ${m.id} failed:`, (err as Error).message);
    }
  }
  return { meetings: all.length, chunks: total };
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface SearchHit {
  meetingId: string;
  meetingTitle: string;
  segmentId: number | null;
  segmentStartMs: number | null;
  kind: EmbeddingKind;
  content: string;
  score: number;
}

export async function searchEmbeddings(query: string, k = 8): Promise<SearchHit[]> {
  const provider = getEmbedProvider();
  const [qVec] = await embedBatch([query], provider);
  if (!qVec) return [];
  const db = initDb();
  const rows = db
    .prepare(
      `SELECT e.id, e.meeting_id, e.segment_id, e.kind, e.content, e.vector_json,
              m.title AS meeting_title,
              ts.start_ms AS segment_start_ms
       FROM embeddings e
       JOIN meetings m ON m.id = e.meeting_id
       LEFT JOIN transcript_segments ts ON ts.id = e.segment_id`
    )
    .all() as Array<{
      id: number;
      meeting_id: string;
      segment_id: number | null;
      kind: EmbeddingKind;
      content: string;
      vector_json: string;
      meeting_title: string;
      segment_start_ms: number | null;
    }>;
  const scored: SearchHit[] = [];
  for (const r of rows) {
    let v: number[];
    try {
      v = JSON.parse(r.vector_json) as number[];
    } catch {
      continue;
    }
    const score = cosine(qVec, v);
    scored.push({
      meetingId: r.meeting_id,
      meetingTitle: r.meeting_title,
      segmentId: r.segment_id,
      segmentStartMs: r.segment_start_ms,
      kind: r.kind,
      content: r.content,
      score
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
