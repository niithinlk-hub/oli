import { useEffect, useRef, useState } from 'react';
import { OliIcon } from '../components/brand/OliIcon';
import { renderMarkdown } from '../utils/markdown';
import { useMeetingsStore } from '../store/meetings';

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

interface Citation {
  meetingId: string;
  meetingTitle: string;
  segmentId: number | null;
  segmentStartMs: number | null;
  score: number;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  createdAt: number;
}

interface Props {
  onHome: () => void;
  onOpenMeeting: () => void;
}

export function Ask({ onHome, onOpenMeeting }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const select = useMeetingsStore((s) => s.select);

  const refreshConvs = async () => {
    const list = await window.floyd.ai.ask.listConversations();
    setConversations(list);
    if (!activeId && list.length > 0) setActiveId(list[0].id);
  };

  const refreshMessages = async (id: string) => {
    const msgs = await window.floyd.ai.ask.listMessages(id);
    setMessages(msgs);
  };

  useEffect(() => {
    void refreshConvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeId) void refreshMessages(activeId);
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const newConversation = async () => {
    const c = await window.floyd.ai.ask.createConversation('New conversation');
    setActiveId(c.id);
    await refreshConvs();
  };

  const send = async () => {
    if (!draft.trim() || busy) return;
    let id = activeId;
    if (!id) {
      const c = await window.floyd.ai.ask.createConversation(
        draft.trim().slice(0, 60)
      );
      id = c.id;
      setActiveId(id);
      await refreshConvs();
    }
    const text = draft.trim();
    setDraft('');
    setBusy(true);
    // Optimistic user echo so the UI feels instant.
    setMessages((prev) => [
      ...prev,
      { id: -Date.now(), role: 'user', content: text, citations: [], createdAt: Date.now() }
    ]);
    await window.floyd.ai.ask.send(id, text);
    await refreshMessages(id);
    await refreshConvs();
    setBusy(false);
  };

  const deleteConv = async (id: string) => {
    await window.floyd.ai.ask.deleteConversation(id);
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    await refreshConvs();
  };

  const openCitation = (c: Citation) => {
    select(c.meetingId);
    onOpenMeeting();
  };

  return (
    <div className="h-screen flex flex-col bg-surface-cloud text-ink-primary">
      <header className="titlebar-drag h-14 flex items-center justify-between px-6 border-b border-line bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onHome}
            className="text-caption px-2 py-1.5 rounded-md text-ink-secondary hover:bg-surface-cloud"
          >
            ← Home
          </button>
          <div className="flex items-center gap-2">
            <OliIcon size={22} />
            <span className="text-h4 font-display">Ask my meetings</span>
          </div>
        </div>
        <button
          onClick={newConversation}
          className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud"
        >
          + New conversation
        </button>
      </header>

      <div className="flex-1 grid grid-cols-[280px_1fr] overflow-hidden">
        <aside className="border-r border-line bg-white overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="px-4 py-6 text-body-sm text-ink-muted">
              No conversations yet. Click <strong>+ New conversation</strong>.
            </p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center justify-between px-4 py-3 border-b border-line/60 cursor-pointer hover:bg-surface-cloud ${
                  activeId === c.id ? 'bg-surface-ice' : ''
                }`}
                onClick={() => setActiveId(c.id)}
              >
                <div className="min-w-0">
                  <p className="text-body-sm font-medium truncate">{c.title}</p>
                  <p className="text-caption text-ink-muted">
                    {c.messageCount} msgs · {new Date(c.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteConv(c.id);
                  }}
                  className="text-caption text-ink-muted hover:text-oli-coral opacity-0 group-hover:opacity-100"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </aside>

        <section className="flex flex-col min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-body-sm text-ink-muted max-w-md">
                <p>
                  Ask Oli anything about your past meetings. Examples:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>What did Alice commit to last week?</li>
                  <li>Show all decisions about pricing</li>
                  <li>Summarize the engineering syncs from this month</li>
                </ul>
                <p className="mt-3">
                  Run <em>Settings → AI intelligence → Re-index all meetings</em> first to populate
                  the search store.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="max-w-3xl">
                  <p className="text-caption uppercase tracking-wider text-ink-muted mb-1">
                    {m.role === 'user' ? 'You' : 'Oli'}
                  </p>
                  <div
                    className="oli-md text-body-sm rounded-card border border-line bg-white p-4"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                  />
                  {m.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.citations.slice(0, 6).map((c, i) => (
                        <button
                          key={i}
                          onClick={() => openCitation(c)}
                          title={`Score ${c.score.toFixed(2)}`}
                          className="text-caption px-2 py-1 rounded-full border border-line bg-white hover:bg-surface-cloud"
                        >
                          [{i + 1}] {c.meetingTitle}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-line bg-white p-4">
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void send();
                }}
                placeholder="Ask anything about your meetings…"
                className="flex-1 px-3 py-2 rounded-md border border-line bg-white text-body resize-none h-20"
              />
              <button
                onClick={send}
                disabled={busy || !draft.trim()}
                className="px-5 py-2 rounded-button text-btn text-white disabled:opacity-50"
                style={{ background: 'var(--oli-gradient-primary)' }}
              >
                {busy ? 'Thinking…' : 'Ask · Ctrl+↵'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
