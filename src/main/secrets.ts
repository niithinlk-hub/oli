import { app, safeStorage } from 'electron';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Encrypted secret storage. Uses Electron's safeStorage (DPAPI on Windows,
 * Keychain on macOS, libsecret on Linux). Files live under <userData>/secrets/.
 *
 * No keytar = no native compile chain to fight on Windows.
 */
function secretsDir(): string {
  return join(app.getPath('userData'), 'secrets');
}

async function ensureDir(): Promise<void> {
  await mkdir(secretsDir(), { recursive: true });
}

export async function setSecret(name: string, plaintext: string): Promise<void> {
  await ensureDir();
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS encryption is unavailable. On Linux, install libsecret or run with --password-store; on macOS grant Keychain access.'
    );
  }
  const enc = safeStorage.encryptString(plaintext);
  await writeFile(join(secretsDir(), `${name}.bin`), enc);
}

export async function getSecret(name: string): Promise<string | null> {
  try {
    const buf = await readFile(join(secretsDir(), `${name}.bin`));
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

export async function hasSecret(name: string): Promise<boolean> {
  try {
    await readFile(join(secretsDir(), `${name}.bin`));
    return true;
  } catch {
    return false;
  }
}

export async function deleteSecret(name: string): Promise<void> {
  try {
    await unlink(join(secretsDir(), `${name}.bin`));
  } catch {
    // already gone
  }
}

export const SECRET_NAMES = {
  openAiKey: 'openai-key',
  googleRefreshToken: 'google-refresh-token',
  outlookRefreshToken: 'outlook-refresh-token'
} as const;
