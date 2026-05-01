import { useEffect, useRef, useState } from 'react';
import { OliLogoStacked } from '../components/brand/OliLogoStacked';
import { OliIcon } from '../components/brand/OliIcon';
import { AiProviderSection } from '../components/AiProviderSection';
import { SttProviderSection } from '../components/SttProviderSection';

const STEPS = ['welcome', 'mic', 'ai', 'stt', 'calendar', 'done'] as const;
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
            <div className="flex-1 overflow-y-auto pr-1">
              {step === 'welcome' && <Welcome onQuickStart={() => setStep('mic')} />}
              {step === 'mic' && <MicStep />}
              {step === 'ai' && <AiProviderStep />}
              {step === 'stt' && <SttStep />}
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
      <p className="text-caption opacity-80 mt-1">Setup · {STEPS.length - 1} steps</p>
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
            <span className="capitalize">
              {s === 'ai'
                ? 'AI provider'
                : s === 'stt'
                  ? 'Transcription'
                  : s === 'mic'
                    ? 'Microphone'
                    : s}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function Welcome({ onQuickStart }: { onQuickStart: () => void }) {
  return (
    <div className="text-center pt-6">
      <OliLogoStacked iconSize={64} wordmarkSize={32} />
      <h2 className="text-h2 font-display mt-6">Your AI meeting memory.</h2>
      <p className="text-body text-ink-secondary mt-2 max-w-md mx-auto">
        Oli listens, captures, and turns conversations into clear notes, decisions, and action items —
        all on your device.
      </p>
      <div className="flex justify-center gap-2 mt-6">
        <button
          onClick={onQuickStart}
          className="px-5 py-2.5 rounded-button text-btn text-white shadow-floating"
          style={{ background: 'var(--oli-gradient-primary)' }}
        >
          Quick start (90s)
        </button>
        <button
          onClick={onQuickStart}
          className="px-5 py-2.5 rounded-button text-btn border border-line bg-white hover:bg-surface-cloud"
        >
          Full setup
        </button>
      </div>
      <p className="text-caption text-ink-muted mt-4">
        Both flow through the same steps. Quick start lets you skip optional bits.
      </p>
    </div>
  );
}

function MicStep() {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const request = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      streamRef.current = stream;
      setGranted(true);
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.min(1, Math.sqrt(sum / data.length) * 4);
        setLevel(rms);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      setGranted(false);
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void request();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void ctxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h3 className="text-h3 font-display">Microphone</h3>
      <p className="text-body-sm text-ink-secondary mt-1">
        Grant mic access and check the level meter — speak now to confirm input is reaching Oli.
      </p>
      <div className="mt-6 rounded-card border border-line bg-white p-6">
        {granted === false ? (
          <div className="text-center">
            <p className="text-body-sm text-oli-coral">Mic access denied.</p>
            <p className="text-caption text-ink-muted mt-1">{error}</p>
            <button
              onClick={request}
              className="mt-3 text-btn px-3 py-1.5 rounded-button border border-line hover:bg-surface-cloud"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <p className="text-caption uppercase tracking-wider text-ink-muted">
              Live mic level
            </p>
            <div className="h-3 mt-2 rounded-full bg-surface-cloud overflow-hidden">
              <div
                className="h-full transition-[width] duration-75"
                style={{
                  width: `${Math.min(100, level * 100)}%`,
                  background:
                    level > 0.85
                      ? 'var(--oli-coral, #ff6b6b)'
                      : level > 0.5
                        ? 'var(--oli-amber, #f4b400)'
                        : 'var(--oli-teal, #14b8a6)'
                }}
              />
            </div>
            <p className="text-caption text-ink-muted mt-2">
              {granted == null
                ? 'Requesting access…'
                : level < 0.02
                  ? 'No signal yet — speak into the mic.'
                  : 'Looking good.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SttStep() {
  return (
    <div>
      <h3 className="text-h3 font-display">Transcription engine</h3>
      <p className="text-body-sm text-ink-secondary mt-1">
        Pick how Oli turns audio into text. <span className="font-medium text-ink-primary">Groq Cloud</span>{' '}
        is fast (~10x realtime, ~7% WER, free tier). <span className="font-medium text-ink-primary">Local</span>{' '}
        whisper.cpp is private and offline.
      </p>
      <p className="text-caption text-ink-muted mt-3">
        Switch any time in Settings. Recommended: Groq if you have an API key.
      </p>
      <div className="mt-4">
        <SttProviderSection />
      </div>
    </div>
  );
}

// ModelDownloadStep removed in 1.4.0. Local model download is opt-in from
// Settings → Whisper models. Quick-start path defaults to Groq Cloud STT.

function AiProviderStep() {
  return (
    <div>
      <h3 className="text-h3 font-display">AI provider</h3>
      <p className="text-body-sm text-ink-secondary mt-1">
        Powers note enhancement and Ask Oli. Pick whichever you have a key for — OpenAI, Anthropic, Google, or Groq. All keys encrypted via Windows DPAPI.
      </p>
      <div className="mt-4">
        <AiProviderSection />
      </div>
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
        Each provider needs an OAuth client ID — both flows live in Settings. Skip for now if you&rsquo;d rather
        configure later.
      </p>
    </div>
  );
}

function DoneStep() {
  return (
    <div className="text-center pt-8">
      <OliIcon size={88} />
      <h2 className="text-h2 font-display mt-4">You&rsquo;re set.</h2>
      <p className="text-body text-ink-secondary mt-2 max-w-md mx-auto">
        Two tools, one Oli. Pick <span className="font-medium text-ink-primary">Meeting recorder</span> to
        capture and transcribe, or <span className="font-medium text-ink-primary">Email rephraser</span> to
        rewrite drafts. Switch any time from the sidebar.
      </p>
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
