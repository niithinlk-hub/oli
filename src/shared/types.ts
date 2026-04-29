export type MeetingStatus = 'idle' | 'recording' | 'transcribing' | 'enhancing' | 'done' | 'error';

export interface Meeting {
  id: string;
  title: string;
  startedAt: number;
  endedAt: number | null;
  status: MeetingStatus;
  calendarEventId: string | null;
  templateId: string | null;
  audioPath: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface TranscriptSegment {
  id: number;
  meetingId: string;
  startMs: number;
  endMs: number;
  text: string;
  source: 'system' | 'mic' | 'mixed';
}

export interface NoteDoc {
  meetingId: string;
  rawMarkdown: string;
  enhancedMarkdown: string | null;
  updatedAt: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  builtIn: boolean;
}

export interface CalendarEvent {
  id: string;
  provider: 'google' | 'outlook' | 'ics';
  externalId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  attendees: string[];
  meetingUrl: string | null;
}

export interface RecordingStartArgs {
  meetingId: string;
  sampleRate: 16000;
  channels: 1;
}

export interface RecordingChunkMeta {
  meetingId: string;
  sequence: number;
  source: 'mixed';
  sampleCount: number;
  startMs: number;
}

export interface RecordingStopResult {
  meetingId: string;
  audioPath: string;
  durationMs: number;
  totalSamples: number;
}

export type TranscriptSource = 'system' | 'mic' | 'mixed';

export interface PartialTranscriptEvent {
  meetingId: string;
  startMs: number;
  endMs: number;
  text: string;
  source: TranscriptSource;
  isPartial: boolean;
}

export interface AppSettings {
  whisperBinaryPath: string | null;
  whisperModelPath: string | null;
  openAiKeyPresent: boolean;
}
