import { useEffect, useState } from 'react';
import { renderMarkdown } from '../utils/markdown';

interface ActionItem {
  id: number;
  owner: string | null;
  task: string;
  due: string | null;
  segmentRef: number | null;
  done: boolean;
  createdAt: number;
}

interface Decision {
  id: number;
  text: string;
  segmentRef: number | null;
  createdAt: number;
}

interface Props {
  meetingId: string;
  onSeek?: (segmentId: number) => void;
  onSendAsEmail?: (markdown: string) => void;
}

export function ActionItemsTab({ meetingId, onSeek, onSendAsEmail }: Props) {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const r = await window.floyd.ai.structured.list(meetingId);
    setActions(r.actionItems);
    setDecisions(r.decisions);
    setTopics(r.topics);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const extract = async () => {
    setExtracting(true);
    setMessage(null);
    const r = await window.floyd.ai.structured.extract(meetingId);
    if (!r.ok) setMessage(r.message ?? 'Extraction failed.');
    await refresh();
    setExtracting(false);
  };

  const toggleDone = async (id: number, done: boolean) => {
    await window.floyd.ai.structured.setActionDone(id, done);
    await refresh();
  };

  const exportMarkdown = (): string => {
    const lines: string[] = [];
    lines.push('## Decisions');
    if (decisions.length === 0) lines.push('_None._');
    for (const d of decisions) lines.push(`- ${d.text}`);
    lines.push('');
    lines.push('## Action items');
    if (actions.length === 0) lines.push('_None._');
    for (const a of actions) {
      const owner = a.owner ? `**${a.owner}** — ` : '';
      const due = a.due ? ` (due ${a.due})` : '';
      lines.push(`- [ ] ${owner}${a.task}${due}`);
    }
    lines.push('');
    if (topics.length > 0) {
      lines.push('## Topics');
      lines.push(topics.map((t) => `\`${t}\``).join(' '));
    }
    return lines.join('\n');
  };

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(exportMarkdown());
    setMessage('Copied as markdown.');
  };

  const copyPlain = async () => {
    const text = exportMarkdown()
      .replace(/[*_`#]/g, '')
      .replace(/^- \[ \] /gm, '• ');
    await navigator.clipboard.writeText(text);
    setMessage('Copied as plain text.');
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-h4">Action items</h3>
        <div className="flex gap-2">
          <button
            onClick={extract}
            disabled={extracting}
            className="px-3 py-1.5 rounded-button text-btn text-white disabled:opacity-50"
            style={{ background: 'var(--oli-gradient-memory)' }}
          >
            {extracting ? 'Extracting…' : '✦ Extract'}
          </button>
          <button
            onClick={copyMarkdown}
            disabled={actions.length === 0 && decisions.length === 0}
            className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud disabled:opacity-40"
          >
            Copy as MD
          </button>
          <button
            onClick={copyPlain}
            disabled={actions.length === 0 && decisions.length === 0}
            className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud disabled:opacity-40"
          >
            Copy plain
          </button>
          {onSendAsEmail && (
            <button
              onClick={() => onSendAsEmail(exportMarkdown())}
              disabled={actions.length === 0 && decisions.length === 0}
              className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud disabled:opacity-40"
            >
              Send as email →
            </button>
          )}
        </div>
      </div>

      {message && <p className="text-caption text-ink-secondary mb-3">{message}</p>}

      {actions.length === 0 && decisions.length === 0 ? (
        <p className="text-body-sm text-ink-muted">
          Nothing extracted yet. Click <span className="font-medium text-ink-primary">Extract</span>{' '}
          after the meeting finishes — Oli will pull decisions, action items, and topics from the
          transcript.
        </p>
      ) : (
        <>
          {decisions.length > 0 && (
            <section className="mb-5">
              <p className="text-caption uppercase tracking-wider text-ink-muted mb-2">Decisions</p>
              <ul className="space-y-1.5">
                {decisions.map((d) => (
                  <li key={d.id} className="rounded-md border border-line bg-white px-3 py-2">
                    <div
                      className="oli-md text-body-sm"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(d.text) }}
                    />
                    {d.segmentRef && onSeek && (
                      <button
                        onClick={() => onSeek(d.segmentRef!)}
                        className="text-caption text-oli-blue mt-1 hover:underline"
                      >
                        Jump to transcript →
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {actions.length > 0 && (
            <section className="mb-5">
              <p className="text-caption uppercase tracking-wider text-ink-muted mb-2">
                Tasks · {actions.filter((a) => !a.done).length} open
              </p>
              <ul className="space-y-1.5">
                {actions.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-2 rounded-md border border-line bg-white px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={a.done}
                      onChange={(e) => void toggleDone(a.id, e.target.checked)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className={`text-body-sm ${a.done ? 'line-through text-ink-muted' : ''}`}>
                        {a.owner && (
                          <span className="font-medium text-ink-primary">{a.owner}: </span>
                        )}
                        {a.task}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {a.due && (
                          <span className="text-caption text-ink-muted">due {a.due}</span>
                        )}
                        {a.segmentRef && onSeek && (
                          <button
                            onClick={() => onSeek(a.segmentRef!)}
                            className="text-caption text-oli-blue hover:underline"
                          >
                            Jump to transcript →
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {topics.length > 0 && (
            <section>
              <p className="text-caption uppercase tracking-wider text-ink-muted mb-2">Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {topics.map((t) => (
                  <span
                    key={t}
                    className="text-caption px-2 py-1 rounded-full border border-line bg-surface-cloud text-ink-secondary"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
