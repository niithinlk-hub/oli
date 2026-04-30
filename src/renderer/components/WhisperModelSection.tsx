import { useEffect, useState } from 'react';

interface CatalogEntry {
  id: string;
  label: string;
  bytes: number;
  description: string;
}

function fmtMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

export function WhisperModelSection() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const [c, i] = await Promise.all([
      window.floyd.whisper.listCatalog(),
      window.floyd.whisper.listInstalled()
    ]);
    setCatalog(c);
    setInstalled(i);
  };

  useEffect(() => {
    void refresh();
    const off = window.floyd.whisper.onProgress((p) => {
      setProgress((prev) => ({ ...prev, [p.modelId]: p.percent }));
    });
    return () => {
      off();
    };
  }, []);

  const download = async (id: string) => {
    setBusy(id);
    setMessage(null);
    setProgress((p) => ({ ...p, [id]: 0 }));
    const res = await window.floyd.whisper.downloadModel(id);
    if (res.ok) {
      setMessage(`Downloaded ${id}.`);
    } else {
      setMessage(res.message ?? `Failed to download ${id}.`);
    }
    setBusy(null);
    setProgress((p) => {
      const { [id]: _omit, ...rest } = p;
      return rest;
    });
    await refresh();
  };

  const cancel = async (id: string) => {
    await window.floyd.whisper.cancelDownload(id);
    setBusy(null);
    setProgress((p) => {
      const { [id]: _omit, ...rest } = p;
      return rest;
    });
  };

  const select = async (id: string) => {
    await window.floyd.whisper.selectModel(id);
    setMessage(`Active model set to ${id}.`);
  };

  const remove = async (id: string) => {
    await window.floyd.whisper.deleteModel(id);
    await refresh();
  };

  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card">
      <h3 className="text-h4 mb-1">Whisper models</h3>
      <p className="text-caption text-ink-muted mb-4">
        Local speech-to-text models. Download once; stored at <span className="font-mono">%APPDATA%\Oli\models\</span>.
      </p>

      <div className="space-y-2">
        {catalog.map((m) => {
          const isInstalled = installed.includes(m.id);
          const pct = progress[m.id];
          const isBusy = busy === m.id;
          return (
            <div key={m.id} className="rounded-md border border-line bg-white px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-medium">{m.label}</p>
                  <p className="text-caption text-ink-muted">{m.description}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {isInstalled ? (
                    <>
                      <button
                        onClick={() => select(m.id)}
                        className="px-2.5 py-1 rounded-button text-btn text-white"
                        style={{ background: 'var(--oli-gradient-primary)' }}
                      >
                        Use
                      </button>
                      <button
                        onClick={() => remove(m.id)}
                        className="text-btn px-2.5 py-1 rounded-button border border-line text-ink-secondary hover:bg-surface-cloud"
                      >
                        Delete
                      </button>
                    </>
                  ) : isBusy ? (
                    <button
                      onClick={() => cancel(m.id)}
                      className="text-btn px-2.5 py-1 rounded-button border border-line text-ink-secondary hover:bg-surface-cloud"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => download(m.id)}
                      disabled={busy !== null}
                      className="px-2.5 py-1 rounded-button text-btn border border-line bg-white hover:bg-surface-cloud disabled:opacity-40"
                    >
                      Download · {fmtMB(m.bytes)}
                    </button>
                  )}
                </div>
              </div>
              {pct !== undefined && (
                <div className="mt-2">
                  <div className="h-1.5 w-full bg-surface-cloud rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: 'var(--oli-gradient-primary)'
                      }}
                    />
                  </div>
                  <p className="text-caption text-ink-muted mt-1 font-mono">{pct}%</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {message && <p className="text-caption text-ink-secondary mt-3">{message}</p>}
    </div>
  );
}
