import { useState } from 'react';
import { BrandPreview } from '../components/brand/BrandPreview';
import { BrandGuidelines } from '../components/brand/BrandGuidelines';

type Tab = 'preview' | 'guidelines';

export function Brand({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('preview');
  return (
    <section className="flex-1 flex flex-col">
      <header className="titlebar-drag h-14 flex items-center justify-between px-6 border-b border-line bg-white">
        <div className="flex items-center gap-4">
          <h2 className="text-h4">Brand</h2>
          <nav className="flex gap-1 rounded-button bg-surface-cloud p-1">
            <TabBtn active={tab === 'preview'} onClick={() => setTab('preview')}>
              Preview
            </TabBtn>
            <TabBtn active={tab === 'guidelines'} onClick={() => setTab('guidelines')}>
              Guidelines
            </TabBtn>
          </nav>
        </div>
        <button
          onClick={onClose}
          className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-ice"
        >
          Close
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-8" style={{ background: 'var(--oli-gradient-soft-bg)' }}>
        {tab === 'preview' ? <BrandPreview /> : <BrandGuidelines />}
      </div>
    </section>
  );
}

function TabBtn({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-btn transition ${
        active ? 'bg-white shadow-card text-ink-primary' : 'text-ink-secondary hover:text-ink-primary'
      }`}
    >
      {children}
    </button>
  );
}
