/**
 * Phase 3 AI IPC handlers — diarization, structured extraction, embeddings,
 * Ask conversations.
 *
 * Channel naming:
 *   diar:*       — speaker diarization
 *   structured:* — decisions / action items / topics
 *   embed:*      — embeddings index ops
 *   search:*     — semantic search
 *   ask:*        — Ask my meetings chat
 */
import { ipcMain } from 'electron';
import {
  diarizeMeeting,
  getDiarizationProvider,
  setDiarizationProvider,
  setAssemblyAiKey,
  hasAssemblyAiKey,
  speakersRepo,
  type DiarizationProvider
} from '../diarization';
import { extractStructured, type StructuredOutput } from '../llm/providers';
import {
  decisionsRepo,
  actionItemsRepo,
  topicsRepo
} from '../db/structured';
import { meetingsRepo, transcriptRepo, notesRepo } from '../db/repo';
import { htmlToMarkdown } from '../llm/html-to-markdown';
import {
  reindexMeeting,
  reindexAll,
  searchEmbeddings,
  getEmbedProvider,
  setEmbedProvider
} from '../embeddings';
import type { EmbedProvider } from '../llm/providers';
import { askRepo, askMeetings } from '../ask';

export function registerAiIpc(): void {
  /* Diarization */
  ipcMain.handle('diar:status', async () => ({
    provider: getDiarizationProvider(),
    keyConfigured: await hasAssemblyAiKey()
  }));
  ipcMain.handle('diar:setProvider', (_e, p: DiarizationProvider) => setDiarizationProvider(p));
  ipcMain.handle('diar:setKey', async (_e, key: string | null) => {
    await setAssemblyAiKey(key);
    return { ok: true };
  });
  ipcMain.handle('diar:run', async (_e, meetingId: string) => {
    try {
      return await diarizeMeeting(meetingId);
    } catch (err) {
      return { ok: false, speakers: 0, message: (err as Error).message };
    }
  });
  ipcMain.handle('diar:listSpeakers', (_e, meetingId: string) => speakersRepo.list(meetingId));
  ipcMain.handle('diar:rename', (_e, meetingId: string, rawLabel: string, displayName: string) =>
    speakersRepo.rename(meetingId, rawLabel, displayName)
  );

  /* Structured extraction */
  ipcMain.handle('structured:extract', async (_e, meetingId: string) => {
    const meeting = meetingsRepo.get(meetingId);
    if (!meeting) return { ok: false, message: 'meeting not found' };
    const segments = transcriptRepo.list(meetingId);
    const transcript = segments.map((s) => s.text).join('\n');
    const note = notesRepo.get(meetingId);
    try {
      const out: StructuredOutput = await extractStructured({
        meetingTitle: meeting.title,
        transcript,
        userNotesMarkdown: htmlToMarkdown(note?.rawMarkdown ?? '')
      });
      decisionsRepo.replace(meetingId, out.decisions ?? []);
      actionItemsRepo.replace(meetingId, out.actionItems ?? []);
      topicsRepo.replace(meetingId, out.topics ?? []);
      return { ok: true, structured: out };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  });
  ipcMain.handle('structured:list', (_e, meetingId: string) => ({
    decisions: decisionsRepo.list(meetingId),
    actionItems: actionItemsRepo.list(meetingId),
    topics: topicsRepo.list(meetingId)
  }));
  ipcMain.handle('structured:setActionDone', (_e, id: number, done: boolean) =>
    actionItemsRepo.setDone(id, done)
  );

  /* Embeddings */
  ipcMain.handle('embed:status', () => ({ provider: getEmbedProvider() }));
  ipcMain.handle('embed:setProvider', (_e, p: EmbedProvider) => setEmbedProvider(p));
  ipcMain.handle('embed:reindexMeeting', async (_e, meetingId: string) => {
    try {
      return await reindexMeeting(meetingId);
    } catch (err) {
      return { count: 0, message: (err as Error).message };
    }
  });
  ipcMain.handle('embed:reindexAll', async () => {
    try {
      return await reindexAll();
    } catch (err) {
      return { meetings: 0, chunks: 0, message: (err as Error).message };
    }
  });

  /* Semantic search */
  ipcMain.handle('search:semantic', async (_e, query: string, k: number = 8) => {
    try {
      return { ok: true, hits: await searchEmbeddings(query, k) };
    } catch (err) {
      return { ok: false, hits: [], message: (err as Error).message };
    }
  });

  /* Ask conversations */
  ipcMain.handle('ask:listConversations', () => askRepo.listConversations());
  ipcMain.handle('ask:createConversation', (_e, title: string) =>
    askRepo.createConversation(title)
  );
  ipcMain.handle('ask:deleteConversation', (_e, id: string) => askRepo.deleteConversation(id));
  ipcMain.handle('ask:listMessages', (_e, conversationId: string) =>
    askRepo.listMessages(conversationId)
  );
  ipcMain.handle('ask:send', async (_e, conversationId: string, question: string) => {
    try {
      const r = await askMeetings(conversationId, question);
      return { ok: true, message: r.message };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  });
}
