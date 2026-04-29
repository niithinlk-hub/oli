import { useEffect, useState } from 'react';
import { OliLogoStacked } from '../components/brand/OliLogoStacked';
import { OliIcon } from '../components/brand/OliIcon';

const STEPS = ['welcome', 'whisper', 'openai', 'calendar', 'done'] as const;
type Step = (typeof STEPS)[number];

interface Props {
  onClose: () => void;
}

const ONBOARDED_KEY = 'oli.onboarded';

export function Onboarding({ onClose }: Props) {
  const [step, setStep] = useState<Step>('welcome');

  const next = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
    else finish();
  };
  const back = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };
  const finish = () => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(7, 26, 51, 0.6)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="rounded-card bg-white shadow-floating w-[640px] max-w-[92vw] overflow-hidden"
        style={{ boxShadow: 'var(--oli-shadow-floating)' }}
      >
        <div className="flex">
          <Sidebar step={step} />
          <div className="flex-1 p-8 min-h-[460px] flex flex-col">
            <div className="flex-1">
              {step === 'welcome' && <Welcome />}
              {step === 'whisper' && <WhisperStep />}
              {step === 'openai' && <OpenAiStep />}
              {step === 'calendar' && <CalendarStep />}
              {step === 'done' && <DoneStep />}
            </div>
            <Footer step={step} onBack={back} onNext={next} onSkip={finish} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function shouldShowOnboarding(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) !== '1';
}

function Sidebar({ step }: { step: Step }) {
  return (
    <aside
      className="w-44 p-6 text-white"
      style={{ background: 'var(--oli-gradient-memory)' }}
    >
      <OliIcon size={36} />
      <p className="mt-4 text-h4 font-display leading-tight">Welcome to Oli</p>
      <p className="text-caption opacity-80 mt-1">Setup · 4 steps</p>
      <ol className="mt-6 space-y-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`flex items-center gap-2 text-caption ${
              s === step ? 'opacity-100 font-semibold' : 'opacity-65'
            }`}
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                STEPS.indexOf(step) > i
                  ? 'bg-white text-oli-violet'
                  : s === step
                    ? 'bg-white/30 ring-2 ring-white'
                    : 'bg-white/15'
              }`}
            >
              {STEPS.indexOf(step) > i ? '✓' : i + 1}
            </span>
            <span className="capitalize">{s === 'openai' ? 'OpenAI' : s}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function Welcome() {
  return (
    <div className="text-center pt-6">
      <OliLogoStacked iconSize={64} wordmarkSize={32} />
      <h2 className="text-h2 font-display mt-6">Your AI meeting memory.</h2>
      <p className="text-body text-ink-secondary mt-2 max-w-md mx-auto">
        Oli listens, captures, and turns conversations into clear notes, decisions, and action items —
        all on your device.
      </p>
      <p className="text-caption text-ink-muted mt-6">
        Three quick configs and you're ready. Skip any step — you can finish later in Settings.
      </p>
    </div>
  );
}

function WhisperStep() {
  const [bin, setBin] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    void window.floyd.settings.get().then((s) => {
      setBin(s.whisperBinaryPath);
      setModel(s.whisperModelPath);
    });
  }, []);

  const pickBin = async () => {
    const p = await window.floyd.settings.pickFile({
      title: 'Select whisper.cpp binary (whisper-cli.exe)',
      filters: [{ name: 'Executable', extensions: ['exe'] }]
    });
    if (p) {
      await window.floyd.settings.setWhisperBinary(p);
      setBin(p);
    }
  };
  const pickModel = async () => {
    const p = await window.floyd.settings.pickFile({
      title: 'Select ggml whisper model (.bin)',
      filters: [{ name: 'GGML model', extensions: ['bin'] }]
    });
    if (p) {
      await window.floyd.settings.setWhisperModel(p);
      setModel(p);
    }
  };

  return (
    <div>
      <h3 className="text-h3 font-display">Local transcription</h3>
      <p className="text-body-sm text-ink-secondary mt-1">
        Oli uses whisper.cpp on your machine — your audio never leaves the device.
      </p>
      <ol className="mt-4 space-y-3 text-body-sm">
        <li>
          <strong>1. Download a Windows whisper.cpp release</strong>
          <p className="text-caption text-ink-muted mt-1">
            <span className="font-mono">github.com/ggerganov/whisper.cpp/releases</span> — pick the latest
            <span className="font-mono"> whisper-bin-x64</span> archive and extract it.
          </p>
        </li>
        <li>
          <strong>2. Download a model</strong>
          <p className="text-caption text-ink-muted mt-1">
            <span className="font-mono">huggingface.co/ggerganov/whisper.cpp</span> — recommended:
            <span className="font-mono"> ggml-medium.bin</span> (~1.5 GB).
          </p>
        </li>
      </ol>

      <div className="mt-5 space-y-3">
        <PickerRow label="whisper-cli.exe" value={bin} onPick={pickBin} />
        <PickerRow label="ggml-*.bin" value={model} onPick={pickModel} />
      </div>
    </div>
  );
}

