import { useEffect, useState } from 'react';
import { MeetingList } from './components/MeetingList';
import { MeetingDetail } from './pages/MeetingDetail';
import { Settings } from './pages/Settings';
import { Brand } from './pages/Brand';
import { Onboarding, shouldShowOnboarding } from './pages/Onboarding';
import { UpcomingEvents } from './components/UpcomingEvents';
import { SearchBar } from './components/SearchBar';
import { useMeetingsStore } from './store/meetings';
import { OliLogoStacked } from './components/brand/OliLogoStacked';

type View = 'meeting' | 'settings' | 'brand';

export default function App() {
  const selectedId = useMeetingsStore((s) => s.selectedId);
  const createMeeting = useMeetingsStore((s) => s.createMeeting);
  const [view, setView] = useState<View>('meeting');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchSignal, setSearchSignal] = useState(0);

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
    const offSearch = window.floyd.menu.on('menu:search', () =>
      setSearchSignal((n) => n + 1)
    );
    const offSettings = window.floyd.menu.on('menu:settings', () => setView('settings'));
    const offBrand = window.floyd.menu.on('menu:brand', () => setView('brand'));
    return () => {
      offNew();
      offSearch();
      offSettings();
      offBrand();
    };
  }, [createMeeting]);

  return (
    <div className="h-screen flex bg-surface-cloud text-ink-primary">
      <MeetingList
        onOpenSettings={() => setView('settings')}
        onOpenBrand={() => setView('brand')}
        onOpenSearch={() => setSearchSignal((n) => n + 1)}
        upcomingSlot={<UpcomingEvents />}
      />
      {view === 'settings' ? (
        <Settings onClose={() => setView('meeting')} />
      ) : view === 'brand' ? (
        <Brand onClose={() => setView('meeting')} />
      ) : selectedId ? (
        <MeetingDetail meetingId={selectedId} />
      ) : (
        <section
          className="flex-1 flex items-center justify-center"
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
              <kbd className="font-mono px-1.5 py-0.5 rounded bg-white border border-line">Ctrl+F</kbd>{' '}
              search memory
            </p>
          </div>
        </section>
      )}

      <SearchBar openSignal={searchSignal} />
      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}
    </div>
  );
}
