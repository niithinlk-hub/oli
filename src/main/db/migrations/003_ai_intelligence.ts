/**
 * Migration 003 — Phase 3 AI intelligence.
 *
 * Adds:
 *  - `speaker_label` column on `transcript_segments` (NULL = unlabeled).
 *  - `meeting_decisions`, `meeting_action_items`, `meeting_topics` tables.
 *  - `embeddings` table — chunk text + JSON vector (MVP cosine in JS).
 *    Vector dim varies by provider; we store dim alongside.
 *  - `ask_conversations` + `ask_messages` for the Ask-my-meetings chat.
 *  - `speakers` table — per-meeting speaker rename map.
 *
 * Vector storage uses TEXT (JSON array) instead of sqlite-vss to avoid the
 * native extension load. For meeting volumes <10k segments this is fine —
 * cosine sim runs in <100ms in JS. Phase 4+ can swap in sqlite-vss.
 */
export const migration_003_ai_intelligence = {
  id: 3,
  name: 'ai_intelligence',
  sql: `
ALTER TABLE transcript_segments ADD COLUMN speaker_label TEXT;

CREATE TABLE IF NOT EXISTS speakers (
  meeting_id      TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  raw_label       TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  PRIMARY KEY (meeting_id, raw_label)
);

CREATE TABLE IF NOT EXISTS meeting_decisions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id      TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  segment_ref     INTEGER,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decisions_meeting ON meeting_decisions(meeting_id);

CREATE TABLE IF NOT EXISTS meeting_action_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id      TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  owner           TEXT,
  task            TEXT NOT NULL,
  due             TEXT,
  segment_ref     INTEGER,
  done            INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_actions_meeting ON meeting_action_items(meeting_id);

CREATE TABLE IF NOT EXISTS meeting_topics (
  meeting_id      TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  topic           TEXT NOT NULL,
  PRIMARY KEY (meeting_id, topic)
);

CREATE TABLE IF NOT EXISTS embeddings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id      TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  segment_id      INTEGER,
  kind            TEXT NOT NULL CHECK (kind IN ('transcript_chunk','summary','action_item','note')),
  content         TEXT NOT NULL,
  vector_json     TEXT NOT NULL,
  vector_dim      INTEGER NOT NULL,
  model           TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_embeddings_meeting ON embeddings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_kind ON embeddings(kind);

CREATE TABLE IF NOT EXISTS ask_conversations (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ask_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES ask_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  citations_json  TEXT,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ask_messages_conv ON ask_messages(conversation_id, id);
`
};
