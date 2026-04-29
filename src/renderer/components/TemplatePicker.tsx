import { useEffect, useState } from 'react';
import type { Template } from '@shared/types';

interface Props {
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}

export function TemplatePicker({ value, onChange, className = '' }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void window.floyd.llm.listTemplates().then(setTemplates);
  }, []);

  const selected = templates.find((t) => t.id === value);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 rounded-button text-btn border border-line bg-white hover:bg-surface-cloud flex items-center gap-2"
      >
        <span className="text-ink-muted text-caption uppercase tracking-wider">Template</span>
        <span className="text-ink-primary">{selected?.name ?? 'Standard summary'}</span>
        <span className="text-ink-muted">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-80 rounded-card border border-line bg-white shadow-floating z-20 overflow-hidden">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onChange(t.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-surface-ice transition border-b border-line/60 last:border-b-0 ${
                  value === t.id ? 'bg-surface-ice' : ''
                }`}
              >
                <div className="text-body-sm font-medium">{t.name}</div>
                <div className="text-caption text-ink-muted mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
