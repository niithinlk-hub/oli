import { create } from 'zustand';
import type { Meeting } from '@shared/types';

interface MeetingsStore {
  meetings: Meeting[];
  selectedId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  select: (id: string | null) => void;
  createMeeting: (title: string) => Promise<Meeting>;
  deleteMeeting: (id: string) => Promise<void>;
}

export const useMeetingsStore = create<MeetingsStore>((set, get) => ({
  meetings: [],
  selectedId: null,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    const meetings = await window.floyd.meetings.list();
    set({ meetings, loading: false });
  },
  select: (id) => set({ selectedId: id }),
  createMeeting: async (title) => {
    const m = await window.floyd.meetings.create(title);
    await get().refresh();
    set({ selectedId: m.id });
    return m;
  },
  deleteMeeting: async (id) => {
    try {
      await window.floyd.meetings.delete(id);
    } catch (err) {
      window.alert((err as Error).message ?? 'Failed to delete meeting');
      return;
    }
    if (get().selectedId === id) set({ selectedId: null });
    await get().refresh();
  }
}));
