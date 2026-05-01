import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import type { Meeting, NoteDoc, TranscriptSegment } from '@shared/types';
import { RecordButton } from '../components/RecordButton';
import { NotesEditor } from '../components/NotesEditor';
import { TemplatePicker } from '../components/TemplatePicker';
import { AskOliChat } from '../components/AskOliChat';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RadialRecorder } from '../components/recorder/RadialRecorder';
import { useMeetingsStore } from '../store/meetings';
import { useUiPrefs } from '../store/uiPrefs';
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
  const [primary, setPrimary] = useState<'transcript' | 'notes'>('transcript');
  const [audioPos, setAudioPos] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<{ flush: () => void }>({ flush: () => {} });
  const recordToggleRef = useRef<{ toggle: () => Promise<void> } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isRecording = meeting?.status === 'recording';
  const elapsed = useElapsedSince(isRecording ? meeting!.startedAt : null);
  const deleteMeetingFromStore = useMeetingsStore((s) => s.deleteMeeting);

  const refreshAll = useCallback(async () => {
    const [m, t, n] = await Promise.all([
      window.floyd.meetings.get(meetingId),
      window.floyd.transcript.list(meetingId),
      window.floyd.notes.get(meetingId)
    ]);
    setMeeting(m);
    setTranscript(t);
    setNotes(n);
    if (m?.templateId) setTemplateId(m.templateId);
  }, [meetingId]);

  useEffect(() => {
    void refreshAll();
    setTab('notes');
    setEnhanceError(null);
    setExportMessage(null);
  }, [meetingId, refreshAll]);

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
  }, [meetingId, refreshAll]);

  useEffect(() => {
    transcriptScrollRef.current?.scrollTo({
      top: transcriptScrollRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [transcript.length]);

  // Audio playback: load mixed.wav via custom oli-audio:// protocol.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !meeting?.audioPath) return;
    a.src = `oli-audio://${meetingId}`;
    a.load();
    const onMeta = () => setAudioDuration(a.duration * 1000);
    const onTime = () => setAudioPos(a.currentTime * 1000);
    const onPlay = () => setAudioPlaying(true);
    const onPause = () => setAudioPlaying(false);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, [meetingId, meeting?.audioPath]);

  const seekTo = useCallback((ms: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = ms / 1000;
    setAudioPos(ms);
    // Highlight pulse on the segment near this timestamp.
    const target = transcript.find((s) => s.startMs <= ms && ms <= s.endMs);
    if (target && transcriptScrollRef.current) {
      const node = transcriptScrollRef.current.querySelector(
        `[data-segment-id="${target.id}"]`
      ) as HTMLElement | null;
      if (node) {
        node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        node.classList.remove('caption-pulse');
        // restart animation
        void node.offsetWidth;
        node.classList.add('caption-pulse');
      }
    }
  }, [transcript]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }, []);

  // \ key swaps which pane is primary (wider).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (!inField && e.key === '\\' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setPrimary((p) => (p === 'transcript' ? 'notes' : 'transcript'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const doExport = useCallback(async () => {
    setExportMessage(null);
    const res = await window.floyd.meetings.exportMarkdown(meetingId);
    if (res.ok) setExportMessage(`Exported to ${res.path}`);
    else setExportMessage(res.message ?? 'Export failed.');
  }, [meetingId]);

  // Listen for menu shortcuts
  useEffect(() => {
    const off1 = window.floyd.menu.on('menu:export-meeting', () => void doExport());
    const off2 = window.floyd.menu.on('menu:delete-meeting', () => setConfirmDelete(true));
    const off3 = window.floyd.menu.on('menu:ask-oli', () => setTab('ask'));
    const off4 = window.floyd.menu.on('menu:save-notes', () => notesRef.current.flush());
    const off5 = window.floyd.menu.on('menu:toggle-record', () => {
      void recordToggleRef.current?.toggle();
    });
    return () => {
      off1();
      off2();
      off3();
      off4();
      off5();
    };
  }, [meetingId, doExport]);

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
          <RecordButton
            meetingId={meeting.id}
            onStateChange={() => void refreshAll()}
            toggleRef={recordToggleRef}
          />
        </div>
      </header>

      {exportMessage && (
        <div className="px-6 py-2 text-caption bg-surface-amberSoft border-b border-line text-ink-secondary">
          {exportMessage}
        </div>
      )}

      <ResizableSplit primary={primary}>
        {/* Transcript */}
        <div className="h-full border-r border-line flex flex-col bg-white">
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
              <div className="h-full flex flex-col items-center justify-center text-center">
                <RadialRecorder
                  state={isRecording ? 'recording' : 'idle'}
                  onToggle={() => void recordToggleRef.current?.toggle()}
                />
                <p className="text-body text-ink-secondary mt-6">
                  {isRecording
                    ? 'Listening… captions appear here.'
                    : 'Press the button to start recording.'}
                </p>
                <p className="text-caption text-ink-muted mt-1">
                  <kbd className="font-mono px-1.5 py-0.5 rounded bg-white border border-line">Ctrl+Shift+R</kbd>
                  {' '}global hotkey · <kbd className="font-mono px-1.5 py-0.5 rounded bg-white border border-line">\\</kbd>
                  {' '}swap pane
                </p>
              </div>
            ) : (
              transcript.map((s, i) => (
                <button
                  key={`${s.id}-${i}`}
                  data-segment-id={s.id}
                  onClick={() => seekTo(s.startMs)}
                  className="block text-left w-full mb-2 text-body-sm leading-relaxed rounded px-1 hover:bg-surface-cloud transition"
                >
                  <span className="font-mono text-caption text-ink-muted mr-2 tabular-nums">
                    {fmt(s.startMs)}
                  </span>
                  <span className="text-ink-primary">{s.text}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right pane: notes / ask oli tabs */}
        <div className="h-full flex flex-col bg-white">
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
      </ResizableSplit>

      {/* Audio scrubber bar */}
      {meeting.audioPath && (
        <div className="h-12 px-4 border-t border-line bg-white flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="h-7 w-7 rounded-full flex items-center justify-center text-white"
            style={{ background: 'var(--oli-gradient-primary)' }}
            title={audioPlaying ? 'Pause' : 'Play'}
          >
            {audioPlaying ? '❚❚' : '▶'}
          </button>
          <span className="font-mono text-caption text-ink-muted tabular-nums">
            {fmt(audioPos)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, audioDuration)}
            value={Math.min(audioPos, audioDuration)}
            onChange={(e) => seekTo(parseInt(e.target.value, 10))}
            className="flex-1 oli-scrub"
          />
          <span className="font-mono text-caption text-ink-muted tabular-nums">
            {fmt(audioDuration)}
          </span>
          <button
            onClick={() => setPrimary((p) => (p === 'transcript' ? 'notes' : 'transcript'))}
            className="text-caption text-ink-muted hover:text-ink-primary px-2 py-1 rounded hover:bg-surface-cloud"
            title="Swap primary pane (\\)"
          >
            ⇄
          </button>
          {/* Hidden audio element. */}
          <audio ref={audioRef} preload="metadata" />
        </div>
      )}

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

function ResizableSplit({
  children,
  primary
}: {
  children: React.ReactNode[];
  primary: 'transcript' | 'notes';
}) {
  const pct = useUiPrefs((s) => s.meetingTranscriptPct);
  const setPct = useUiPrefs((s) => s.setMeetingTranscriptPct);
  const left = children[0];
  const right = children[1];
  // When notes is primary, mirror the layout — make the left (transcript)
  // panel the smaller side. We do this by inverting `pct` for the layout but
  // keeping the stored value transcript-relative for consistency.
  const leftPct = primary === 'transcript' ? pct : 100 - pct;
  return (
    <div className="flex-1 overflow-hidden">
      <PanelGroup
        direction="horizontal"
        autoSaveId="oli.meeting.split"
        onLayout={(sizes) => {
          const transcriptSize = primary === 'transcript' ? sizes[0] : sizes[1];
          if (transcriptSize && Math.abs(transcriptSize - pct) >= 1) setPct(transcriptSize);
        }}
      >
        <Panel defaultSize={leftPct} minSize={20} maxSize={80}>
          {left}
        </Panel>
        <PanelResizeHandle className="w-1 bg-line hover:bg-oli-blue/40 transition-colors data-[resize-handle-state=drag]:bg-oli-blue" />
        <Panel minSize={20}>{right}</Panel>
      </PanelGroup>
    </div>
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
