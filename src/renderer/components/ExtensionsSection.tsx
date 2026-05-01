import { useEffect, useState } from 'react';

interface Token {
  id: string;
  label: string;
  createdAt: number;
}

/**
 * Settings card for the browser extension pairing flow.
 *
 * Click "Pair an extension" → 6-char code is generated server-side and
 * displayed here. User pastes it into the extension popup; extension calls
 * POST /pair with the code; server returns a Bearer token. Token is then
 * surfaced here so user can revoke later.
 */
export function ExtensionsSection() {
  const [port, setPort] = useState(0);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const refresh = async () => {
    const s = await window.floyd.extension.status();
    setPort(s.port);
    setTokens(s.tokens);
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      if (expiresAt && Date.now() > expiresAt) {
        setCode(null);
        setExpiresAt(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const pair = async () => {
    const r = await window.floyd.extension.pair('Browser extension');
    setCode(r.code);
    setExpiresAt(Date.now() + r.expiresInMs);
  };

  const revoke = async (id: string) => {
    await window.floyd.extension.revoke(id);
    await refresh();
  };

  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card">
      <h3 className="text-h4 mb-1">Browser extension</h3>
      <p className="text-caption text-ink-muted mb-4">
        Pair the Oli Chrome/Edge extension with this desktop app. Email rephrase + reply work
        directly in Gmail and Outlook Web. All requests stay on{' '}
        <span className="font-mono">127.0.0.1:{port || '…'}</span>.
      </p>

      {code ? (
        <div className="rounded-md border border-oli-blue bg-oli-blue/5 p-4 mb-4 text-center">
          <p className="text-caption uppercase tracking-wider text-ink-muted">Pairing code</p>
          <p className="text-h2 font-mono mt-1">{code}</p>
          <p className="text-caption text-ink-muted mt-1">
            Paste in extension popup. Expires in 5 min.
          </p>
        </div>
      ) : (
        <button
          onClick={pair}
          className="px-4 py-2 rounded-button text-btn text-white mb-4"
          style={{ background: 'var(--oli-gradient-primary)' }}
        >
          Pair an extension
        </button>
      )}

      {tokens.length === 0 ? (
        <p className="text-body-sm text-ink-muted">No extensions paired yet.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-caption uppercase tracking-wider text-ink-muted">Active</p>
          {tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-md border border-line bg-white px-3 py-2"
            >
              <div>
                <p className="text-body-sm font-medium">{t.label}</p>
                <p className="text-caption text-ink-muted">
                  Paired {new Date(t.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => void revoke(t.id)}
                className="text-btn px-3 py-1.5 rounded-button border border-line hover:bg-surface-cloud"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-caption text-ink-muted mt-4">
        The extension repository lives at{' '}
        <span className="font-mono">extension/</span> in the Oli source tree.
      </p>
    </div>
  );
}
