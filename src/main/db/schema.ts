/**
 * SQLite schema as a string. Mirrors schema.sql (kept around for reference).
 * Inlined here so the bundled main process doesn't depend on a sibling .sql
 * file at runtime.
 */
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meetings (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  status          TEXT NOT NULL DEFAULT 'idle',
  calendar_event_id TEXT,
  template_id     TEXT,
  audio_path      TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meetings_started_at ON meetings(started_at DESC);

CREATE TABLE IF NOT EXISTS transcript_segments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id      TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  start_ms        INTEGER NOT NULL,
  end_ms          INTEGER NOT NULL,
  text            TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('system','mic','mixed'))
);
CREATE INDEX IF NOT EXISTS idx_transcript_meeting ON transcript_segments(meeting_id, start_ms);

CREATE TABLE IF NOT EXISTS notes (
  meeting_id        TEXT PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,
  raw_markdown      TEXT NOT NULL DEFAULT '',
  enhanced_markdown TEXT,
  updated_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  system_prompt   TEXT NOT NULL,
  built_in        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id              TEXT PRIMARY KEY,
  provider        TEXT NOT NULL CHECK (provider IN ('google','outlook','ics')),
  external_id     TEXT NOT NULL,
  title           TEXT NOT NULL,
  starts_at       INTEGER NOT NULL,
  ends_at         INTEGER NOT NULL,
  attendees_json  TEXT NOT NULL DEFAULT '[]',
  meeting_url     TEXT,
  UNIQUE(provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_cal_starts_at ON calendar_events(starts_at);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider        TEXT PRIMARY KEY,
  encrypted_blob  TEXT NOT NULL,
  expires_at      INTEGER,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key             TEXT PRIMARY KEY,
  value           TEXT NOT NULL
);
`;
