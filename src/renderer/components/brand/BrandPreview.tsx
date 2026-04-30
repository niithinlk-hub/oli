import { OliIcon } from './OliIcon';
import { OliLogoHorizontal } from './OliLogoHorizontal';
import { OliLogoStacked } from './OliLogoStacked';
import { OliLogoMono } from './OliLogoMono';
import { OliFavicon } from './OliFavicon';
import { AppIconPreview } from './AppIconPreview';

const PALETTE = [
  ['Deep Navy', '#071A33', 'primary text · dark surfaces'],
  ['Trust Blue', '#2563EB', 'CTAs · primary actions'],
  ['Azure Blue', '#38BDF8', 'highlights · sound waves'],
  ['Teal Glow', '#14B8A6', 'clarity · success'],
  ['Intelligent Violet', '#7C3AED', 'AI · memory layer'],
  ['Insight Amber', '#F59E0B', 'spark · warm highlights'],
  ['Soft Coral', '#FB7185', 'attention · sparingly']
];

const NEUTRALS = [
  ['Text Primary', '#0F172A'],
  ['Text Secondary', '#475569'],
  ['Text Muted', '#94A3B8'],
  ['Border', '#E2E8F0'],
  ['Surface', '#FFFFFF'],
  ['Cloud', '#F8FAFC'],
  ['Ice Blue', '#EFF6FF'],
  ['Soft Violet', '#F5F3FF'],
  ['Soft Teal', '#F0FDFA'],
  ['Amber Soft', '#FFFBEB']
];

