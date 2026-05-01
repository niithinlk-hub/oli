import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  AppSettings,
  CalendarEvent,
  Meeting,
  NoteDoc,
  PartialTranscriptEvent,
  RecordingStartArgs,
  RecordingStopResult,
  Template,
  TranscriptSegment
} from '../shared/types';

const api = {
  meetings: {
    list: (): Promise<Meeting[]> => ipcRenderer.invoke('meetings:list'),
    get: (id: string): Promise<Meeting | null> => ipcRenderer.invoke('meetings:get', id),
    create: (title: string): Promise<Meeting> => ipcRenderer.invoke('meetings:create', title),
    update: (id: string, patch: Partial<Meeting>): Promise<Meeting> =>
      ipcRenderer.invoke('meetings:update', id, patch),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('meetings:delete', id),
    search: (
      q: string
    ): Promise<
      { meeting: Meeting; snippet: string; matchType: 'title' | 'notes' | 'transcript' }[]
    > => ipcRenderer.invoke('meetings:search', q),
    exportMarkdown: (
      meetingId: string
    ): Promise<{ ok: boolean; path?: string; message?: string }> =>
      ipcRenderer.invoke('meetings:exportMarkdown', meetingId)
  },
  transcript: {
    list: (meetingId: string): Promise<TranscriptSegment[]> =>
      ipcRenderer.invoke('transcript:list', meetingId),
    onPartial: (cb: (event: PartialTranscriptEvent) => void) => {
      const handler = (_e: IpcRendererEvent, payload: PartialTranscriptEvent) => cb(payload);
      ipcRenderer.on('transcript:partial', handler);
      return () => ipcRenderer.removeListener('transcript:partial', handler);
    },
    onFinal: (cb: (payload: { meetingId: string; segments: number }) => void) => {
      const handler = (_e: IpcRendererEvent, payload: { meetingId: string; segments: number }) =>
        cb(payload);
      ipcRenderer.on('transcript:final', handler);
      return () => ipcRenderer.removeListener('transcript:final', handler);
    }
  },
  notes: {
    get: (meetingId: string): Promise<NoteDoc | null> => ipcRenderer.invoke('notes:get', meetingId),
    save: (meetingId: string, raw: string): Promise<void> =>
      ipcRenderer.invoke('notes:save', meetingId, raw)
  },
  recording: {
    start: (args: RecordingStartArgs): Promise<{ audioPath: string }> =>
      ipcRenderer.invoke('recording:start', args),
    nativeAvailable: (): Promise<boolean> => ipcRenderer.invoke('recording:native-available'),
    startNative: (meetingId: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('recording:start-native', meetingId),
    chunk: (meetingId: string, samples: Float32Array): Promise<void> => {
      const buf = samples.buffer.slice(samples.byteOffset, samples.byteOffset + samples.byteLength);
      return ipcRenderer.invoke('recording:chunk', meetingId, buf);
    },
    micChunk: (meetingId: string, samples: Float32Array): Promise<void> => {
      const buf = samples.buffer.slice(samples.byteOffset, samples.byteOffset + samples.byteLength);
      return ipcRenderer.invoke('recording:mic-chunk', meetingId, buf);
    },
    stopNative: (meetingId?: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('recording:stop-native', meetingId),
    stop: (opts?: { runFinalPass?: boolean }): Promise<RecordingStopResult | null> =>
      ipcRenderer.invoke('recording:stop', opts ?? {}),
    isActive: (): Promise<boolean> => ipcRenderer.invoke('recording:active'),
    onError: (cb: (payload: { meetingId: string; message: string }) => void) => {
      const handler = (_e: IpcRendererEvent, payload: { meetingId: string; message: string }) =>
        cb(payload);
      ipcRenderer.on('recording:error', handler);
      return () => ipcRenderer.removeListener('recording:error', handler);
    },
    onInflight: (cb: (payload: { inflight: number; queued: number }) => void) => {
      const handler = (_e: IpcRendererEvent, payload: { inflight: number; queued: number }) =>
        cb(payload);
      ipcRenderer.on('recording:inflight', handler);
      return () => ipcRenderer.removeListener('recording:inflight', handler);
    }
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    setWhisperBinary: (path: string | null): Promise<void> =>
      ipcRenderer.invoke('settings:setWhisperBinary', path),
    setWhisperModel: (path: string | null): Promise<void> =>
      ipcRenderer.invoke('settings:setWhisperModel', path),
    pickFile: (opts: {
      title: string;
      filters?: { name: string; extensions: string[] }[];
    }): Promise<string | null> => ipcRenderer.invoke('settings:pickFile', opts),
    setOpenAiKey: (key: string | null): Promise<{ ok: boolean; message: string }> =>
      ipcRenderer.invoke('settings:setOpenAiKey', key),
    hasOpenAiKey: (): Promise<boolean> => ipcRenderer.invoke('settings:hasOpenAiKey'),
    getOpenAiKeyMasked: (): Promise<string | null> =>
      ipcRenderer.invoke('settings:getOpenAiKeyMasked'),
    /** Read a UI pref. Key must be prefixed `ui.` */
    getUi: (key: string): Promise<string | null> => ipcRenderer.invoke('settings:getUi', key),
    /** Persist a UI pref. Key must be prefixed `ui.` Pass null to clear. */
    setUi: (key: string, value: string | null): Promise<void> =>
      ipcRenderer.invoke('settings:setUi', key, value)
  },
  llm: {
    listTemplates: (): Promise<Template[]> => ipcRenderer.invoke('templates:list'),
    enhance: (args: {
      meetingId: string;
      templateId: string;
    }): Promise<{ ok: boolean; markdown?: string; message?: string }> =>
      ipcRenderer.invoke('llm:enhance', args),
    ask: (args: {
      meetingId: string;
      question: string;
      history: { role: 'user' | 'assistant'; content: string }[];
    }): Promise<{ ok: boolean; markdown?: string; message?: string }> =>
      ipcRenderer.invoke('llm:ask', args),
    rephraseEmail: (args: {
      originalText: string;
      tone:
        | 'professional'
        | 'friendly'
        | 'concise'
        | 'persuasive'
        | 'apologetic'
        | 'assertive'
        | 'neutral';
      intent: 'rephrase' | 'reply' | 'shorten' | 'lengthen' | 'fix-grammar' | 'translate-en';
      contextNote?: string;
    }): Promise<{ ok: boolean; text?: string; message?: string }> =>
      ipcRenderer.invoke('llm:rephraseEmail', args),
    listProviders: (): Promise<
      { id: string; label: string; configured: boolean; model: string }[]
    > => ipcRenderer.invoke('llm:listProviders'),
    getActiveProvider: (): Promise<string> => ipcRenderer.invoke('llm:getActiveProvider'),
    setActiveProvider: (id: string): Promise<void> =>
      ipcRenderer.invoke('llm:setActiveProvider', id),
    setProviderKey: (
      id: string,
      key: string | null
    ): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke('llm:setProviderKey', id, key),
    getModelOverride: (id: string): Promise<string | null> =>
      ipcRenderer.invoke('llm:getModelOverride', id),
    setModelOverride: (id: string, model: string | null): Promise<void> =>
      ipcRenderer.invoke('llm:setModelOverride', id, model),
    getMaskedKey: (id: string): Promise<string | null> =>
      ipcRenderer.invoke('llm:getMaskedKey', id)
  },
  stt: {
    get: (): Promise<{
      provider: 'local' | 'groq';
      groqModel: string;
      chunkSeconds: number;
      concurrency: number;
      groqKeyConfigured: boolean;
    }> => ipcRenderer.invoke('stt:get'),
    setProvider: (p: 'local' | 'groq'): Promise<void> => ipcRenderer.invoke('stt:setProvider', p),
    setGroqModel: (m: string | null): Promise<void> => ipcRenderer.invoke('stt:setGroqModel', m),
    setChunkSeconds: (n: number | null): Promise<void> =>
      ipcRenderer.invoke('stt:setChunkSeconds', n),
    setConcurrency: (n: number | null): Promise<void> =>
      ipcRenderer.invoke('stt:setConcurrency', n),
    listGroqModels: (): Promise<{ id: string; label: string; note: string }[]> =>
      ipcRenderer.invoke('stt:listGroqModels'),
    pingGroq: (model: string | null): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke('stt:pingGroq', model)
  },
  whisper: {
    listCatalog: (): Promise<
      { id: string; label: string; bytes: number; description: string }[]
    > => ipcRenderer.invoke('whisper:listCatalog'),
    listInstalled: (): Promise<string[]> => ipcRenderer.invoke('whisper:listInstalled'),
    downloadModel: (modelId: string): Promise<{ ok: boolean; path?: string; message?: string }> =>
      ipcRenderer.invoke('whisper:downloadModel', modelId),
    cancelDownload: (modelId: string): Promise<void> =>
      ipcRenderer.invoke('whisper:cancelDownload', modelId),
    deleteModel: (modelId: string): Promise<void> =>
      ipcRenderer.invoke('whisper:deleteModel', modelId),
    selectModel: (modelId: string): Promise<void> =>
      ipcRenderer.invoke('whisper:selectModel', modelId),
    onProgress: (
      cb: (p: { modelId: string; loaded: number; total: number; percent: number }) => void
    ) => {
      const handler = (
        _e: IpcRendererEvent,
        p: { modelId: string; loaded: number; total: number; percent: number }
      ) => cb(p);
      ipcRenderer.on('whisper:download-progress', handler);
      return () => ipcRenderer.removeListener('whisper:download-progress', handler);
    }
  },
  menu: {
    on: (channel:
      | 'menu:new-meeting'
      | 'menu:save-notes'
      | 'menu:export-meeting'
      | 'menu:search'
      | 'menu:toggle-record'
      | 'menu:ask-oli'
      | 'menu:delete-meeting'
      | 'menu:about'
      | 'menu:brand'
      | 'menu:settings',
    cb: () => void
    ) => {
      const handler = () => cb();
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    }
  },
  calendar: {
    status: (): Promise<{
      googleConnected: boolean;
      googleClientId: string | null;
      outlookConnected: boolean;
      outlookClientId: string | null;
    }> => ipcRenderer.invoke('calendar:status'),
    setGoogleClientId: (clientId: string | null): Promise<void> =>
      ipcRenderer.invoke('calendar:setGoogleClientId', clientId),
    connectGoogle: (): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke('calendar:connectGoogle'),
    disconnectGoogle: (): Promise<void> => ipcRenderer.invoke('calendar:disconnectGoogle'),
    setOutlookClientId: (clientId: string | null): Promise<void> =>
      ipcRenderer.invoke('calendar:setOutlookClientId', clientId),
    connectOutlook: (): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke('calendar:connectOutlook'),
    disconnectOutlook: (): Promise<void> => ipcRenderer.invoke('calendar:disconnectOutlook'),
    importIcs: (): Promise<{ ok: boolean; imported?: number; message?: string }> =>
      ipcRenderer.invoke('calendar:importIcs'),
    upcoming: (withinMs?: number): Promise<CalendarEvent[]> =>
      ipcRenderer.invoke('calendar:upcoming', withinMs),
    forDay: (dayMs: number): Promise<CalendarEvent[]> =>
      ipcRenderer.invoke('calendar:forDay', dayMs),
    refresh: (): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke('calendar:refresh'),
    setEventOverride: (eventId: string, override: boolean | null): Promise<void> =>
      ipcRenderer.invoke('calendar:setEventOverride', eventId, override),
    /** ICS URL / folder / Outlook COM subscriptions. */
    subs: {
      list: (): Promise<
        {
          id: string;
          kind: 'ics-url' | 'ics-folder' | 'outlook-com';
          name: string;
          url: string | null;
          folderPath: string | null;
          color: string | null;
          pollMinutes: number;
          enabled: boolean;
          lastSyncedAt: number | null;
          lastError: string | null;
        }[]
      > => ipcRenderer.invoke('calendar:subs:list'),
      add: (input: {
        kind: 'ics-url' | 'ics-folder' | 'outlook-com';
        name: string;
        url?: string | null;
        folderPath?: string | null;
        color?: string | null;
        pollMinutes?: number;
      }): Promise<unknown> => ipcRenderer.invoke('calendar:subs:add', input),
      update: (id: string, patch: unknown): Promise<unknown> =>
        ipcRenderer.invoke('calendar:subs:update', id, patch),
      remove: (id: string): Promise<void> => ipcRenderer.invoke('calendar:subs:remove', id),
      sync: (id: string): Promise<{ ok: boolean; count?: number; message?: string }> =>
        ipcRenderer.invoke('calendar:subs:sync', id)
    },
    outlookComAvailable: (): Promise<boolean> => ipcRenderer.invoke('calendar:outlookComAvailable'),
    defaultFolderPath: (): Promise<string> => ipcRenderer.invoke('calendar:defaultFolderPath'),
    autoRecord: {
      get: (): Promise<'off' | 'prompt' | 'auto'> => ipcRenderer.invoke('calendar:autoRecord:get'),
      set: (mode: 'off' | 'prompt' | 'auto'): Promise<void> =>
        ipcRenderer.invoke('calendar:autoRecord:set', mode)
    },
    onUpdated: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('calendar:updated', handler);
      return () => ipcRenderer.removeListener('calendar:updated', handler);
    },
    onNotifyClicked: (cb: (payload: { event: CalendarEvent }) => void) => {
      const handler = (_e: IpcRendererEvent, payload: { event: CalendarEvent }) => cb(payload);
      ipcRenderer.on('calendar:notify-clicked', handler);
      return () => ipcRenderer.removeListener('calendar:notify-clicked', handler);
    },
    onAutoRecordStart: (cb: (payload: { event: CalendarEvent }) => void) => {
      const handler = (_e: IpcRendererEvent, payload: { event: CalendarEvent }) => cb(payload);
      ipcRenderer.on('calendar:auto-record-start', handler);
      return () => ipcRenderer.removeListener('calendar:auto-record-start', handler);
    }
  },
  mini: {
    show: (): Promise<void> => ipcRenderer.invoke('mini:show'),
    close: (): Promise<void> => ipcRenderer.invoke('mini:close'),
    isOpen: (): Promise<boolean> => ipcRenderer.invoke('mini:isOpen'),
    /** Main window calls this on minimize so mini opens iff recording is active. */
    openIfRecording: (recording: boolean): Promise<void> =>
      ipcRenderer.invoke('mini:openIfRecording', recording),
    /** Mini window's stop button. */
    toggleRecord: (): void => ipcRenderer.send('mini:toggle-record'),
    /** Forward an amplitude tick from the main window into the mini renderer. */
    sendAmplitude: (payload: { mic: number; loopback: number; bars: number[] }): void =>
      ipcRenderer.send('mini:amplitude', payload),
    onAmplitude: (cb: (p: { mic: number; loopback: number; bars: number[] }) => void) => {
      const handler = (_e: IpcRendererEvent, p: { mic: number; loopback: number; bars: number[] }) =>
        cb(p);
      ipcRenderer.on('mini:amplitude', handler);
      return () => ipcRenderer.removeListener('mini:amplitude', handler);
    },
    onRequestOpenOnHide: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('app:request-mini-on-hide', handler);
      return () => ipcRenderer.removeListener('app:request-mini-on-hide', handler);
    }
  },
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    checkForUpdates: (): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke('app:checkForUpdates'),
    onUpdateAvailable: (cb: (info: { version: string }) => void) => {
      const handler = (_e: IpcRendererEvent, info: { version: string }) => cb(info);
      ipcRenderer.on('app:update-available', handler);
      return () => ipcRenderer.removeListener('app:update-available', handler);
    },
    onUpdateDownloaded: (cb: (info: { version: string }) => void) => {
      const handler = (_e: IpcRendererEvent, info: { version: string }) => cb(info);
      ipcRenderer.on('app:update-downloaded', handler);
      return () => ipcRenderer.removeListener('app:update-downloaded', handler);
    }
  }
};

contextBridge.exposeInMainWorld('floyd', api);

export type FloydApi = typeof api;