function OpenAiStep() {
  const [hasKey, setHasKey] = useState(false);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void window.floyd.settings.hasOpenAiKey().then(setHasKey);
  }, []);

  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    const r = await window.floyd.settings.setOpenAiKey(draft.trim());
    setMsg(r.message);
    if (r.ok) setHasKey(true);
    setSaving(false);
    setDraft('');
  };

  return (
    <div>
      <h3 className="text-h3 font-display">Ask Oli</h3>
      <p className="text-body-sm text-ink-secondary mt-1">
        GPT-4o turns rough notes plus the transcript into structured summaries, action items, and decisions.
      </p>
      <p className="text-caption text-ink-muted mt-3">
        Get a key at <span className="font-mono">platform.openai.com/api-keys</span>. Stored encrypted via
        Windows DPAPI — never written in plain text.
      </p>

      {hasKey ? (
        <div className="mt-5 rounded-md border border-line bg-surface-cloud px-4 py-3 text-body-sm flex items-center gap-2">
          <span className="text-oli-teal">✓</span> API key saved.
        </div>
      ) : (
        <div className="mt-5 flex gap-2">
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="sk-…"
            className="flex-1 px-3 py-2 rounded-md border border-line bg-white text-body-sm font-mono"
          />
          <button
            disabled={saving || !draft.trim()}
            onClick={save}
            className="px-4 py-2 rounded-button text-btn text-white disabled:opacity-50"
            style={{ background: 'var(--oli-gradient-primary)' }}
          >
            {saving ? 'Validating…' : 'Save'}
          </button>
        </div>
      )}
      {msg && <p className="text-caption text-ink-secondary mt-2">{msg}</p>}
    </div>
  );
}

function CalendarStep() {
  return (
    <div>
      <h3 className="text-h3 font-display">Auto-detect meetings</h3>
      <p className="text-body-sm text-ink-secondary mt-1">
        Connect your calendar so Oli can notify you 2 minutes before each meeting and link recordings to
        events. Optional — skip and configure later.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Card title="Google" body="OAuth via Calendar API. Open Settings → Google Calendar." />
        <Card title="Outlook" body="Microsoft Graph + PKCE. Open Settings → Microsoft Outlook." />
        <Card title=".ics" body="One-shot import for any iCalendar file. Open Settings → ICS." />
      </div>

      <p className="text-caption text-ink-muted mt-4">
        Each provider needs an OAuth client ID — both flows live in Settings. Skip for now if you'd rather
        configure later.
      </p>
    </div>
  );
}

function DoneStep() {
  return (
    <div className="text-center pt-8">
      <OliIcon size={88} />
      <h2 className="text-h2 font-display mt-4">You're set.</h2>
      <p className="text-body text-ink-secondary mt-2 max-w-md mx-auto">
        Hit <span className="font-medium text-ink-primary">+ New meeting</span> on the left, click Record,
        and Oli will start listening. Ask Oli to enhance your notes any time.
      </p>
    </div>
  );
}

function PickerRow({
  label,
  value,
  onPick
}: {
  label: string;
  value: string | null;
  onPick: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 px-3 py-2 rounded-md bg-surface-cloud border border-line text-caption font-mono truncate">
        {value || <span className="text-ink-muted">{label}</span>}
      </div>
      <button
        onClick={onPick}
        className="px-3 py-2 rounded-button border border-line bg-white hover:bg-surface-cloud text-btn"
      >
        Browse…
      </button>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-line p-3 bg-white">
      <p className="text-body-sm font-semibold">{title}</p>
      <p className="text-caption text-ink-muted mt-1">{body}</p>
    </div>
  );
}

function Footer({
  step,
  onBack,
  onNext,
  onSkip
}: {
  step: Step;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const isFirst = step === 'welcome';
  const isLast = step === 'done';
  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-line">
      <button
        onClick={onSkip}
        className="text-caption text-ink-muted hover:text-ink-secondary"
      >
        Skip setup
      </button>
      <div className="flex items-center gap-2">
        {!isFirst && (
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-button border border-line bg-white text-btn hover:bg-surface-cloud"
          >
            Back
          </button>
        )}
        <button
          onClick={onNext}
          className="px-4 py-2 rounded-button text-btn text-white"
          style={{ background: 'var(--oli-gradient-primary)' }}
        >
          {isLast ? 'Start using Oli' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
