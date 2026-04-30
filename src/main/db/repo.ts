import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Meeting, NoteDoc, TranscriptSegment } from '@shared/types';
import { SCHEMA_SQL } from './schema';

let db: Database.Database | null = null;

export function initDb(): Database.Database {
  if (db) return db;
  const userData = app.getPath('userData');
  mkdirSync(userData, { recursive: true });
  const dbPath = join(userData, 'synthetic-floyd.sqlite');
  db = new Database(dbPath);
  db.exec(SCHEMA_SQL);
  return db;
}

function rowToMeeting(r: any): Meeting {
  return {
    id: r.id,
    title: r.title,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    status: r.status,
    calendarEventId: r.calendar_event_id,
    templateId: r.template_id,
    audioPath: r.audio_path,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export const meetingsRepo = {
  list(): Meeting[] {
    const rows = initDb().prepare('SELECT * FROM meetings ORDER BY started_at DESC').all();
    return rows.map(rowToMeeting);
  },
  get(id: string): Meeting | null {
    const row = initDb().prepare('SELECT * FROM meetings WHERE id = ?').get(id);
    return row ? rowToMeeting(row) : null;
  },
  create(title: string): Meeting {
    const now = Date.now();
    const id = randomUUID();
    initDb()
      .prepare(
        `INSERT INTO meetings (id, title, started_at, status, created_at, updated_at)
         VALUES (?, ?, ?, 'idle', ?, ?)`
      )
      .run(id, title, now, now, now);
    initDb()
      .prepare(`INSERT INTO notes (meeting_id, raw_markdown, updated_at) VALUES (?, '', ?)`)
      .run(id, now);
    return this.get(id)!;
  },
  update(id: string, patch: Partial<Meeting>): Meeting {
    const existing = this.get(id);
    if (!existing) throw new Error(`meeting ${id} not found`);
    const merged = { ...existing, ...patch, updatedAt: Date.now() };
    initDb()
      .prepare(
        `UPDATE meetings SET title=?, started_at=?, ended_at=?, status=?,
           calendar_event_id=?, template_id=?, audio_path=?, updated_at=?
         WHERE id=?`
      )
      .run(
        merged.title,
        merged.startedAt,
        merged.endedAt,
        merged.status,
        merged.calendarEventId,
        merged.templateId,
        merged.audioPath,
        merged.updatedAt,
        id
      );
    return this.get(id)!;
  },
  delete(id: string): void {
    initDb().prepare('DELETE FROM meetings WHERE id = ?').run(id);
  },
  search(q: string, limit = 30): { meeting: Meeting; snippet: string; matchType: 'title' | 'notes' | 'transcript' }[] {
    const pattern = `%${q.replace(/[%_]/g, '\\$&')}%`;
    const rows = initDb()
      .prepare(
        `SELECT m.*, 'title' AS match_type, m.title AS snippet FROM meetings m WHERE m.title LIKE ? ESCAPE '\\'
         UNION
         SELECT m.*, 'notes' AS match_type,
           CASE
             WHEN instr(lower(n.raw_markdown), lower(?)) > 0
               THEN substr(n.raw_markdown, max(1, instr(lower(n.raw_markdown), lower(?)) - 30), 160)
             WHEN instr(lower(coalesce(n.enhanced_markdown,'')), lower(?)) > 0
               THEN substr(coalesce(n.enhanced_markdown,''), max(1, instr(lower(coalesce(n.enhanced_markdown,'')), lower(?)) - 30), 160)
             ELSE substr(coalesce(n.raw_markdown, n.enhanced_markdown, ''), 1, 160)
           END AS snippet
         FROM meetings m JOIN notes n ON n.meeting_id = m.id
         WHERE n.raw_markdown LIKE ? ESCAPE '\\' OR n.enhanced_markdown LIKE ? ESCAPE '\\'
         UNION
         SELECT m.*, 'transcript' AS match_type, t.text AS snippet
         FROM meetings m JOIN transcript_segments t ON t.meeting_id = m.id
         WHERE t.text LIKE ? ESCAPE '\\'
         ORDER BY started_at DESC
         LIMIT ?`
      )
      .all(pattern, q, q, q, q, pattern, pattern, pattern, limit) as any[];
    return rows.map((r) => ({
      meeting: rowToMeeting(r),
      snippet: (r.snippet as string)?.replace(/<[^>]+>/g, ' ').slice(0, 200) ?? '',
      matchType: r.match_type
    }));
  }
};

export const transcriptRepo = {
  list(meetingId: string): TranscriptSegment[] {
    const rows = initDb()
      .prepare('SELECT * FROM transcript_segments WHERE meeting_id = ? ORDER BY start_ms ASC')
      .all(meetingId) as any[];
    return rows.map((r) => ({
      id: r.id,
      meetingId: r.meeting_id,
      startMs: r.start_ms,
      endMs: r.end_ms,
      text: r.text,
      source: r.source
    }));
  },
  insert(seg: Omit<TranscriptSegment, 'id'>): number {
    const info = initDb()
      .prepare(
        `INSERT INTO transcript_segments (meeting_id, start_ms, end_ms, text, source)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(seg.meetingId, seg.startMs, seg.endMs, seg.text, seg.source);
    return info.lastInsertRowid as number;
  },
  deleteForMeeting(meetingId: string): void {
    initDb().prepare('DELETE FROM transcript_segments WHERE meeting_id = ?').run(meetingId);
  }
};

export const notesRepo = {
  get(meetingId: string): NoteDoc | null {
    const r = initDb().prepare('SELECT * FROM notes WHERE meeting_id = ?').get(meetingId) as any;
    if (!r) return null;
    return {
      meetingId: r.meeting_id,
      rawMarkdown: r.raw_markdown,
      enhancedMarkdown: r.enhanced_markdown,
      updatedAt: r.updated_at
    };
  },
  save(meetingId: string, rawMarkdown: string): void {
    const now = Date.now();
    initDb()
      .prepare(
        `INSERT INTO notes (meeting_id, raw_markdown, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(meeting_id) DO UPDATE SET raw_markdown=excluded.raw_markdown, updated_at=excluded.updated_at`
      )
      .run(meetingId, rawMarkdown, now);
  },
  saveEnhanced(meetingId: string, enhancedMarkdown: string): void {
    const now = Date.now();
    initDb()
      .prepare('UPDATE notes SET enhanced_markdown = ?, updated_at = ? WHERE meeting_id = ?')
      .run(enhancedMarkdown, now, meetingId);
  }
};
