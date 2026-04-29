import { initDb } from './repo';

export const settingsRepo = {
  get(key: string): string | null {
    const row = initDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  },
  set(key: string, value: string): void {
    initDb()
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`
      )
      .run(key, value);
  },
  delete(key: string): void {
    initDb().prepare('DELETE FROM settings WHERE key = ?').run(key);
  }
};

export const SETTINGS_KEYS = {
  whisperBinary: 'whisper.binary_path',
  whisperModel: 'whisper.model_path',
  openAiKeyPresent: 'openai.key_present'
} as const;
