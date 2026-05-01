import { useEffect, useState } from 'react';

/**
 * Settings card combining diarization + embeddings provider config.
 * Both reuse the same UI pattern as the existing AI provider section.
 */
export function AiSection() {
  const [diarProvider, setDiarProvider] = useState<'cloud-assemblyai' | 'local-pyannote'>(
    'cloud-assemblyai'
  );
  const [diarKeyConfigured, setDiarKeyConfigured] = useState(false);
  const [embedProvider, setEmbedProvider] = useState<'openai-small' | 'openai-large'>(
    'openai-small'
  );
  const [keyDraft, setKeyDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);

  const refresh = async () => {
    const [d, e] = await Promise.all([
      window.floyd.ai.diar.status(),
      window.floyd.ai.embed.status()
    ]);
    setDiarProvider(d.provider);
    setDiarKeyConfigured(d.keyConfigured);
    setEmbedProvider(e.provider);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const saveKey = async () => {
    if (!keyDraft.trim()) return;
    setBusy(true);
    setMessage(null);
    await window.floyd.ai.diar.setKey(keyDraft.trim());
    setKeyDraft('');
    await refresh();
    setMessage('AssemblyAI key saved.');
    setBusy(false);
  };

  const removeKey = async () => {
    await window.floyd.ai.diar.setKey(null);
    await refresh();
    setMessage('Key removed.');
  };

  const reindex = async () => {
    setReindexing(true);
    setMessage(null);
    const r = await window.floyd.ai.embed.reindexAll();
    if (r.message) setMessage(`Reindex error: ${r.message}`);
    else setMessage(`Indexed ${r.chunks} chunks across ${r.meetings} meetings.`);
    setReindexing(false);
  };

  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card">
      <h3 className="text-h4 mb-1">AI intelligence</h3>
      <p className="text-caption text-ink-muted mb-4">
        Speaker diarization, action-item extraction, embeddings for the Ask view. All optional.
      </p>

      {/* Diarization */}
      <p className="text-caption uppercase tracking-wider text-ink-muted">Diarization</p>
      <div className="grid grid-cols-2 gap-2 mt-2 mb-3">
        <button
          onClick={async () => {
            await window.floyd.ai.diar.setProvider('cloud-assemblyai');
            await refresh();
          }}
          className={`text-left px-3 py-2 rounded-md border ${
            diarProvider === 'cloud-assemblyai'
              ? 'border-oli-blue bg-oli-blue/5'
              : 'border-line bg-white hover:bg-surface-cloud'
          }`}
        >
          <p className="text-body-sm font-medium">AssemblyAI cloud</p>
          <p className="text-caption text-ink-muted mt-0.5">
            ~$0.012/min audio. Sends recorded WAV to AssemblyAI.
          </p>
        </button>
        <button
          onClick={async () => {
            await window.floyd.ai.diar.setProvider('local-pyannote');
            await refresh();
          }}
          className={`text-left px-3 py-2 rounded-md border ${
            diarProvider === 'local-pyannote'
              ? 'border-oli-blue bg-oli-blue/5'
              : 'border-line bg-white hover:bg-surface-cloud'
          }`}
        >
          <p className="text-body-sm font-medium">Local pyannote</p>
          <p className="text-caption text-ink-muted mt-0.5">
            Coming Phase 4. Currently throws not-implemented.
          </p>
        </button>
      </div>

      {diarProvider === 'cloud-assemblyai' && (
        <>
          {diarKeyConfigured ? (
            <div className="flex items-center justify-between rounded-md border border-line bg-white px-3 py-2 mb-3">
              <p className="text-body-sm">AssemblyAI key configured.</p>
              <button
                onClick={removeKey}
                className="text-btn px-3 py-1.5 rounded-button border border-line hover:bg-surface-cloud"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mb-3">
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="AssemblyAI API key"
                className="flex-1 px-3 py-2 rounded-md border border-line bg-white text-body-sm font-mono"
              />
              <button
                disabled={busy || !keyDraft.trim()}
                onClick={saveKey}
                className="px-4 py-2 rounded-button text-btn text-white disabled:opacity-50"
                style={{ background: 'var(--oli-gradient-primary)' }}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Embeddings */}
      <p className="text-caption uppercase tracking-wider text-ink-muted mt-4">
        Embeddings (Ask my meetings)
      </p>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          onClick={async () => {
            await window.floyd.ai.embed.setProvider('openai-small');
            await refresh();
          }}
          className={`text-left px-3 py-2 rounded-md border ${
            embedProvider === 'openai-small'
              ? 'border-oli-blue bg-oli-blue/5'
              : 'border-line bg-white hover:bg-surface-cloud'
          }`}
        >
          <p className="text-body-sm font-medium">text-embedding-3-small</p>
          <p className="text-caption text-ink-muted mt-0.5">1536 dims · cheap default</p>
        </button>
        <button
          onClick={async () => {
            await window.floyd.ai.embed.setProvider('openai-large');
            await refresh();
          }}
          className={`text-left px-3 py-2 rounded-md border ${
            embedProvider === 'openai-large'
              ? 'border-oli-blue bg-oli-blue/5'
              : 'border-line bg-white hover:bg-surface-cloud'
          }`}
        >
          <p className="text-body-sm font-medium">text-embedding-3-large</p>
          <p className="text-caption text-ink-muted mt-0.5">3072 dims · best recall</p>
        </button>
      </div>
      <p className="text-caption text-ink-muted mt-2">
        Reuses your OpenAI key. Run a re-index after adding meetings to populate the search store.
      </p>
      <button
        onClick={reindex}
        disabled={reindexing}
        className="mt-3 text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud disabled:opacity-50"
      >
        {reindexing ? 'Re-indexing…' : 'Re-index all meetings'}
      </button>

      {message && <p className="text-caption text-ink-secondary mt-3">{message}</p>}
    </div>
  );
}
