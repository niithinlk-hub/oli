import { useState } from 'react';
import { OliLogoStacked } from '../components/brand/OliLogoStacked';
import { OliIcon } from '../components/brand/OliIcon';
import { AiProviderSection } from '../components/AiProviderSection';
import { WhisperModelSection } from '../components/WhisperModelSection';

const STEPS = ['welcome', 'model', 'ai', 'calendar', 'done'] as const;
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
              {step === 'model' && <ModelDownloadStep />}
              {step === 'ai' && <AiProviderStep />}
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
            <span className="capitalize">
              {s === 'ai' ? 'AI provider' : s === 'model' ? 'Speech model' : s}
            </span>
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
        Three quick configs and you&rsquo;re ready. Skip any step — you can finish later in Settings.
      </p>
    </div>
  );
}

function ModelDownloadStep() {
  return (
    <div>
      <h3 className="text-h3 font-display">Speech model</h3>
      <p className="text-body-sm text-ink-secondary mt-1">
        Oli transcribes locally with whisper.cpp. Pick a model size — bigger = more accurate, slower. You can swap any time in Settings.
      </p>
      <p className="text-caption text-ink-muted mt-3">
        Audio never leaves your machine. Skip and pick later if you&rsquo;d rather.
      </p>
      <div className="mt-4">
        <WhisperModelSection />
      </div>
    </div>
  );
}

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
