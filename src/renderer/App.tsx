import { useEffect, useRef, useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { MeetingList } from './components/MeetingList';
import { useAmplitude } from './store/amplitude';
import { MeetingDetail } from './pages/MeetingDetail';
import { Settings } from './pages/Settings';
import { Brand } from './pages/Brand';
import { Home } from './pages/Home';
import { Calendar } from './pages/Calendar';
import { Ask } from './pages/Ask';
import { EmailRephraser } from './pages/EmailRephraser';
import { Onboarding, shouldShowOnboarding } from './pages/Onboarding';
import { UpcomingEvents } from './components/UpcomingEvents';
import { SearchBar } from './components/SearchBar';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CommandPalette } from './components/command-palette/CommandPalette';
import { useMeetingsStore } from './store/meetings';
import { useUiPrefs } from './store/uiPrefs';
import { OliLogoStacked } from './components/brand/OliLogoStacked';

type View = 'home' | 'meeting' | 'email' | 'calendar' | 'ask' | 'settings' | 'brand';

export default function App() {
  const selectedId = useMeetingsStore((s) => s.selectedId);
  const createMeeting = useMeetingsStore((s) => s.createMeeting);
  const hydrate = useUiPrefs((s) => s.hydrate);
  const sidebarMode = useUiPrefs((s) => s.sidebarMode);
  const setSidebarMode = useUiPrefs((s) => s.setSidebarMode);
  const sidebarPx = useUiPrefs((s) => s.sidebarPx);
  const setSidebarPx = useUiPrefs((s) => s.setSidebarPx);
  const [view, setView] = useState<View>('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchSignal] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    void hydrate();
    void window.floyd.app.version().then(setAppVersion);
  }, [hydrate]);

  useEffect(() => {
    setShowOnboarding(shouldShowOnboarding());
  }, []);

  // Application-menu shortcuts
  useEffect(() => {
    const offNew = window.floyd.menu.on('menu:new-meeting', () => {
      const title = `Meeting · ${new Date().toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`;
      void createMeeting(title);
      setView('meeting');
    });
    const offSearch = window.floyd.menu.on('menu:search', () => {
      setPaletteOpen(true);
    });
    const offSettings = window.floyd.menu.on('menu:settings', () => setView('settings'));
    const offBrand = window.floyd.menu.on('menu:brand', () => setView('brand'));
    const offAbout = window.floyd.menu.on('menu:about', () => setAboutOpen(true));
    return () => {
      offNew();
      offSearch();
      offSettings();
      offBrand();
      offAbout();
    };
  }, [createMeeting]);

  // Track active recording state for the mini-window auto-spawn.
  const isRecordingRef = useRef(false);
  useEffect(() => {
    // Whenever amplitude bars are non-zero we infer active recording.
    // Cheap-and-cheerful: drives mini open/close while window is hidden.
    const unsub = useAmplitude.subscribe((s) => {
      isRecordingRef.current = s.micRms > 0 || s.loopbackRms > 0;
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const off = window.floyd.mini.onRequestOpenOnHide(() => {
      void window.floyd.mini.openIfRecording(isRecordingRef.current);
    });
    return () => {
      off();
    };
  }, []);

  // Calendar-driven auto-record: main fires `calendar:auto-record-start` with
  // an event payload. We create a meeting on the fly and switch to its view.
  // The user clicks Record in MeetingDetail (or RadialRecorder) to actually
  // start capturing — Phase 2.5 prompt mode lands here too; auto mode just
  // routes faster.
  useEffect(() => {
    const off = window.floyd.calendar.onAutoRecordStart(async (payload) => {
      const m = await useMeetingsStore.getState().createMeeting(payload.event.title);
      useMeetingsStore.getState().select(m.id);
      setView('meeting');
    });
    return () => {
      off();
    };
  }, []);

  // Forward amplitude bars to mini window (cheap, only when mini is open).
  useEffect(() => {
    let lastSent = 0;
    const unsub = useAmplitude.subscribe((s) => {
      const now = Date.now();
      // Throttle to ~30fps to avoid IPC flooding.
      if (now - lastSent < 33) return;
      lastSent = now;
      const bars = s.micBars.map((m, i) => Math.max(m, s.loopbackBars[i] ?? 0));
      window.floyd.mini.sendAmplitude({ mic: s.micRms, loopback: s.loopbackRms, bars });
    });
    return () => unsub();
  }, []);

  // Keyboard shortcuts: Ctrl+K (palette), [ (sidebar rail toggle)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as HTMLElement).isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === '[' && !inField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setSidebarMode(sidebarMode === 'rail' ? 'expanded' : 'rail');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sidebarMode, setSidebarMode]);

  // Home + Email = full-window, no meeting sidebar
  if (view === 'home') {
    return (
      <div className="h-screen bg-surface-cloud text-ink-primary">
        <Home
          onOpenMeeting={() => setView('meeting')}
          onOpenEmail={() => setView('email')}
          onOpenSettings={() => setView('settings')}
          onOpenBrand={() => setView('brand')}
          onOpenCalendar={() => setView('calendar')}
        />
        {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSwitchView={setView}
        />
        <ConfirmDialog
          open={aboutOpen}
          title="Oli"
          message={`Local-first AI meeting memory + email rephraser for Windows.\n\nVersion ${appVersion || '1.1.0'}\nhttps://github.com/niithinlk-hub/oli`}
          confirmLabel="OK"
          onConfirm={() => setAboutOpen(false)}
          onCancel={() => setAboutOpen(false)}
        />
      </div>
    );
  }

  if (view === 'email') {
    return (
      <div className="h-screen bg-surface-cloud text-ink-primary">
        <EmailRephraser onHome={() => setView('home')} onOpenSettings={() => setView('settings')} />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSwitchView={setView}
        />
      </div>
    );
  }

  if (view === 'calendar') {
    return (
      <div className="h-screen bg-surface-cloud text-ink-primary">
        <Calendar
          onHome={() => setView('home')}
          onOpenMeeting={() => setView('meeting')}
          onOpenSettings={() => setView('settings')}
        />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSwitchView={setView}
        />
      </div>
    );
  }

  if (view === 'ask') {
    return (
      <div className="h-screen bg-surface-cloud text-ink-primary">
        <Ask onHome={() => setView('home')} onOpenMeeting={() => setView('meeting')} />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSwitchView={setView}
        />
      </div>
    );
  }

  // Sidebar pixel width as percentage relative to viewport so the panel API
  // can use sizes in %. Recompute on every render — cheap.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1320;
  const sidebarPct =
    sidebarMode === 'rail' ? (56 / vw) * 100 : Math.max(15, Math.min(40, (sidebarPx / vw) * 100));

  return (
    <div className="h-screen flex bg-surface-cloud text-ink-primary">
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel
          defaultSize={sidebarPct}
          minSize={sidebarMode === 'rail' ? (56 / vw) * 100 : 15}
          maxSize={sidebarMode === 'rail' ? (56 / vw) * 100 : 40}
          onResize={(size) => {
            if (sidebarMode === 'expanded') setSidebarPx((size / 100) * vw);
          }}
        >
          <MeetingList
            onOpenHome={() => setView('home')}
            onOpenSettings={() => setView('settings')}
            onOpenBrand={() => setView('brand')}
            onOpenSearch={() => setPaletteOpen(true)}
            onOpenEmail={() => setView('email')}
            onOpenCalendar={() => setView('calendar')}
            onOpenAsk={() => setView('ask')}
            upcomingSlot={sidebarMode === 'expanded' ? <UpcomingEvents /> : undefined}
          />
        </Panel>
        {sidebarMode === 'expanded' && (
          <PanelResizeHandle className="w-1 bg-line hover:bg-oli-blue/40 transition-colors data-[resize-handle-state=drag]:bg-oli-blue" />
        )}
        <Panel minSize={40}>
          {view === 'settings' ? (
            <Settings onClose={() => setView('home')} />
          ) : view === 'brand' ? (
            <Brand onClose={() => setView('home')} />
          ) : selectedId ? (
            <MeetingDetail meetingId={selectedId} />
          ) : (
            <section
              className="h-full flex items-center justify-center"
              style={{ background: 'var(--oli-gradient-soft-bg)' }}
            >
              <div className="text-center">
                <OliLogoStacked iconSize={88} wordmarkSize={40} />
                <p className="text-h3 mt-6 font-display">Your AI meeting memory.</p>
                <p className="text-body text-ink-secondary mt-1 max-w-md mx-auto">
                  Oli listens, captures, and turns conversations into clear notes, decisions, and action items.
                </p>
                <p className="text-caption text-ink-muted mt-4">
                  <kbd className="font-mono px-1.5 py-0.5 rounded bg-white border border-line">Ctrl+N</kbd>{' '}
                  new meeting ·{' '}
                  <kbd className="font-mono px-1.5 py-0.5 rounded bg-white border border-line">Ctrl+K</kbd>{' '}
                  command palette
                </p>
              </div>
            </section>
          )}
        </Panel>
      </PanelGroup>

      <SearchBar openSignal={searchSignal} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSwitchView={setView}
      />
      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}
      <ConfirmDialog
        open={aboutOpen}
        title="Oli"
        message={`Local-first AI meeting memory + email rephraser for Windows.\n\nVersion ${appVersion || '1.1.0'}\nhttps://github.com/niithinlk-hub/oli`}
        confirmLabel="OK"
        onConfirm={() => setAboutOpen(false)}
        onCancel={() => setAboutOpen(false)}
      />
    </div>
  );
}
