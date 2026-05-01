import { Command } from 'cmdk';
import { useEffect, useMemo, useState } from 'react';
import { useMeetingsStore } from '../../store/meetings';
import { useUiPrefs } from '../../store/uiPrefs';

type View = 'home' | 'meeting' | 'email' | 'settings' | 'brand';

interface Props {
  open: boolean;
  onClose: () => void;
  onSwitchView: (v: View) => void;
}

interface ProviderRow {
  id: string;
  label: string;
  configured: boolean;
}

/**
 * Global command palette (Ctrl+K). Sections:
 *  - Recent (last 5 actions, persisted)
 *  - Meetings (fuzzy over titles via cmdk's built-in filter)
 *  - Actions (navigate, switch provider, switch STT)
 *
 * Built on `cmdk` for the fuzzy ranking, list virtualization, and a11y.
 */
export function CommandPalette({ open, onClose, onSwitchView }: Props) {
  const meetings = useMeetingsStore((s) => s.meetings);
  const refreshMeetings = useMeetingsStore((s) => s.refresh);
  const select = useMeetingsStore((s) => s.select);
  const createMeeting = useMeetingsStore((s) => s.createMeeting);
  const recent = useUiPrefs((s) => s.recentActions);
  const pushRecent = useUiPrefs((s) => s.pushRecentAction);

  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [activeProvider, setActiveProvider] = useState<string>('');
  const [sttProvider, setSttProvider] = useState<'local' | 'groq'>('local');

  useEffect(() => {
    if (!open) return;
    void refreshMeetings();
    void window.floyd.llm.listProviders().then(setProviders);
    void window.floyd.llm.getActiveProvider().then(setActiveProvider);
    void window.floyd.stt.get().then((c) => setSttProvider(c.provider));
  }, [open, refreshMeetings]);

  const allActions = useMemo(() => buildActions(providers, activeProvider, sttProvider), [
    providers,
    activeProvider,
    sttProvider
  ]);

  if (!open) return null;

  const run = (id: string, fn: () => void | Promise<void>) => {
    pushRecent(id);
    void Promise.resolve(fn()).finally(() => onClose());
  };

  const switchProvider = async (id: string) => {
    await window.floyd.llm.setActiveProvider(id);
    setActiveProvider(id);
  };
  const switchStt = async (p: 'local' | 'groq') => {
    await window.floyd.stt.setProvider(p);
    setSttProvider(p);
  };

  const recentItems = recent
    .map((id) => allActions.find((a) => a.id === id))
    .filter((x): x is CmdAction => x !== undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]"
      onClick={onClose}
      style={{ background: 'rgba(7, 26, 51, 0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-[640px] max-w-[92vw] rounded-card bg-white shadow-floating overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command palette" loop>
          <div className="border-b border-line">
            <Command.Input
              autoFocus
              placeholder="Search meetings, actions, providers…"
              className="w-full px-4 py-3 text-body bg-transparent outline-none"
            />
          </div>
          <Command.List className="max-h-[460px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-caption text-ink-muted">
              No matches.
            </Command.Empty>

            {recentItems.length > 0 && (
              <Command.Group heading="Recent" className="cmd-group">
                {recentItems.map((a) => (
                  <CmdRow key={`recent-${a.id}`} action={a} onRun={(fn) => run(a.id, fn)} />
                ))}
              </Command.Group>
            )}

            {meetings.length > 0 && (
              <Command.Group heading="Meetings" className="cmd-group">
                {meetings.slice(0, 12).map((m) => (
                  <Command.Item
                    key={`m-${m.id}`}
                    value={`meeting ${m.title}`}
                    onSelect={() =>
                      run(`meeting:${m.id}`, () => {
                        select(m.id);
                        onSwitchView('meeting');
                      })
                    }
                    className="cmd-item"
                  >
                    <span className="text-body-sm">{m.title}</span>
                    <span className="ml-auto text-caption text-ink-muted">
                      {new Date(m.startedAt).toLocaleDateString()}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Actions" className="cmd-group">
              {allActions.map((a) => (
                <CmdRow
                  key={a.id}
                  action={a}
                  onRun={(fn) =>
                    run(a.id, async () => {
                      if (a.id === 'action.new-meeting') {
                        await createMeeting(`Meeting · ${new Date().toLocaleString()}`);
                        onSwitchView('meeting');
                      } else if (a.id === 'action.new-email') {
                        onSwitchView('email');
                      } else if (a.id === 'action.go-home') {
                        onSwitchView('home');
                      } else if (a.id === 'action.go-settings') {
                        onSwitchView('settings');
                      } else if (a.id.startsWith('llm:')) {
                        await switchProvider(a.id.slice(4));
                      } else if (a.id === 'stt:local' || a.id === 'stt:groq') {
                        await switchStt(a.id.split(':')[1] as 'local' | 'groq');
                      } else {
                        await fn();
                      }
                    })
                  }
                />
              ))}
            </Command.Group>
          </Command.List>
        </Command>
        <div className="border-t border-line px-3 py-2 text-caption text-ink-muted flex items-center justify-between">
          <span>↑↓ navigate · ↵ select · esc close</span>
          <span className="font-mono">⌘K</span>
        </div>
      </div>
    </div>
  );
}

interface CmdAction {
  id: string;
  title: string;
  hint?: string;
  badge?: string;
}

function buildActions(
  providers: ProviderRow[],
  activeProvider: string,
  sttProvider: 'local' | 'groq'
): CmdAction[] {
  const list: CmdAction[] = [
    { id: 'action.new-meeting', title: 'New meeting', hint: 'Start recording' },
    { id: 'action.new-email', title: 'New email rephrase', hint: 'Open email rephraser' },
    { id: 'action.go-home', title: 'Open home' },
    { id: 'action.go-settings', title: 'Open settings' }
  ];
  for (const p of providers) {
    list.push({
      id: `llm:${p.id}`,
      title: `Switch AI provider → ${p.label}`,
      hint: p.configured ? 'configured' : 'no key',
      badge: activeProvider === p.id ? 'active' : undefined
    });
  }
  list.push({
    id: 'stt:local',
    title: 'Switch STT → Local whisper.cpp',
    badge: sttProvider === 'local' ? 'active' : undefined
  });
  list.push({
    id: 'stt:groq',
    title: 'Switch STT → Groq Cloud',
    badge: sttProvider === 'groq' ? 'active' : undefined
  });
  return list;
}

function CmdRow({
  action,
  onRun
}: {
  action: CmdAction;
  onRun: (fn: () => void | Promise<void>) => void;
}) {
  return (
    <Command.Item
      value={action.title}
      onSelect={() => onRun(() => undefined)}
      className="cmd-item"
    >
      <span className="text-body-sm">{action.title}</span>
      {action.hint && <span className="ml-auto text-caption text-ink-muted">{action.hint}</span>}
      {action.badge && (
        <span className="ml-2 text-caption text-oli-blue px-1.5 py-0.5 rounded bg-oli-blue/10">
          {action.badge}
        </span>
      )}
    </Command.Item>
  );
}