const GRADIENTS: { name: string; bg: string }[] = [
  { name: 'Primary', bg: 'linear-gradient(135deg, #2563EB 0%, #38BDF8 45%, #14B8A6 100%)' },
  { name: 'AI Memory', bg: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 55%, #FB7185 100%)' },
  { name: 'Insight', bg: 'linear-gradient(135deg, #38BDF8 0%, #7C3AED 60%, #F59E0B 100%)' },
  { name: 'App Icon', bg: 'linear-gradient(135deg, #2563EB 0%, #38BDF8 35%, #7C3AED 75%, #F59E0B 100%)' },
  { name: 'Dark Premium', bg: 'linear-gradient(135deg, #020617 0%, #071A33 45%, #1E1B4B 100%)' },
  { name: 'Soft Background', bg: 'linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 45%, #F5F3FF 100%)' }
];

export function BrandPreview() {
  return (
    <div className="space-y-12 max-w-5xl">
      <Logos />
      <AppIcons />
      <Colors />
      <Gradients />
      <Typography />
      <UiExamples />
      <DarkPreview />
    </div>
  );
}

function Section({
  title,
  caption,
  children
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-h3 mb-1">{title}</h3>
      {caption && <p className="text-body-sm text-ink-secondary mb-4">{caption}</p>}
      {children}
    </section>
  );
}

function Logos() {
  return (
    <Section title="Logo system" caption="Use horizontal in headers, stacked on splash, mono on print and ultra-small.">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <Tag>Horizontal · navy</Tag>
          <OliLogoHorizontal />
        </Card>
        <Card>
          <Tag>Horizontal · white on dark</Tag>
          <div className="rounded-lg p-4" style={{ background: 'var(--oli-gradient-dark-premium)' }}>
            <OliLogoHorizontal tone="white" />
          </div>
        </Card>
        <Card>
          <Tag>Icon · 64</Tag>
          <OliIcon size={64} />
        </Card>
        <Card>
          <Tag>Stacked</Tag>
          <OliLogoStacked iconSize={72} wordmarkSize={32} />
        </Card>
        <Card>
          <Tag>Mono · navy</Tag>
          <OliLogoMono color="navy" size={56} />
        </Card>
        <Card>
          <Tag>Mono · white</Tag>
          <div className="rounded-lg p-4 bg-oli-navy">
            <OliLogoMono color="white" size={56} />
          </div>
        </Card>
        <Card>
          <Tag>Favicon · 32</Tag>
          <div className="flex items-center gap-3">
            <OliFavicon size={16} />
            <OliFavicon size={32} />
            <OliFavicon size={64} />
          </div>
        </Card>
        <Card>
          <Tag>Icon scale</Tag>
          <div className="flex items-end gap-3">
            <OliIcon size={16} />
            <OliIcon size={32} />
            <OliIcon size={64} />
            <OliIcon size={96} />
          </div>
        </Card>
      </div>
    </Section>
  );
}

function AppIcons() {
  return (
    <Section title="App icon" caption="Rounded-square, 28% radius. Use gradient in marketing, mono for fallback.">
      <div className="flex flex-wrap gap-6 items-end">
        <div className="text-center">
          <AppIconPreview size={128} variant="gradient" />
          <p className="text-caption text-ink-muted mt-2">Gradient</p>
        </div>
        <div className="text-center">
          <AppIconPreview size={128} variant="light" />
          <p className="text-caption text-ink-muted mt-2">Light</p>
        </div>
        <div className="text-center">
          <AppIconPreview size={128} variant="dark" />
          <p className="text-caption text-ink-muted mt-2">Dark</p>
        </div>
        <div className="text-center">
          <AppIconPreview size={128} variant="mono" />
          <p className="text-caption text-ink-muted mt-2">Mono</p>
        </div>
      </div>
    </Section>
  );
}

function Colors() {
  return (
    <Section title="Color palette" caption="Blue is base. Teal = clarity, violet = AI, amber = insight (sparingly).">
      <div>
        <h4 className="text-h4 mb-3">Brand</h4>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {PALETTE.map(([name, hex, usage]) => (
            <Swatch key={hex} name={name} hex={hex} caption={usage} />
          ))}
        </div>
        <h4 className="text-h4 mb-3">Neutral</h4>
        <div className="grid grid-cols-5 gap-3">
          {NEUTRALS.map(([name, hex]) => (
            <Swatch key={hex} name={name} hex={hex} compact />
          ))}
        </div>
      </div>
    </Section>
  );
}

function Gradients() {
  return (
    <Section title="Gradients" caption="Use sparingly — gradient surfaces should signal hero, AI, or insight moments.">
      <div className="grid grid-cols-3 gap-3">
        {GRADIENTS.map((g) => (
          <div key={g.name} className="rounded-lg overflow-hidden border border-line">
            <div className="h-24" style={{ background: g.bg }} />
            <div className="p-3 bg-white">
              <p className="text-body-sm font-medium">{g.name}</p>
              <code className="text-caption text-ink-muted truncate block">{g.bg}</code>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Typography() {
  return (
    <Section title="Typography" caption="Inter for UI · Inter Tight for display · IBM Plex Mono for transcript metadata.">
      <div className="space-y-4">
        <Type label="Display XL · 56/64 · 750">
          <p className="text-display-xl font-display">Meet Oli</p>
        </Type>
        <Type label="Display LG · 44/52 · 725">
          <p className="text-display-lg font-display">Your AI meeting memory.</p>
        </Type>
        <Type label="H1 · 36/44 · 700">
          <p className="text-h1 font-display">From conversations to clarity</p>
        </Type>
        <Type label="H2 · 30/38 · 675">
          <p className="text-h2">Notes that remember what matters</p>
        </Type>
        <Type label="H3 · 24/32 · 650">
          <p className="text-h3">Recent meetings</p>
        </Type>
        <Type label="Body · 16/26">
          <p className="text-body">
            Oli listens, captures, and turns conversations into clear notes, decisions, and action items.
          </p>
        </Type>
        <Type label="Caption · 12/18 · 500">
          <p className="text-caption text-ink-muted">2 min ago · 12 segments</p>
        </Type>
        <Type label="Transcript snippet · IBM Plex Mono">
          <p className="font-mono text-body-sm text-ink-secondary">
            <span className="text-ink-muted mr-2">00:42</span>
            And the next step is to confirm scope with finance by Thursday.
          </p>
        </Type>
      </div>
    </Section>
  );
}

function UiExamples() {
  return (
    <Section title="UI in use" caption="A handful of canonical Oli surfaces.">
      <div className="grid grid-cols-2 gap-4">
        <HeroCard />
        <LoginCard />
        <SummaryCard />
        <ActionItemsCard />
        <SearchBar />
        <ListeningPill />
      </div>
    </Section>
  );
}

function DarkPreview() {
  return (
    <Section title="Dark mode" caption="Glow only on AI surfaces. Borders soften, type stays crisp.">
      <div className="dark rounded-card p-6" style={{ background: 'var(--oli-gradient-dark-premium)' }}>
        <div className="flex items-center justify-between mb-4">
          <OliLogoHorizontal tone="white" />
          <span className="text-caption text-dark-textMuted">Dark · brand-true</span>
        </div>
        <div className="rounded-lg p-4 bg-dark-surface border border-dark-border">
          <p className="text-h4 text-dark-text mb-2">AI summary</p>
          <p className="text-body-sm text-dark-textSecondary">
            The team aligned on the Q2 launch scope and assigned ownership for marketing, ops, and pricing.
          </p>
          <button
            className="mt-3 px-4 py-2 rounded-button text-btn text-white"
            style={{ background: 'var(--oli-gradient-memory)', boxShadow: 'var(--oli-shadow-floating)' }}
          >
            Ask Oli
          </button>
        </div>
      </div>
    </Section>
  );
}

/* — small reusable previews — */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-white p-5 shadow-card flex flex-col gap-3">
      {children}
    </div>
  );
}
function Tag({ children }: { children: React.ReactNode }) {
  return <span className="text-caption text-ink-muted uppercase tracking-wider">{children}</span>;
}
function Swatch({
  name,
  hex,
  caption,
  compact
}: {
  name: string;
  hex: string;
  caption?: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-line overflow-hidden">
      <div className={compact ? 'h-12' : 'h-20'} style={{ background: hex }} />
      <div className="px-3 py-2 bg-white">
        <p className="text-body-sm font-medium">{name}</p>
        <code className="text-caption text-ink-muted">{hex}</code>
        {caption && <p className="text-caption text-ink-muted mt-1">{caption}</p>}
      </div>
    </div>
  );
}
function Type({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-6 items-baseline border-b border-line pb-3">
      <span className="text-caption text-ink-muted w-44 shrink-0 uppercase tracking-wider">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
function HeroCard() {
  return (
    <div
      className="rounded-card p-6 text-white shadow-floating"
      style={{ background: 'var(--oli-gradient-memory)' }}
    >
      <p className="text-caption opacity-80 mb-2">Landing hero</p>
      <h2 className="text-h2 font-display mb-2">Meet Oli, your AI meeting memory.</h2>
      <p className="text-body-sm opacity-90 mb-4">
        Oli listens, captures, and turns conversations into clear notes, decisions, and action items.
      </p>
      <div className="flex gap-2">
        <button className="px-4 py-2 rounded-button bg-white text-oli-navy text-btn">
          Start taking smarter notes
        </button>
        <button className="px-4 py-2 rounded-button bg-white/10 text-white text-btn border border-white/20">
          View demo
        </button>
      </div>
    </div>
  );
}
function LoginCard() {
  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card">
      <p className="text-caption text-ink-muted mb-2">Login</p>
      <h3 className="text-h3 mb-1">Welcome back</h3>
      <p className="text-body-sm text-ink-secondary mb-4">Sign in to your meeting memory.</p>
      <input
        readOnly
        value="hello@oli.ai"
        className="w-full px-3 py-2 rounded-md border border-line bg-surface-cloud text-body-sm mb-2"
      />
      <button
        className="w-full px-4 py-2 rounded-button text-btn text-white"
        style={{ background: 'var(--oli-gradient-primary)' }}
      >
        Continue
      </button>
    </div>
  );
}
function SummaryCard() {
  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex h-7 w-7 rounded-md items-center justify-center text-white"
          style={{ background: 'var(--oli-gradient-memory)' }}
        >
          ✦
        </span>
        <p className="text-caption uppercase tracking-wider text-ink-muted">AI summary</p>
      </div>
      <h3 className="text-h4 mb-2">Q2 launch sync</h3>
      <ul className="text-body-sm text-ink-secondary space-y-1 list-disc pl-5">
        <li>Pricing locked at $19/mo with annual discount.</li>
        <li>Marketing landing live by May 10.</li>
        <li>Onboarding checklist owned by Sam.</li>
      </ul>
    </div>
  );
}
function ActionItemsCard() {
  return (
    <div className="rounded-card border border-line bg-surface-amberSoft p-6">
      <p className="text-caption uppercase tracking-wider text-ink-muted mb-2">Action items</p>
      <ul className="text-body-sm space-y-2">
        <li className="flex gap-2"><span className="h-1.5 w-1.5 rounded-full bg-oli-amber mt-2 shrink-0" /> Confirm scope with finance — Thursday</li>
        <li className="flex gap-2"><span className="h-1.5 w-1.5 rounded-full bg-oli-amber mt-2 shrink-0" /> Send pricing one-pager — Sam</li>
        <li className="flex gap-2"><span className="h-1.5 w-1.5 rounded-full bg-oli-amber mt-2 shrink-0" /> Book customer interviews — Maya</li>
      </ul>
    </div>
  );
}
function SearchBar() {
  return (
    <div className="rounded-card border border-line bg-white p-3 shadow-card flex items-center gap-3">
      <span
        className="h-8 w-8 rounded-md flex items-center justify-center text-white"
        style={{ background: 'var(--oli-gradient-insight)' }}
      >
        🔍
      </span>
      <input
        readOnly
        value="Search your meeting memory…"
        className="flex-1 bg-transparent outline-none text-body-sm placeholder:text-ink-muted"
      />
      <span className="text-caption text-ink-muted">⌘K</span>
    </div>
  );
}
function ListeningPill() {
  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card flex items-center gap-3">
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-oli-blue/10 text-oli-blue text-caption font-medium">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-oli-blue opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-oli-blue" />
        </span>
        Oli is listening
      </span>
      <span className="text-caption text-ink-muted">04:12 · system + mic</span>
    </div>
  );
}
