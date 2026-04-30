import { OliLogoStacked } from '../components/brand/OliLogoStacked';
import { OliIcon } from '../components/brand/OliIcon';

interface Props {
  onOpenMeeting: () => void;
  onOpenEmail: () => void;
  onOpenSettings: () => void;
  onOpenBrand: () => void;
}

export function Home({ onOpenMeeting, onOpenEmail, onOpenSettings, onOpenBrand }: Props) {
  return (
    <div
      className="h-screen w-full flex flex-col"
      style={{ background: 'var(--oli-gradient-soft-bg)' }}
    >
      <header className="titlebar-drag h-14 flex items-center justify-between px-6">
        <button
          onClick={onOpenBrand}
          className="rounded-md hover:bg-white/40 p-1 -m-1 transition flex items-center gap-2"
          title="Brand"
        >
          <OliIcon size={28} />
          <span className="text-h4 font-display">Oli</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="text-caption px-3 py-1.5 rounded-md text-ink-secondary hover:bg-white/60"
        >
          Settings ⚙
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <OliLogoStacked iconSize={72} wordmarkSize={36} />
        <h1 className="text-h2 font-display mt-6">What do you want to do?</h1>
        <p className="text-body text-ink-secondary mt-1 max-w-lg text-center">
          Oli is your AI sidekick — for meetings <em>and</em> email. Pick a tool to get started.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">
          <TabCard
            title="Meeting recorder"
            tagline="Record · transcribe · enhance"
            body="Capture any meeting locally. Whisper transcribes on-device, then Oli turns rough notes into clean summaries, decisions, and actions."
            cta="Start a meeting"
            gradient="var(--oli-gradient-primary)"
            onClick={onOpenMeeting}
          />
          <TabCard
            title="Email rephraser"
            tagline="Rewrite · reply · polish"
            body="Paste a draft. Pick a tone — professional, friendly, concise. Oli rewrites it cleanly, fixes grammar, or drafts a reply. Nothing leaves your machine without your AI key."
            cta="Open rephraser"
            gradient="var(--oli-gradient-memory)"
            onClick={onOpenEmail}
          />
        </div>

        <p className="text-caption text-ink-muted mt-8">
          Same brain, two tools. Switch any time from the sidebar.
        </p>
      </main>
    </div>
  );
}

function TabCard({
  title,
  tagline,
  body,
  cta,
  gradient,
  onClick
}: {
  title: string;
  tagline: string;
  body: string;
  cta: string;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-card bg-white border border-line shadow-card hover:shadow-floating transition overflow-hidden group"
    >
      <div className="h-2" style={{ background: gradient }} />
      <div className="p-6">
        <p className="text-caption uppercase tracking-wider text-ink-muted">{tagline}</p>
        <h2 className="text-h3 font-display mt-1">{title}</h2>
        <p className="text-body-sm text-ink-secondary mt-2 leading-relaxed">{body}</p>
        <span
          className="inline-block mt-5 px-4 py-2 rounded-button text-btn text-white"
          style={{ background: gradient }}
        >
          {cta} →
        </span>
      </div>
    </button>
  );
}
