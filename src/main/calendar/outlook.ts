import { shell } from 'electron';
import { createServer, type Server } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { settingsRepo } from '../db/settings';
import { setSecret, getSecret, deleteSecret, hasSecret } from '../secrets';
import { calendarEventsRepo } from './repo';

const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const SCOPES = ['Calendars.Read', 'offline_access'];

const SECRET_NAME = 'outlook-refresh-token';
let cached: { token: string; expiresAt: number } | null = null;

export const OUTLOOK_SETTINGS_KEYS = {
  clientId: 'outlook.client_id'
} as const;

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export class OutlookNotConfiguredError extends Error {
  constructor() {
    super('Microsoft client ID not set. Add it in Settings.');
  }
}

export async function isConnected(): Promise<boolean> {
  return hasSecret(SECRET_NAME);
}

export async function disconnect(): Promise<void> {
  await deleteSecret(SECRET_NAME);
  cached = null;
}

export async function connect(): Promise<{ ok: true } | { ok: false; message: string }> {
  const clientId = settingsRepo.get(OUTLOOK_SETTINGS_KEYS.clientId);
  if (!clientId) return { ok: false, message: 'Microsoft client ID not set in Settings.' };

  const { verifier, challenge } = makePkcePair();
  const state = base64Url(randomBytes(16));

  let server: Server | null = null;
  const port: number = await new Promise((resolve, reject) => {
    server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      if (addr && typeof addr === 'object') resolve(addr.port);
      else reject(new Error('failed to bind loopback port'));
    });
  });

  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    prompt: 'select_account'
  });

  await shell.openExternal(`${AUTH_URL}?${params.toString()}`);

  const code: string = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server?.close();
      reject(new Error('OAuth timed out (no response within 5 minutes)'));
    }, 5 * 60_000);

    server!.on('request', (req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
        if (url.pathname !== '/callback') {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        const returnedState = url.searchParams.get('state');
        const returnedCode = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        if (error || returnedState !== state || !returnedCode) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html');
          res.end(htmlMessage('Authorization failed', error ?? 'state mismatch'));
          clearTimeout(timeout);
          server?.close();
          reject(new Error(error ?? 'OAuth state mismatch'));
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(htmlMessage('You are connected to Oli', 'You can close this tab.'));
        clearTimeout(timeout);
        server?.close();
        resolve(returnedCode);
      } catch (err) {
        clearTimeout(timeout);
        server?.close();
        reject(err);
      }
    });
  });

  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      scope: SCOPES.join(' ')
    })
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    return { ok: false, message: `Token exchange failed: ${tokenResponse.status} ${text.slice(0, 200)}` };
  }
  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  if (!tokens.refresh_token) {
    return { ok: false, message: 'No refresh token returned. Reconnect with offline_access scope.' };
  }
  await setSecret(SECRET_NAME, tokens.refresh_token);
  cached = {
    token: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in - 60) * 1000
  };
  return { ok: true };
}

function htmlMessage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
<style>body{font-family:Inter,system-ui,sans-serif;background:#F8FAFC;color:#0F172A;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#fff;padding:32px 40px;border-radius:20px;box-shadow:0 8px 30px rgba(15,23,42,0.08);max-width:420px;text-align:center}
h1{margin:0 0 8px;font-size:22px}p{margin:0;color:#475569}</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const clientId = settingsRepo.get(OUTLOOK_SETTINGS_KEYS.clientId);
  if (!clientId) throw new OutlookNotConfiguredError();
  const refreshToken = await getSecret(SECRET_NAME);
  if (!refreshToken) throw new Error('Not connected to Outlook.');

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
      scope: SCOPES.join(' ')
    })
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`refresh failed: ${r.status} ${text.slice(0, 200)}`);
  }
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, expiresAt: Date.now() + (j.expires_in - 60) * 1000 };
  return j.access_token;
}

interface GraphEvent {
  id: string;
  subject?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: { emailAddress?: { address?: string } }[];
  onlineMeeting?: { joinUrl?: string };
  webLink?: string;
}

export async function fetchUpcomingEvents(windowMs: number): Promise<void> {
  const token = await getAccessToken();
  const startDateTime = new Date().toISOString();
  const endDateTime = new Date(Date.now() + windowMs).toISOString();
  const url =
    'https://graph.microsoft.com/v1.0/me/calendarView?' +
    new URLSearchParams({
      startDateTime,
      endDateTime,
      $orderby: 'start/dateTime',
      $top: '20'
    });
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="UTC"'
    }
  });
  if (!r.ok) throw new Error(`graph events failed: ${r.status}`);
  const j = (await r.json()) as { value?: GraphEvent[] };
  const items = j.value ?? [];
  const events = items.map((e) => ({
    provider: 'outlook' as const,
    externalId: e.id,
    title: e.subject ?? '(no title)',
    startsAt: new Date(e.start.dateTime + 'Z').getTime(),
    endsAt: new Date(e.end.dateTime + 'Z').getTime(),
    attendees: (e.attendees ?? [])
      .map((a) => a.emailAddress?.address)
      .filter((s): s is string => Boolean(s)),
    meetingUrl: e.onlineMeeting?.joinUrl ?? null
  }));
  calendarEventsRepo.upsertMany(events);
}
