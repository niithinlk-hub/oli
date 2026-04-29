import { useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '../utils/markdown';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  meetingId: string;
}

export function AskOliChat({ meetingId }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([]);
  }, [meetingId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    const next = [...messages, { role: 'user' as const, content: q }];
    setMessages(next);
    setInput('');
    setBusy(true);
    const res = await window.floyd.llm.ask({
      meetingId,
      question: q,
      history: messages
    });
    setBusy(false);
    if (res.ok && res.markdown) {
      setMessages([...next, { role: 'assistant', content: res.markdown }]);
    } else {
      setMessages([
        ...next,
        { role: 'assistant', content: `*Error:* ${res.message ?? 'Unknown error'}` }
      ]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-6 pb-2">
            <p className="text-body-sm text-ink-muted">
              Ask anything about this meeting.
            </p>
            <p className="text-caption text-ink-muted mt-1">
              "What did we decide about pricing?" · "Who owns the next steps?"
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-card px-4 py-3 ${
              m.role === 'user'
                ? 'ml-auto text-white'
                : 'mr-auto bg-surface-cloud border border-line'
            }`}
            style={
              m.role === 'user'
                ? { background: 'var(--oli-gradient-primary)' }
                : undefined
            }
          >
            {m.role === 'user' ? (
              <p className="text-body-sm whitespace-pre-wrap">{m.content}</p>
            ) : (
              <div
                className="oli-md"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
              />
            )}
          </div>
        ))}
        {busy && (
          <div className="mr-auto bg-surface-cloud border border-line rounded-card px-4 py-3 max-w-[85%]">
            <span className="inline-flex gap-1">
              <Dot delay="0ms" />
              <Dot delay="150ms" />
              <Dot delay="300ms" />
            </span>
          </div>
        )}
      </div>
      <div className="border-t border-line px-4 py-3 flex gap-2 bg-white">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask Oli about this meeting…"
          className="flex-1 px-3 py-2 rounded-button border border-line bg-white text-body-sm outline-none focus:border-oli-blue/60"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="px-4 py-2 rounded-button text-btn text-white disabled:opacity-50"
          style={{ background: 'var(--oli-gradient-memory)' }}
        >
          Ask
        </button>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-oli-violet animate-pulse"
      style={{ animationDelay: delay }}
    />
  );
}
