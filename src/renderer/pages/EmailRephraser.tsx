import { useEffect, useState } from 'react';
import { OliIcon } from '../components/brand/OliIcon';

type Tone =
  | 'professional'
  | 'friendly'
  | 'concise'
  | 'persuasive'
  | 'apologetic'
  | 'assertive'
  | 'neutral';

type Intent = 'rephrase' | 'reply' | 'shorten' | 'lengthen' | 'fix-grammar' | 'translate-en';

const TONES: { id: Tone; label: string; emoji: string }[] = [
  { id: 'professional', label: 'Professional', emoji: '💼' },
  { id: 'friendly', label: 'Friendly', emoji: '🙂' },
  { id: 'concise', label: 'Concise', emoji: '✂️' },
  { id: 'persuasive', label: 'Persuasive', emoji: '🎯' },
  { id: 'apologetic', label: 'Apologetic', emoji: '🙏' },
  { id: 'assertive', label: 'Assertive', emoji: '💪' },
  { id: 'neutral', label: 'Neutral', emoji: '◯' }
];

const INTENTS: { id: Intent; label: string; hint: string }[] = [
  { id: 'rephrase', label: 'Rephrase', hint: 'Same meaning, fresh phrasing' },
  { id: 'reply', label: 'Draft reply', hint: 'Reply to this email' },
  { id: 'shorten', label: 'Shorten', hint: 'Cut to roughly half' },
  { id: 'lengthen', label: 'Expand', hint: 'Add detail and context' },
  { id: 'fix-grammar', label: 'Fix grammar', hint: 'Polish only — no rewrite' },
  { id: 'translate-en', label: 'Translate → EN', hint: 'Natural English' }
];

interface Props {
  onHome: () => void;
  onOpenSettings: () => void;
}

