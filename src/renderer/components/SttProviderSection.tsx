import { useEffect, useState } from 'react';

type Provider = 'local' | 'groq';

interface SttConfig {
  provider: Provider;
  groqModel: string;
  chunkSeconds: number;
  concurrency: number;
  groqKeyConfigured: boolean;
}

interface GroqModel {
  id: string;
  label: string;
  note: string;
}

export function SttProviderSection() {
  const [cfg, setCfg] = useState<SttConfig | null>(null);
  const [models, setModels] = useState<GroqModel[]>([]);
  const [pinging, setPinging] = useState(false);
  const [pingMessage, setPingMessage] = useState<string | null>(null);

  const refresh = async () => {
    const [c, m] = await Promise.all([
      window.floyd.stt.get(),
      window.floyd.stt.listGroqModels()
    ]);
    setCfg(c);
    setModels(m);
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (!cfg) {
    return (
      <div className="rounded-card border border-line bg-white p-6 shadow-card">
        <p className="text-caption text-ink-muted">Loading STT settings…</p>
      </div>
    );
  }

  const setProvider = async (p: Provider) => {
    await window.floyd.stt.setProvider(p);
    setPingMessage(null);
    await refresh();
  };

  const setGroqModel = async (m: string) => {
    await window.floyd.stt.setGroqModel(m);
    setPingMessage(null);
    await refresh();
  };

  const setChunkSecs = async (n: number) => {
    await window.floyd.stt.setChunkSeconds(n);
    await refresh();
  };

  const setConc = async (n: number) => {
    await window.floyd.stt.setConcurrency(n);
    await refresh();
  };

  const ping = async () => {
    setPinging(true);
    setPingMessage(null);
    const r = await window.floyd.stt.pingGroq(cfg.groqModel);
    setPingMessage(
      r.ok ? '✓ Groq STT is reachable and configured.' : `✗ ${r.message ?? 'Test failed.'}`
    );
    setPinging(false);
  };

  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card">
      <h3 className="text-h4 mb-1">Speech-to-text engine</h3>
      <p className="text-caption text-ink-muted mb-4">
        Choose how Oli transcribes audio. Local is private and offline. Groq is cloud — much faster, ~7%
        WER, free tier covers ~4 hours/day. Audio leaves your machine when Groq is selected.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <ProviderCard
          active={cfg.provider === 'local'}
          title="Local · whisper.cpp"
          tagline="Offline · private"
          body="Runs on your CPU. Slower (5–15s per chunk). Audio never leaves the machine."
          onClick={() => setProvider('local')}
        />
        <ProviderCard
          active={cfg.provider === 'groq'}
          title="Groq Cloud · Whisper-v3"
          tagline={cfg.groqKeyConfigured ? '✓ key configured · ready' : '⚠ needs Groq API key'}
          body="~10x realtime. ~7% WER. Free tier ~4 hrs/day. Audio uploaded to Groq."
          onClick={() => setProvider('groq')}
        />
      </div>

      {cfg.provider === 'groq' && (
        <>
          {!cfg.groqKeyConfigured && (
            <div className="rounded-md border border-oli-amber bg-oli-amber/10 px-3 py-2 mb-3">
              <p className="text-body-sm font-medium text-ink-primary">Groq API key required</p>
              <p className="text-caption text-ink-secondary mt-0.5">
                Add a Groq key in the AI provider section above (or at{' '}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-oli-blue underline"
                >
                  console.groq.com/keys
                </a>
                ). The same key powers both AI notes and cloud STT.
              </p>
            </div>
          )}

          <label className="text-caption uppercase tracking-wider text-ink-muted block mb-1">
            Groq model
          </label>
          <div className="space-y-1.5 mb-3">
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => setGroqModel(m.id)}
                className={`w-full text-left px-3 py-2 rounded-md border transition ${
                  cfg.groqModel === m.id
                    ? 'border-oli-blue bg-oli-blue/5'
                    : 'border-line bg-white hover:bg-surface-cloud'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-body-sm font-mono">{m.label}</span>
                  {cfg.groqModel === m.id && (
                    <span className="text-caption text-oli-blue">active</span>
                  )}
                </div>
                <p className="text-caption text-ink-muted mt-0.5">{m.note}</p>
              </button>
            ))}
          </div>

          <button
            onClick={ping}
            disabled={pinging || !cfg.groqKeyConfigured}
            className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud disabled:opacity-50"
          >
            {pinging ? 'Testing…' : 'Test connection'}
          </button>
          {pingMessage && (
            <p
              className={`text-caption mt-2 ${
                pingMessage.startsWith('✓') ? 'text-oli-teal' : 'text-oli-coral'
              }`}
            >
              {pingMessage}
            </p>
          )}
        </>
      )}

      {/* Latency tuning */}
      <div className="mt-5 pt-4 border-t border-line">
        <p className="text-caption uppercase tracking-wider text-ink-muted mb-2">
          Latency tuning
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-body-sm text-ink-secondary block mb-1">
              Chunk window: <span className="font-mono">{cfg.chunkSeconds}s</span>
            </label>
            <input
              type="range"
              min={1}
              max={15}
              value={cfg.chunkSeconds}
              onChange={(e) => setChunkSecs(parseInt(e.target.value, 10))}
              className="w-full"
            />
            <p className="text-caption text-ink-muted">
              Lower = faster captions, less context per chunk.
            </p>
          </div>
          <div>
            <label className="text-body-sm text-ink-secondary block mb-1">
              Parallel inflight: <span className="font-mono">{cfg.concurrency}</span>
            </label>
            <input
              type="range"
              min={1}
              max={cfg.provider === 'groq' ? 8 : 2}
              value={cfg.concurrency}
              onChange={(e) => setConc(parseInt(e.target.value, 10))}
              className="w-full"
            />
            <p className="text-caption text-ink-muted">
              {cfg.provider === 'groq'
                ? 'Cloud requests in parallel. 4 is a good default.'
                : 'Local CPU spawns. Keep at 1 unless you have many cores.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  active,
  title,
  tagline,
  body,
  onClick
}: {
  active: boolean;
  title: string;
  tagline: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-3 py-2 rounded-md border transition ${
        active ? 'border-oli-blue bg-oli-blue/5' : 'border-line bg-white hover:bg-surface-cloud'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-body-sm font-medium">{title}</span>
        {active && <span className="text-caption text-oli-blue">✓ active</span>}
      </div>
      <p className="text-caption text-ink-muted mt-0.5">{tagline}</p>
      <p className="text-caption text-ink-muted mt-1.5 leading-snug">{body}</p>
    </button>
  );
}
