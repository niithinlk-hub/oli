import { shell } from 'electron';
import { createServer, type Server } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { settingsRepo, SETTINGS_KEYS } from '../db/settings';
import { setSecret, getSecret, deleteSecret, hasSecret, SECRET_NAMES } from '../secrets';
import { calendarEventsRepo } from './repo';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export const GOOGLE_SETTINGS_KEYS = {
  clientId: 'google.client_id'
} as const;

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export class GoogleNotConfiguredError extends Error {
  constructor() {
    super('Google client ID not set. Add it in Settings.');
  }
}

export async function isConnected(): Promise<boolean> {
  return hasSecret(SECRET_NAMES.googleRefreshToken);
}

export async function disconnect(): Promise<void> {
  await deleteSecret(SECRET_NAMES.googleRefreshToken);
  cachedAccessToken = null;
}

/**
 * PKCE OAuth flow:
 *  - Bind a loopback HTTP server on a random free port.
 *  - Open the user's browser to Google's consent screen.
 *  - Receive the auth code on the loopback redirect.
 *  - Exchange code+verifier for tokens.
 *  - Persist refresh_token in safeStorage.
 */
export async function connect(): Promise<{ ok: true } | { ok: false; message: string }> {
  const clientId = settingsRepo.get(GOOGLE_SETTINGS_KEYS.clientId);
  if (!clientId) return { ok: false, message: 'Google client ID not set in Settings.' };

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
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent'
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
        if (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html');
          res.end(htmlMessage('Authorization denied', error));
          clearTimeout(timeout);
          server?.close();
          reject(new Error(`Google denied authorization: ${error}`));
          return;
        }
        if (returnedState !== state || !returnedCode) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html');
          res.end(htmlMessage('Invalid response', 'state mismatch or missing code'));
          clearTimeout(timeout);
          server?.close();
          reject(new Error('OAuth state mismatch'));
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
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier
    })
  });

  if (!tokenResponse.ok) {
    return { ok: false, message: `Token exchange failed: ${tokenResponse.status}` };
  }
  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  if (!tokens.refresh_token) {
    return { ok: false, message: 'No refresh token returned. Try removing app access in your Google account and reconnect.' };
  }
  await setSecret(SECRET_NAMES.googleRefreshToken, tokens.refresh_token);
  cachedAccessToken = {
    token: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in - 60) * 1000
  };
  return { ok: true };
}

function htmlMessage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
<style>body{font-family:Inter,system-ui,sans-serif;background:#F8FAFC;color:#0F172A;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#fff;padding:32px 40px;border-radius:20px;box-shadow:0 8px 30px rgba(15,23,42,0.08);max-width:420px;text-align:center}
h1{margin:0 0 8px;font-size:22px} p{margin:0;color:#475569}</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }
  const clientId = settingsRepo.get(GOOGLE_SETTINGS_KEYS.clientId);
  if (!clientId) throw new GoogleNotConfiguredError();
  const refreshToken = await getSecret(SECRET_NAMES.googleRefreshToken);
  if (!refreshToken) throw new Error('Not connected to Google.');

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    })
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`refresh failed: ${r.status} ${text.slice(0, 200)}`);
  }
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: j.access_token,
    expiresAt: Date.now() + (j.expires_in - 60) * 1000
  };
  return j.access_token;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string }[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { uri?: string }[] };
}

export async function fetchUpcomingEvents(windowMs: number): Promise<void> {
  const token = await getAccessToken();
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + windowMs).toISOString();
  const url =
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
    new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '20'
    });
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`calendar list failed: ${r.status}`);
  const j = (await r.json()) as { items?: GoogleEvent[] };
  const items = j.items ?? [];

  const events = items
    .filter((e) => e.start?.dateTime || e.start?.date)
    .map((e) => ({
      provider: 'google' as const,
      externalId: e.id,
      title: e.summary ?? '(no title)',
      startsAt: new Date(e.start.dateTime ?? e.start.date!).getTime(),
      endsAt: new Date(e.end.dateTime ?? e.end.date!).getTime(),
      attendees: (e.attendees ?? []).map((a) => a.email),
      meetingUrl: e.hangoutLink ?? e.conferenceData?.entryPoints?.[0]?.uri ?? null
    }));

  calendarEventsRepo.upsertMany(events);
}
