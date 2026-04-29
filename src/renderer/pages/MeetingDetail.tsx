import { useEffect, useRef, useState } from 'react';
import type { Meeting, NoteDoc, TranscriptSegment } from '@shared/types';
import { RecordButton } from '../components/RecordButton';
import { NotesEditor } from '../components/NotesEditor';
import { TemplatePicker } from '../components/TemplatePicker';
import { AskOliChat } from '../components/AskOliChat';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useMeetingsStore } from '../store/meetings';
import { renderMarkdown } from '../utils/markdown';
import { useElapsedSince } from '../audio/useDuration';

interface Props {
  meetingId: string;
}

type RightTab = 'notes' | 'ask';

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function MeetingDetail({ meetingId }: Props) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [notes, setNotes] = useState<NoteDoc | null>(null);
  const [templateId, setTemplateId] = useState<string>('standard-summary');
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [tab, setTab] = useState<RightTab>('notes');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<{ flush: () => void }>({ flush: () => {} });
  const isRecording = meeting?.status === 'recording';
  const elapsed = useElapsedSince(isRecording ? meeting!.startedAt : null);
  const deleteMeetingFromStore = useMeetingsStore((s) => s.deleteMeeting);

  const refreshAll = async () => {
    const [m, t, n] = await Promise.all([
      window.floyd.meetings.get(meetingId),
      window.floyd.transcript.list(meetingId),
      window.floyd.notes.get(meetingId)
    ]);
    setMeeting(m);
    setTranscript(t);
    setNotes(n);
    if (m?.templateId) setTemplateId(m.templateId);
  };

  useEffect(() => {
    void refreshAll();
    setTab('notes');
    setEnhanceError(null);
    setExportMessage(null);
  }, [meetingId]);

  useEffect(() => {
    const offPartial = window.floyd.transcript.onPartial((evt) => {
      if (evt.meetingId !== meetingId) return;
      setTranscript((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          meetingId: evt.meetingId,
          startMs: evt.startMs,
          endMs: evt.endMs,
          text: evt.text,
          source: evt.source
        }
      ]);
    });
    const offFinal = window.floyd.transcript.onFinal((evt) => {
      if (evt.meetingId !== meetingId) return;
      void refreshAll();
    });
    return () => {
      offPartial();
      offFinal();
    };
  }, [meetingId]);

  useEffect(() => {
    transcriptScrollRef.current?.scrollTo({
      top: transcriptScrollRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [transcript.length]);

  // Listen for menu shortcuts
  useEffect(() => {
    const off1 = window.floyd.menu.on('menu:export-meeting', () => void doExport());
    const off2 = window.floyd.menu.on('menu:delete-meeting', () => setConfirmDelete(true));
    const off3 = window.floyd.menu.on('menu:ask-oli', () => setTab('ask'));
    const off4 = window.floyd.menu.on('menu:save-notes', () => notesRef.current.flush());
    return () => {
      off1();
      off2();
      off3();
      off4();
    };
  }, [meetingId]);

  const enhance = async () => {
    setEnhancing(true);
    setEnhanceError(null);
    try {
      const res = await window.floyd.llm.enhance({ meetingId, templateId });
      if (!res.ok) {
        setEnhanceError(res.message ?? 'Enhancement failed.');
      } else {
        await refreshAll();
      }
    } finally {
      setEnhancing(false);
    }
  };

  const doExport = async () => {
    setExportMessage(null);
    const res = await window.floyd.meetings.exportMarkdown(meetingId);
    if (res.ok) setExportMessage(`Exported to ${res.path}`);
    else setExportMessage(res.message ?? 'Export failed.');
  };

  const doDelete = async () => {
    await deleteMeetingFromStore(meetingId);
    setConfirmDelete(false);
  };

  if (!meeting) {
    return <div className="flex-1 flex items-center justify-center text-ink-muted">Loading…</div>;
  }

  return (
    <section className="flex-1 flex flex-col bg-surface-cloud">
      <header className="titlebar-drag h-14 flex items-center justify-between gap-3 px-6 border-b border-line bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-h4 truncate">{meeting.title}</h2>
          {isRecording && (
            <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-oli-coral/10 text-oli-coral text-caption font-medium">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-oli-coral opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-oli-coral" />
              </span>
              <span className="font-mono tabular-nums">{elapsed}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={doExport}
            className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud"
            title="Export to markdown (Ctrl+E)"
          >
            Export
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-btn px-3 py-1.5 rounded-button border border-line bg-white hover:bg-surface-cloud text-ink-secondary"
            title="Delete meeting (Ctrl+Backspace)"
          >
            Delete
          </button>
          <RecordButton meetingId={meeting.id} onStateChange={() => void refreshAll()} />
        </div>
      </header>

      {exportMessage && (
        <div className="px-6 py-2 text-caption bg-surface-amberSoft border-b border-line text-ink-secondary">
          {exportMessage}
        </div>
      )}

      <div className="flex-1 grid grid-cols-2 overflow-hidden">
        {/* Transcript */}
        <div className="border-r border-line flex flex-col bg-white">
          <div className="px-6 py-3 text-caption uppercase tracking-wider text-ink-muted border-b border-line">
            Transcript
            {transcript.length > 0 && (
              <span className="text-ink-secondary ml-2 normal-case tracking-normal">
                · {transcript.length} segments
              </span>
            )}
          </div>
          <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto px-6 py-4">
            {transcript.length === 0 ? (
              <div className="text-ink-muted text-body-sm">
                <p className="mb-1">Nothing transcribed yet.</p>
                <p>
                  Press <span className="font-medium text-ink-primary">Record</span> — Oli will
                  start listening.
                </p>
              </div>
            ) : (
              transcript.map((s, i) => (
                <p key={`${s.id}-${i}`} className="mb-2 text-body-sm leading-relaxed">
                  <span className="font-mono text-caption text-ink-muted mr-2 tabular-nums">
                    {fmt(s.startMs)}
                  </span>
                  <span className="text-ink-primary">{s.text}</span>
                </p>
              ))
            )}
          </div>
        </div>

        {/* Right pane: notes / ask oli tabs */}
        <div className="flex flex-col bg-white">
          <div className="px-6 py-3 flex items-center justify-between gap-3 border-b border-line">
            <div className="flex items-center gap-1 rounded-button bg-surface-cloud p-1">
              <TabBtn active={tab === 'notes'} onClick={() => setTab('notes')}>
                Notes
              </TabBtn>
              <TabBtn active={tab === 'ask'} onClick={() => setTab('ask')}>
                ✦ Ask Oli
              </TabBtn>
            </div>
            {tab === 'notes' && (
              <div className="flex items-center gap-2">
                <TemplatePicker value={templateId} onChange={setTemplateId} />
                <button
                  onClick={enhance}
                  disabled={enhancing}
                  className="px-3 py-1.5 rounded-button text-btn text-white disabled:opacity-60 transition"
                  style={{
                    background: 'var(--oli-gradient-memory)',
                    boxShadow: 'var(--oli-shadow-floating)'
                  }}
                >
                  {enhancing ? 'Enhancing…' : '✦ Enhance'}
                </button>
              </div>
            )}
          </div>
          {enhanceError && tab === 'notes' && (
            <div className="px-6 py-2 text-caption bg-surface-amberSoft border-b border-line text-ink-secondary">
              {enhanceError}
            </div>
          )}

          {tab === 'notes' ? (
            <div className="flex-1 min-h-0 grid grid-rows-[1fr_auto]">
              <NotesEditor
                key={meetingId}
                initialContent={notes?.rawMarkdown ?? ''}
                onSave={(html) => void window.floyd.notes.save(meetingId, html)}
                flushRef={notesRef}
              />
              {notes?.enhancedMarkdown && (
                <div className="border-t border-line px-6 py-4 max-h-[40%] overflow-y-auto bg-surface-cloud">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-flex h-6 w-6 rounded-md items-center justify-center text-white text-xs"
                      style={{ background: 'var(--oli-gradient-memory)' }}
                    >
                      ✦
                    </span>
                    <span className="text-caption uppercase tracking-wider text-ink-muted">
                      Oli enhanced
                    </span>
                  </div>
                  <div
                    className="oli-md"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(notes.enhancedMarkdown)
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <AskOliChat meetingId={meetingId} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this meeting?"
        message="The transcript, notes, and audio recording will be removed permanently. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
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
        active
          ? 'bg-white shadow-card text-ink-primary'
          : 'text-ink-secondary hover:text-ink-primary'
      }`}
    >
      {children}
    </button>
  );
}
