/**
 * Forward-only schema migrations.
 *
 * Each migration is a numbered SQL string. Run order is by filename prefix.
 * Idempotent — `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN` style.
 *
 * Versioning lives in `schema_migrations(id INTEGER PRIMARY KEY, applied_at INT)`.
 *
 * Migrations are applied AFTER `SCHEMA_SQL` runs, so they layer on top of the
 * baseline schema. New tables for calendar/embeddings/etc go here, not in
 * `schema.ts`.
 */
import type Database from 'better-sqlite3';
import { migration_001_init } from './001_init';
import { migration_002_calendar_subscriptions } from './002_calendar_subscriptions';

interface Migration {
  id: number;
  name: string;
  sql: string;
}

const ALL: Migration[] = [migration_001_init, migration_002_calendar_subscriptions];

export function runMigrations(db: Database.Database): { applied: number[] } {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  )`);
  const seen = new Set(
    (db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[]).map((r) => r.id)
  );
  const applied: number[] = [];
  for (const m of ALL.sort((a, b) => a.id - b.id)) {
    if (seen.has(m.id)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
        m.id,
        m.name,
        Date.now()
      );
    })();
    applied.push(m.id);
  }
  return { applied };
}
