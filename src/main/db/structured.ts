/**
 * Repos for Phase 3 structured artifacts:
 *  - meeting_decisions
 *  - meeting_action_items
 *  - meeting_topics
 *
 * Persisted from extractStructured() output. Renderer surfaces them via
 * the Action Items tab.
 */
import { initDb } from './repo';

export interface Decision {
  id: number;
  meetingId: string;
  text: string;
  segmentRef: number | null;
  createdAt: number;
}

export interface ActionItem {
  id: number;
  meetingId: string;
  owner: string | null;
  task: string;
  due: string | null;
  segmentRef: number | null;
  done: boolean;
  createdAt: number;
}

export const decisionsRepo = {
  list(meetingId: string): Decision[] {
    const rows = initDb()
      .prepare('SELECT * FROM meeting_decisions WHERE meeting_id = ? ORDER BY id ASC')
      .all(meetingId) as Array<{
        id: number;
        meeting_id: string;
        text: string;
        segment_ref: number | null;
        created_at: number;
      }>;
    return rows.map((r) => ({
      id: r.id,
      meetingId: r.meeting_id,
      text: r.text,
      segmentRef: r.segment_ref,
      createdAt: r.created_at
    }));
  },
  replace(meetingId: string, items: { text: string; segmentRef?: number | null }[]): void {
    const db = initDb();
    db.transaction(() => {
      db.prepare('DELETE FROM meeting_decisions WHERE meeting_id = ?').run(meetingId);
      const stmt = db.prepare(
        'INSERT INTO meeting_decisions (meeting_id, text, segment_ref, created_at) VALUES (?, ?, ?, ?)'
      );
      const now = Date.now();
      for (const it of items) {
        stmt.run(meetingId, it.text, it.segmentRef ?? null, now);
      }
    })();
  }
};

export const actionItemsRepo = {
  list(meetingId: string): ActionItem[] {
    const rows = initDb()
      .prepare('SELECT * FROM meeting_action_items WHERE meeting_id = ? ORDER BY id ASC')
      .all(meetingId) as Array<{
        id: number;
        meeting_id: string;
        owner: string | null;
        task: string;
        due: string | null;
        segment_ref: number | null;
        done: number;
        created_at: number;
      }>;
    return rows.map((r) => ({
      id: r.id,
      meetingId: r.meeting_id,
      owner: r.owner,
      task: r.task,
      due: r.due,
      segmentRef: r.segment_ref,
      done: r.done === 1,
      createdAt: r.created_at
    }));
  },
  replace(
    meetingId: string,
    items: {
      owner?: string | null;
      task: string;
      due?: string | null;
      segmentRef?: number | null;
    }[]
  ): void {
    const db = initDb();
    db.transaction(() => {
      db.prepare('DELETE FROM meeting_action_items WHERE meeting_id = ?').run(meetingId);
      const stmt = db.prepare(
        `INSERT INTO meeting_action_items (meeting_id, owner, task, due, segment_ref, done, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`
      );
      const now = Date.now();
      for (const it of items) {
        stmt.run(meetingId, it.owner ?? null, it.task, it.due ?? null, it.segmentRef ?? null, now);
      }
    })();
  },
  setDone(id: number, done: boolean): void {
    initDb()
      .prepare('UPDATE meeting_action_items SET done = ? WHERE id = ?')
      .run(done ? 1 : 0, id);
  }
};

export const topicsRepo = {
  list(meetingId: string): string[] {
    const rows = initDb()
      .prepare('SELECT topic FROM meeting_topics WHERE meeting_id = ?')
      .all(meetingId) as { topic: string }[];
    return rows.map((r) => r.topic);
  },
  replace(meetingId: string, topics: string[]): void {
    const db = initDb();
    db.transaction(() => {
      db.prepare('DELETE FROM meeting_topics WHERE meeting_id = ?').run(meetingId);
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO meeting_topics (meeting_id, topic) VALUES (?, ?)'
      );
      for (const t of topics) stmt.run(meetingId, t);
    })();
  }
};