export function EmailRephraser({ onHome, onOpenSettings }: Props) {
  const [original, setOriginal] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [intent, setIntent] = useState<Intent>('rephrase');
  const [contextNote, setContextNote] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>('');
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    void window.floyd.llm.getActiveProvider().then(setActiveProvider);
  }, []);

  const run = async () => {
    if (!original.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    setOutput('');
    setCopyOk(false);
    const res = await window.floyd.llm.rephraseEmail({
      originalText: original,
      tone,
      intent,
      contextNote: contextNote.trim() || undefined
    });
    if (res.ok && res.text) {
      setOutput(res.text);
    } else {
      setMessage(res.message ?? 'Something went wrong.');
    }
    setBusy(false);
  };

  const copy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopyOk(true);
    setTimeout(() => setCopyOk(false), 1500);
  };

  const swap = () => {
    if (!output) return;
    setOriginal(output);
    setOutput('');
  };

  const clear = () => {
    setOriginal('');
    setOutput('');
    setMessage(null);
    setContextNote('');
  };

  const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--oli-gradient-soft-bg)' }}>
      <header className="titlebar-drag h-14 flex items-center justify-between px-6 border-b border-line bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onHome}
            className="text-caption px-2 py-1.5 rounded-md text-ink-secondary hover:bg-surface-cloud"
            title="Back to home"
          >
            ← Home
          </button>
          <div className="flex items-center gap-2">
            <OliIcon size={22} />
            <span className="text-h4 font-display">Email rephraser</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-caption text-ink-muted">
            Provider: <span className="font-mono text-ink-secondary">{activeProvider || '…'}</span>
          </span>
          <button
            onClick={onOpenSettings}
            className="text-caption px-2 py-1.5 rounded-md text-ink-secondary hover:bg-surface-cloud"
          >
            Settings ⚙
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Controls */}
          <div className="rounded-card bg-white border border-line shadow-card p-5 mb-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div>
                <label className="text-caption uppercase tracking-wider text-ink-muted block mb-2">
                  Action
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {INTENTS.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => setIntent(it.id)}
                      title={it.hint}
                      className={`text-left px-2.5 py-1.5 rounded-md border text-body-sm transition ${
                        intent === it.id
                          ? 'border-oli-blue bg-oli-blue/5 font-medium'
                          : 'border-line bg-white hover:bg-surface-cloud'
                      }`}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-1">
                <label className="text-caption uppercase tracking-wider text-ink-muted block mb-2">
                  Tone
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTone(t.id)}
                      className={`px-2.5 py-1.5 rounded-md border text-body-sm transition ${
                        tone === t.id
                          ? 'border-oli-blue bg-oli-blue/5 font-medium'
                          : 'border-line bg-white hover:bg-surface-cloud'
                      }`}
                    >
                      <span className="mr-1">{t.emoji}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-caption uppercase tracking-wider text-ink-muted block mb-2">
                  Extra context (optional)
                </label>
                <input
                  value={contextNote}
                  onChange={(e) => setContextNote(e.target.value)}
                  placeholder="e.g. They're a long-time client, urgent timeline."
                  className="w-full px-3 py-2 rounded-md border border-line bg-white text-body-sm"
                />
                <p className="text-caption text-ink-muted mt-1">
                  Hint to steer tone or content. Not included verbatim.
                </p>
              </div>
            </div>
          </div>

          {/* Editors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel
              title="Original / draft"
              subtitle={`${wordCount(original)} words`}
              actions={
                <button
                  onClick={clear}
                  className="text-caption px-2 py-1 rounded-md text-ink-muted hover:bg-surface-cloud"
                  disabled={!original && !output}
                >
                  Clear
                </button>
              }
            >
              <textarea
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
                placeholder="Paste your email or draft here…"
                className="w-full h-[420px] resize-none p-4 rounded-md border border-line bg-white text-body font-sans focus:outline-none focus:ring-2 focus:ring-oli-blue/30"
              />
            </Panel>

            <Panel
              title="Rewritten"
              subtitle={output ? `${wordCount(output)} words` : busy ? 'Working…' : 'Idle'}
              actions={
                <div className="flex gap-1">
                  <button
                    onClick={swap}
                    disabled={!output}
                    className="text-caption px-2 py-1 rounded-md text-ink-muted hover:bg-surface-cloud disabled:opacity-40"
                    title="Move output to input for further edits"
                  >
                    Swap ↺
                  </button>
                  <button
                    onClick={copy}
                    disabled={!output}
                    className="text-caption px-2 py-1 rounded-md text-ink-secondary hover:bg-surface-cloud disabled:opacity-40"
                  >
                    {copyOk ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              }
            >
              <div className="relative">
                <textarea
                  value={output}
                  onChange={(e) => setOutput(e.target.value)}
                  placeholder={busy ? 'Generating…' : 'Output will appear here.'}
                  className="w-full h-[420px] resize-none p-4 rounded-md border border-line bg-white text-body font-sans focus:outline-none focus:ring-2 focus:ring-oli-violet/30"
                />
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-md pointer-events-none">
                    <div className="text-body-sm text-ink-secondary">Asking {activeProvider}…</div>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Run bar */}
          <div className="mt-4 flex items-center justify-between rounded-card bg-white border border-line shadow-card px-5 py-3">
            <div className="text-caption text-ink-muted">
              {message ? (
                <span className="text-oli-coral">{message}</span>
              ) : (
                <>
                  <kbd className="font-mono px-1.5 py-0.5 rounded bg-surface-cloud border border-line text-caption">
                    Ctrl+Enter
                  </kbd>{' '}
                  to rewrite
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setOutput('');
                  setMessage(null);
                }}
                disabled={!output && !message}
                className="text-btn px-3 py-2 rounded-button border border-line bg-white hover:bg-surface-cloud disabled:opacity-40"
              >
                Reset output
              </button>
              <button
                onClick={run}
                disabled={busy || !original.trim()}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void run();
                }}
                className="px-5 py-2 rounded-button text-btn text-white shadow-floating disabled:opacity-50"
                style={{ background: 'var(--oli-gradient-primary)' }}
              >
                {busy ? 'Rewriting…' : `Rewrite · ${tone}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Ctrl+Enter shortcut */}
      <KeyboardShortcut combo="ctrl+enter" onFire={run} />
    </div>
  );
}

function Panel({
  title,
  subtitle,
  actions,
  children
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card bg-white border border-line shadow-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-body-sm font-semibold">{title}</p>
          <p className="text-caption text-ink-muted">{subtitle}</p>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function KeyboardShortcut({ combo, onFire }: { combo: string; onFire: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (combo === 'ctrl+enter' && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onFire();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [combo, onFire]);
  return null;
}
