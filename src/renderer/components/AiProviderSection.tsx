import { useEffect, useState } from 'react';

interface ProviderStatus {
  id: string;
  label: string;
  configured: boolean;
  model: string;
}

const CONSOLE_URLS: Record<string, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  gemini: 'https://aistudio.google.com/app/apikey',
  groq: 'https://console.groq.com/keys'
};

export function AiProviderSection() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [active, setActive] = useState<string>('openai');
  const [keyDraft, setKeyDraft] = useState('');
  const [modelDraft, setModelDraft] = useState('');
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async (selected?: string) => {
    const [list, current] = await Promise.all([
      window.floyd.llm.listProviders(),
      window.floyd.llm.getActiveProvider()
    ]);
    setProviders(list);
    const next = selected ?? current;
    setActive(next);
    const [m, override] = await Promise.all([
      window.floyd.llm.getMaskedKey(next),
      window.floyd.llm.getModelOverride(next)
    ]);
    setMaskedKey(m);
    setModelDraft(override ?? '');
  };

  useEffect(() => {
    void refresh();
  }, []);

  const pickProvider = async (id: string) => {
    setMessage(null);
    setKeyDraft('');
    await window.floyd.llm.setActiveProvider(id);
    await refresh(id);
  };

  const saveKey = async () => {
    if (!keyDraft.trim()) return;
    setSaving(true);
    setMessage(null);
    const res = await window.floyd.llm.setProviderKey(active, keyDraft.trim());
    setMessage(res.message ?? null);
    setKeyDraft('');
    await refresh(active);
    setSaving(false);
  };

  const removeKey = async () => {
    await window.floyd.llm.setProviderKey(active, null);
    setMessage(null);
    await refresh(active);
  };

  const saveModel = async () => {
    await window.floyd.llm.setModelOverride(active, modelDraft.trim() || null);
    setMessage('Model override saved.');
    await refresh(active);
  };

  const activeMeta = providers.find((p) => p.id === active);

  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card">
      <h3 className="text-h4 mb-1">AI provider</h3>
      <p className="text-caption text-ink-muted mb-4">
        Powers note enhancement and Ask Oli. Pick a provider, paste an API key. Keys encrypted via OS keychain (safeStorage).
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => pickProvider(p.id)}
            className={`text-left px-3 py-2 rounded-md border transition ${
              active === p.id
                ? 'border-oli-blue bg-oli-blue/5'
                : 'border-line bg-white hover:bg-surface-cloud'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-body-sm font-medium">{p.label}</span>
              {p.configured && (
                <span className="text-caption text-oli-blue">✓ key set</span>
              )}
            </div>
            <p className="text-caption text-ink-muted font-mono mt-0.5">{p.model}</p>
          </button>
        ))}
      </div>

      {activeMeta && (
        <>
          {maskedKey ? (
            <div className="flex items-center justify-between rounded-md border border-line bg-white px-3 py-2">
              <div>
                <p className="text-body-sm font-medium">Configured</p>
                <p className="text-caption text-ink-muted font-mono">{maskedKey}</p>
              </div>
              <button
                onClick={removeKey}
                className="text-btn px-3 py-1.5 rounded-button border border-line text-ink-secondary hover:bg-surface-cloud"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder={
                  active === 'anthropic'
                    ? 'sk-ant-…'
                    : active === 'groq'
                      ? 'gsk_…'
                      : active === 'gemini'
                        ? 'AIza…'
                        : 'sk-…'
                }
                className="flex-1 px-3 py-2 rounded-md border border-line bg-white text-body-sm font-mono"
              />
              <button
                disabled={saving || !keyDraft.trim()}
                onClick={saveKey}
                className="px-4 py-2 rounded-button text-btn text-white disabled:opacity-50"
                style={{ background: 'var(--oli-gradient-primary)' }}
              >
                {saving ? 'Validating…' : 'Save'}
              </button>
            </div>
          )}

          <div className="mt-3">
            <label className="text-caption uppercase tracking-wider text-ink-muted block mb-1">
              Model override (optional)
            </label>
            <div className="flex gap-2">
              <input
                value={modelDraft}
                onChange={(e) => setModelDraft(e.target.value)}
                placeholder={`Default: ${activeMeta.model}`}
                className="flex-1 px-3 py-2 rounded-md border border-line bg-white text-body-sm font-mono"
              />
              <button
                onClick={saveModel}
                className="px-3 py-2 rounded-button text-btn border border-line bg-white hover:bg-surface-cloud"
              >
                Save
              </button>
            </div>
          </div>

          <p className="text-caption text-ink-muted mt-2">
            Get a key:{' '}
            <a
              href={CONSOLE_URLS[active]}
              target="_blank"
              rel="noreferrer"
              className="text-oli-blue underline"
            >
              {CONSOLE_URLS[active]}
            </a>
          </p>
          {message && <p className="text-caption text-ink-secondary mt-2">{message}</p>}
        </>
      )}
    </div>
  );
}
