import { useEffect, useState } from 'react';

interface Subscription {
  id: string;
  kind: 'ics-url' | 'ics-folder' | 'outlook-com';
  name: string;
  url: string | null;
  folderPath: string | null;
  color: string | null;
  pollMinutes: number;
  enabled: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
}

type Mode = 'off' | 'prompt' | 'auto';

export function CalendarSubscriptionsSection() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [comAvailable, setComAvailable] = useState(false);
  const [defaultFolder, setDefaultFolder] = useState('');
  const [autoMode, setAutoMode] = useState<Mode>('off');
  const [adding, setAdding] = useState<'ics-url' | 'ics-folder' | 'outlook-com' | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [draftFolder, setDraftFolder] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const [list, com, dir, mode] = await Promise.all([
      window.floyd.calendar.subs.list(),
      window.floyd.calendar.outlookComAvailable(),
      window.floyd.calendar.defaultFolderPath(),
      window.floyd.calendar.autoRecord.get()
    ]);
    setSubs(list);
    setComAvailable(com);
    setDefaultFolder(dir);
    setAutoMode(mode);
    if (!draftFolder) setDraftFolder(dir);
  };

  useEffect(() => {
    void refresh();
    const off = window.floyd.calendar.onUpdated(() => void refresh());
    return () => {
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAdd = (kind: 'ics-url' | 'ics-folder' | 'outlook-com') => {
    setAdding(kind);
    setDraftName(
      kind === 'ics-url' ? 'My ICS calendar' : kind === 'ics-folder' ? 'Local ICS folder' : 'Outlook desktop'
    );
    setDraftUrl('');
    setDraftFolder(defaultFolder);
    setMessage(null);
  };

  const submitAdd = async () => {
    if (!adding) return;
    if (adding === 'ics-url' && !draftUrl.trim()) {
      setMessage('Paste an ICS URL.');
      return;
    }
    await window.floyd.calendar.subs.add({
      kind: adding,
      name: draftName.trim() || adding,
      url: adding === 'ics-url' ? draftUrl.trim() : null,
      folderPath: adding === 'ics-folder' ? draftFolder.trim() || defaultFolder : null
    });
    setAdding(null);
    setMessage(`Added ${draftName}.`);
    await refresh();
  };

  const sync = async (id: string) => {
    setBusyId(id);
    const r = await window.floyd.calendar.subs.sync(id);
    setMessage(r.ok ? `Synced ${r.count ?? 0} events.` : `Sync failed: ${r.message ?? 'unknown'}`);
    setBusyId(null);
    await refresh();
  };

  const remove = async (id: string) => {
    await window.floyd.calendar.subs.remove(id);
    await refresh();
  };

  const toggleEnabled = async (s: Subscription) => {
    await window.floyd.calendar.subs.update(s.id, { enabled: !s.enabled });
    await refresh();
  };

  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card">
      <h3 className="text-h4 mb-1">Calendar subscriptions</h3>
      <p className="text-caption text-ink-muted mb-4">
        Three ways to ingest events without OAuth. Useful when your work tenant blocks third-party apps.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => startAdd('ics-url')}
          className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud"
        >
          + ICS URL
        </button>
        <button
          onClick={() => startAdd('ics-folder')}
          className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud"
        >
          + Local folder
        </button>
        <button
          onClick={() => startAdd('outlook-com')}
          disabled={!comAvailable}
          title={comAvailable ? 'Read from local Outlook desktop' : 'Outlook not detected on this machine'}
          className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud disabled:opacity-40"
        >
          + Outlook desktop {comAvailable ? '' : '(not installed)'}
        </button>
      </div>

      {adding && (
        <div className="rounded-md border border-oli-blue/30 bg-oli-blue/5 p-3 mb-4">
          <p className="text-caption uppercase tracking-wider text-ink-muted mb-2">
            New {adding === 'ics-url' ? 'ICS URL' : adding === 'ics-folder' ? 'folder watcher' : 'Outlook COM'}
          </p>
          <div className="grid grid-cols-1 gap-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Name"
              className="px-3 py-2 rounded-md border border-line bg-white text-body-sm"
            />
            {adding === 'ics-url' && (
              <input
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="https://… .ics"
                className="px-3 py-2 rounded-md border border-line bg-white text-body-sm font-mono"
              />
            )}
            {adding === 'ics-folder' && (
              <input
                value={draftFolder}
                onChange={(e) => setDraftFolder(e.target.value)}
                placeholder={defaultFolder}
                className="px-3 py-2 rounded-md border border-line bg-white text-body-sm font-mono"
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => void submitAdd()}
                className="px-4 py-2 rounded-button text-btn text-white"
                style={{ background: 'var(--oli-gradient-primary)' }}
              >
                Add
              </button>
              <button
                onClick={() => setAdding(null)}
                className="text-btn px-3 py-2 rounded-button border border-line bg-white hover:bg-surface-cloud"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {subs.length === 0 ? (
          <p className="text-body-sm text-ink-muted">No subscriptions yet.</p>
        ) : (
          subs.map((s) => (
            <div key={s.id} className="rounded-md border border-line bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm font-medium truncate">{s.name}</span>
                    <span className="text-caption text-ink-muted">{s.kind}</span>
                    {!s.enabled && (
                      <span className="text-caption text-oli-coral">paused</span>
                    )}
                  </div>
                  <p className="text-caption text-ink-muted truncate font-mono">
                    {s.url ?? s.folderPath ?? 'Outlook desktop COM'}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {s.lastSyncedAt
                      ? `Last sync ${new Date(s.lastSyncedAt).toLocaleTimeString()}`
                      : 'Never synced'}
                    {s.lastError && (
                      <span className="text-oli-coral"> · {s.lastError}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => void sync(s.id)}
                    disabled={busyId === s.id}
                    className="text-btn px-2 py-1 rounded-button border border-line text-ink-secondary hover:bg-surface-cloud disabled:opacity-40"
                  >
                    {busyId === s.id ? '…' : 'Sync'}
                  </button>
                  <button
                    onClick={() => void toggleEnabled(s)}
                    className="text-btn px-2 py-1 rounded-button border border-line text-ink-secondary hover:bg-surface-cloud"
                  >
                    {s.enabled ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => void remove(s.id)}
                    className="text-btn px-2 py-1 rounded-button border border-line text-ink-secondary hover:bg-surface-cloud"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-line pt-4">
        <p className="text-caption uppercase tracking-wider text-ink-muted mb-2">
          Auto-record
        </p>
        <div className="flex gap-2">
          {(['off', 'prompt', 'auto'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={async () => {
                await window.floyd.calendar.autoRecord.set(m);
                setAutoMode(m);
              }}
              className={`text-btn px-3 py-1.5 rounded-button border transition ${
                autoMode === m
                  ? 'border-oli-blue bg-oli-blue/5'
                  : 'border-line bg-white hover:bg-surface-cloud'
              }`}
            >
              {m === 'off' ? 'Off' : m === 'prompt' ? 'Prompt me' : 'Auto'}
            </button>
          ))}
        </div>
        <p className="text-caption text-ink-muted mt-2">
          {autoMode === 'off'
            ? 'No notifications.'
            : autoMode === 'prompt'
              ? 'Native notification 60s before each event with Start / Skip.'
              : 'Recording starts automatically when an event begins.'}
        </p>
      </div>

      {message && <p className="text-caption text-ink-secondary mt-3">{message}</p>}
    </div>
  );
}
