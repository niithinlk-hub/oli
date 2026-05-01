/**
 * ICS subscription URL polling.
 *
 * For each enabled `ics-url` subscription, fetch the URL on its poll interval,
 * parse the body via node-ical, and replace the events under that subscription.
 *
 * Uses Electron's `net` module so we get OS-level proxy handling for free.
 */
import { net } from 'electron';
import { calendarEventsRepo } from './repo';
import { calendarSubscriptionsRepo, type CalendarSubscription } from './subscriptions';
import { parseIcsBuffer } from './icsParse';

async function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, method: 'GET', redirect: 'follow' });
    let body = '';
    req.on('response', (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.on('data', (c) => (body += c.toString('utf8')));
      res.on('end', () => resolve(body));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

export async function syncIcsSubscription(sub: CalendarSubscription): Promise<{
  ok: boolean;
  count: number;
  message?: string;
}> {
  if (sub.kind !== 'ics-url' || !sub.url) {
    return { ok: false, count: 0, message: 'not an ics-url subscription' };
  }
  try {
    const body = await fetchUrl(sub.url);
    const events = parseIcsBuffer(body, 'ics');
    calendarEventsRepo.replaceForSubscription(sub.id, events);
    calendarSubscriptionsRepo.markSynced(sub.id, null);
    return { ok: true, count: events.length };
  } catch (err) {
    const message = (err as Error).message;
    calendarSubscriptionsRepo.markSynced(sub.id, message);
    return { ok: false, count: 0, message };
  }
}

export async function syncAllIcsSubscriptions(): Promise<{ synced: number; errors: number }> {
  const subs = calendarSubscriptionsRepo
    .list()
    .filter((s) => s.kind === 'ics-url' && s.enabled);
  let synced = 0;
  let errors = 0;
  for (const sub of subs) {
    const r = await syncIcsSubscription(sub);
    if (r.ok) synced += 1;
    else errors += 1;
  }
  return { synced, errors };
}
