import { create } from 'zustand';

/**
 * Renderer UI preferences. Persists through `window.floyd.settings.{getUi,setUi}`
 * so values survive across launches (no localStorage — main owns the truth).
 *
 * On boot, call `hydrate()` once to pull saved values from main; afterwards
 * setters fire-and-forget the persist call.
 */
export type SidebarMode = 'expanded' | 'rail';

interface UiPrefsState {
  sidebarMode: SidebarMode;
  sidebarPx: number;
  meetingTranscriptPct: number;
  recentActions: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSidebarMode: (m: SidebarMode) => void;
  setSidebarPx: (n: number) => void;
  setMeetingTranscriptPct: (n: number) => void;
  pushRecentAction: (id: string) => void;
}

const KEYS = {
  sidebarMode: 'ui.sidebar.mode',
  sidebarPx: 'ui.layout.sidebarPx',
  meetingTranscriptPct: 'ui.layout.meetingTranscriptPct',
  recentActions: 'ui.commandPalette.recent'
} as const;

const DEFAULTS = {
  sidebarMode: 'expanded' as SidebarMode,
  sidebarPx: 320,
  meetingTranscriptPct: 50
};

export const useUiPrefs = create<UiPrefsState>((set, get) => ({
  sidebarMode: DEFAULTS.sidebarMode,
  sidebarPx: DEFAULTS.sidebarPx,
  meetingTranscriptPct: DEFAULTS.meetingTranscriptPct,
  recentActions: [],
  hydrated: false,

  async hydrate() {
    const [mode, px, pct, recent] = await Promise.all([
      window.floyd.settings.getUi(KEYS.sidebarMode),
      window.floyd.settings.getUi(KEYS.sidebarPx),
      window.floyd.settings.getUi(KEYS.meetingTranscriptPct),
      window.floyd.settings.getUi(KEYS.recentActions)
    ]);
    set({
      sidebarMode: mode === 'rail' ? 'rail' : 'expanded',
      sidebarPx: px ? Math.max(56, Math.min(560, parseInt(px, 10) || DEFAULTS.sidebarPx)) : DEFAULTS.sidebarPx,
      meetingTranscriptPct: pct
        ? Math.max(20, Math.min(80, parseInt(pct, 10) || DEFAULTS.meetingTranscriptPct))
        : DEFAULTS.meetingTranscriptPct,
      recentActions: recent ? safeParse<string[]>(recent) ?? [] : [],
      hydrated: true
    });
  },

  setSidebarMode(m) {
    set({ sidebarMode: m });
    void window.floyd.settings.setUi(KEYS.sidebarMode, m);
  },

  setSidebarPx(n) {
    const clamped = Math.max(56, Math.min(560, Math.round(n)));
    set({ sidebarPx: clamped });
    void window.floyd.settings.setUi(KEYS.sidebarPx, String(clamped));
  },

  setMeetingTranscriptPct(n) {
    const clamped = Math.max(20, Math.min(80, Math.round(n)));
    set({ meetingTranscriptPct: clamped });
    void window.floyd.settings.setUi(KEYS.meetingTranscriptPct, String(clamped));
  },

  pushRecentAction(id) {
    const next = [id, ...get().recentActions.filter((x) => x !== id)].slice(0, 5);
    set({ recentActions: next });
    void window.floyd.settings.setUi(KEYS.recentActions, JSON.stringify(next));
  }
}));

function safeParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
