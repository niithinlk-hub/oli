/**
 * Migration 001 — establish the migrations system itself.
 *
 * No schema changes. Future migrations (Phase 2 calendar tables, Phase 3
 * embeddings/diarization tables) will land as 002, 003, etc.
 */
export const migration_001_init = {
  id: 1,
  name: 'init',
  sql: `-- migrations table created by runMigrations()`
};
