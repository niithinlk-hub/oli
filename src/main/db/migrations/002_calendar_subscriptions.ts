/**
 * Migration 002 — calendar subscriptions.
 *
 * Adds:
 *  - `calendar_subscriptions` table — one row per subscription source
 *    (ICS URL, ICS folder, Outlook COM bridge). The existing Google +
 *    Outlook OAuth integrations don't need a row here.
 *  - `subscription_id` column on `calendar_events` so we can attribute
 *    events to a specific subscription. Existing rows from the OAuth
 *    paths get NULL.
 *  - `auto_record_override` column on `calendar_events` (NULL = use
 *    global default; 0 = never, 1 = always).
 *
 * The `provider` CHECK on `calendar_events` is left intact — Outlook COM
 * events use provider='outlook' (they ARE Outlook events, just sourced
 * locally), and folder-watched .ics files use provider='ics'.
 */
export const migration_002_calendar_subscriptions = {
  id: 2,
  name: 'calendar_subscriptions',
  sql: `
CREATE TABLE IF NOT EXISTS calendar_subscriptions (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('ics-url','ics-folder','outlook-com')),
  name            TEXT NOT NULL,
  url             TEXT,
  folder_path     TEXT,
  color           TEXT,
  poll_minutes    INTEGER NOT NULL DEFAULT 15,
  enabled         INTEGER NOT NULL DEFAULT 1,
  last_synced_at  INTEGER,
  last_error      TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

ALTER TABLE calendar_events ADD COLUMN subscription_id TEXT REFERENCES calendar_subscriptions(id) ON DELETE SET NULL;
ALTER TABLE calendar_events ADD COLUMN auto_record_override INTEGER;

CREATE INDEX IF NOT EXISTS idx_cal_events_subscription ON calendar_events(subscription_id);
`
};
