/**
 * Outlook COM bridge — Windows-only.
 *
 * Spawns PowerShell with `New-Object -ComObject Outlook.Application` to read
 * appointments from the locally-installed Outlook desktop client. Bypasses
 * tenant-level OAuth restrictions because we're talking to the user's own
 * Outlook profile, not the Microsoft 365 API.
 *
 * Behind a feature flag (`calendar.outlook.com.enabled`). Disabled by default.
 * Detection: probe HKLM/HKCU registry for `outlook.exe` install. Gray out the
 * toggle in Settings if not found.
 */
import { execFile } from 'node:child_process';
import { calendarEventsRepo } from './repo';
import { calendarSubscriptionsRepo, type CalendarSubscription } from './subscriptions';

interface ComEvent {
  uid: string;
  subject: string;
  start: string; // ISO
  end: string;
  location?: string;
  attendees?: string[];
  body?: string;
}

const POWERSHELL_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  $outlook = New-Object -ComObject Outlook.Application
  $ns = $outlook.GetNamespace('MAPI')
  $cal = $ns.GetDefaultFolder(9) # olFolderCalendar
  $items = $cal.Items
  $items.IncludeRecurrences = $true
  $items.Sort('[Start]')
  $now = (Get-Date)
  $end = $now.AddDays(14)
  $filter = "[Start] >= '" + $now.ToString('g') + "' AND [Start] <= '" + $end.ToString('g') + "'"
  $restricted = $items.Restrict($filter)
  $out = New-Object System.Collections.Generic.List[PSObject]
  foreach ($i in $restricted) {
    if ($null -eq $i.Start) { continue }
    $att = @()
    if ($i.Recipients) {
      foreach ($r in $i.Recipients) { $att += $r.Address }
    }
    $out.Add([PSCustomObject]@{
      uid       = if ($i.GlobalAppointmentID) { $i.GlobalAppointmentID } else { $i.EntryID }
      subject   = $i.Subject
      start     = ([datetime]$i.Start).ToString('o')
      end       = ([datetime]$i.End).ToString('o')
      location  = $i.Location
      attendees = $att
      body      = $i.Body
    })
  }
  $out | ConvertTo-Json -Depth 4 -Compress
} catch {
  Write-Error $_.Exception.Message
  exit 2
}
`;

export async function isOutlookInstalled(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  return new Promise((resolve) => {
    execFile(
      'powershell',
      ['-NoProfile', '-Command', "Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Office\\Outlook' -or Test-Path 'HKCU:\\SOFTWARE\\Microsoft\\Office\\Outlook'"],
      { timeout: 4000, windowsHide: true },
      (err, stdout) => {
        if (err) {
          resolve(false);
          return;
        }
        resolve(stdout.trim().toLowerCase() === 'true');
      }
    );
  });
}

async function runComScript(): Promise<ComEvent[]> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', POWERSHELL_SCRIPT],
      { timeout: 30_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
          return;
        }
        try {
          const parsed = JSON.parse(stdout || '[]');
          // PowerShell returns single object or array.
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          resolve(arr as ComEvent[]);
        } catch (parseErr) {
          reject(parseErr as Error);
        }
      }
    );
  });
}

export async function syncOutlookCom(sub: CalendarSubscription): Promise<{
  ok: boolean;
  count: number;
  message?: string;
}> {
  if (process.platform !== 'win32') {
    return { ok: false, count: 0, message: 'Outlook COM bridge is Windows-only.' };
  }
  if (sub.kind !== 'outlook-com') {
    return { ok: false, count: 0, message: 'not an outlook-com subscription' };
  }
  try {
    const events = await runComScript();
    const upserts = events.map((e) => ({
      provider: 'outlook' as const,
      externalId: e.uid,
      title: e.subject || '(no title)',
      startsAt: new Date(e.start).getTime(),
      endsAt: new Date(e.end).getTime(),
      attendees: e.attendees ?? [],
      meetingUrl: extractTeamsLink(e.body) ?? null
    }));
    calendarEventsRepo.replaceForSubscription(sub.id, upserts);
    calendarSubscriptionsRepo.markSynced(sub.id, null);
    return { ok: true, count: upserts.length };
  } catch (err) {
    const message = (err as Error).message;
    calendarSubscriptionsRepo.markSynced(sub.id, message);
    return { ok: false, count: 0, message };
  }
}

function extractTeamsLink(body: string | undefined): string | null {
  if (!body) return null;
  const m = body.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s>"]+/);
  return m ? m[0] : null;
}
