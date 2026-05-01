/**
 * Local IPC HTTP server.
 *
 * Binds 127.0.0.1 only (rejects requests from non-loopback hosts even if
 * the socket somehow gets one). Used by the browser extension at
 * `extension/` to proxy email rephrase / reply through the desktop app
 * without round-tripping the user's API keys to a third party.
 *
 * Security:
 *  - All routes except /pair require a Bearer token issued via /pair
 *  - Tokens stored encrypted in safeStorage under `extension-tokens` (JSON
 *    array of { id, token, label, createdAt })
 *  - /pair returns a one-time pairing code that the user copies into the
 *    extension; only the desktop UI surfaces this code (Settings → Extensions)
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { randomBytes } from 'node:crypto';
import { rephraseEmail, type EmailTone, type EmailIntent } from '../llm/providers';
import { getSecret, setSecret } from '../secrets';

const TOKENS_SECRET = 'extension-tokens';
const PAIRING_TTL_MS = 5 * 60_000; // 5 min

interface ExtensionToken {
  id: string;
  token: string; // never returned by /tokens; only by /pair on creation
  label: string;
  createdAt: number;
}

let server: FastifyInstance | null = null;
let port = 0;
let pairingCode: { code: string; expiresAt: number; label: string } | null = null;

async function loadTokens(): Promise<ExtensionToken[]> {
  const raw = await getSecret(TOKENS_SECRET);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ExtensionToken[];
  } catch {
    return [];
  }
}

async function saveTokens(tokens: ExtensionToken[]): Promise<void> {
  await setSecret(TOKENS_SECRET, JSON.stringify(tokens));
}

export async function listExtensionTokens(): Promise<
  { id: string; label: string; createdAt: number }[]
> {
  const list = await loadTokens();
  return list.map(({ id, label, createdAt }) => ({ id, label, createdAt }));
}

export async function revokeExtensionToken(id: string): Promise<void> {
  const list = await loadTokens();
  await saveTokens(list.filter((t) => t.id !== id));
}

export function generatePairingCode(label: string = 'Extension'): string {
  const code = randomBytes(3).toString('hex').toUpperCase(); // 6 chars
  pairingCode = { code, expiresAt: Date.now() + PAIRING_TTL_MS, label };
  return code;
}

function authPlugin(): (req: { headers: Record<string, string | string[] | undefined> }) => Promise<boolean> {
  return async (req) => {
    const auth = req.headers['authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) return false;
    const token = auth.slice(7).trim();
    const list = await loadTokens();
    return list.some((t) => t.token === token);
  };
}

export async function startLocalServer(preferredPort = 7421): Promise<{ port: number }> {
  if (server) return { port };
  server = Fastify({ logger: false });
  await server.register(cors, {
    // Extensions hit us from chrome-extension:// origins. Allow specifically.
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (
        origin.startsWith('chrome-extension://') ||
        origin.startsWith('moz-extension://') ||
        origin === 'http://localhost' ||
        origin.startsWith('http://localhost:') ||
        origin === 'http://127.0.0.1' ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return cb(null, true);
      }
      return cb(new Error('not allowed'), false);
    }
  });

  // Refuse non-loopback even if socket binds to 0.0.0.0 by mistake.
  server.addHook('onRequest', async (req, reply) => {
    const ip = req.socket.remoteAddress ?? '';
    if (!(ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1')) {
      return reply.code(403).send({ error: 'loopback only' });
    }
  });

  const isAuthed = authPlugin();

  server.get('/status', async () => ({ ok: true, port }));

  server.post('/pair', async (req, reply) => {
    const code = (req.body as { code?: string } | null)?.code;
    if (!code || !pairingCode) return reply.code(400).send({ error: 'no pairing in progress' });
    if (Date.now() > pairingCode.expiresAt)
      return reply.code(410).send({ error: 'pairing code expired' });
    if (code.toUpperCase() !== pairingCode.code)
      return reply.code(401).send({ error: 'wrong code' });

    const id = randomBytes(8).toString('hex');
    const token = randomBytes(24).toString('base64url');
    const tokens = await loadTokens();
    tokens.push({ id, token, label: pairingCode.label, createdAt: Date.now() });
    await saveTokens(tokens);
    pairingCode = null;
    return { ok: true, token, id };
  });

  server.post('/rephrase', async (req, reply) => {
    if (!(await isAuthed(req as never))) return reply.code(401).send({ error: 'unauthorized' });
    const body = req.body as
      | { text?: string; tone?: EmailTone; intent?: EmailIntent; contextNote?: string }
      | null;
    if (!body?.text?.trim()) return reply.code(400).send({ error: 'text required' });
    try {
      const out = await rephraseEmail({
        originalText: body.text,
        tone: (body.tone ?? 'professional') as EmailTone,
        intent: (body.intent ?? 'rephrase') as EmailIntent,
        contextNote: body.contextNote
      });
      return { ok: true, text: out };
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });

  // Bind only to loopback. Try preferred port; on EADDRINUSE try +1..+5.
  for (let i = 0; i < 6; i++) {
    try {
      const tryPort = preferredPort + i;
      await server.listen({ port: tryPort, host: '127.0.0.1' });
      port = tryPort;
      return { port };
    } catch (err) {
      if ((err as { code?: string }).code !== 'EADDRINUSE') throw err;
    }
  }
  await server.close();
  server = null;
  throw new Error(`could not bind localServer on ${preferredPort}-${preferredPort + 5}`);
}

export async function stopLocalServer(): Promise<void> {
  if (server) {
    await server.close();
    server = null;
    port = 0;
  }
}

export function getLocalServerPort(): number {
  return port;
}
