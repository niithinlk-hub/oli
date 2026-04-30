import { ipcMain } from 'electron';
import { meetingsRepo, notesRepo, transcriptRepo } from '../db/repo';
import { enhance, ask, validateKey, OpenAiNotConfiguredError } from '../llm/openai-client';
import { getTemplate, listTemplates } from '../llm/templates';
import { htmlToMarkdown } from '../llm/html-to-markdown';
import { setSecret, getSecret, deleteSecret, hasSecret, SECRET_NAMES } from '../secrets';

export function registerLlmIpc(): void {
  ipcMain.handle('templates:list', () => listTemplates());

  ipcMain.handle('settings:setOpenAiKey', async (_e, key: string | null) => {
    if (!key) {
      await deleteSecret(SECRET_NAMES.openAiKey);
      return { ok: true, message: 'API key removed.' };
    }
    const v = await validateKey(key);
    if (!v.ok) return { ok: false, message: `Invalid API key: ${v.message ?? 'auth probe failed'}` };
    await setSecret(SECRET_NAMES.openAiKey, key);
    return { ok: true, message: 'API key saved.' };
  });

  ipcMain.handle('settings:hasOpenAiKey', () => hasSecret(SECRET_NAMES.openAiKey));

  ipcMain.handle(
    'llm:enhance',
    async (_e, args: { meetingId: string; templateId: string }) => {
      const meeting = meetingsRepo.get(args.meetingId);
      if (!meeting) throw new Error(`meeting ${args.meetingId} not found`);
      const template = getTemplate(args.templateId);
      if (!template) throw new Error(`template ${args.templateId} not found`);

      const segments = transcriptRepo.list(args.meetingId);
      const transcript = segments.map((s) => s.text).join('\n');
      const note = notesRepo.get(args.meetingId);

      meetingsRepo.update(args.meetingId, { status: 'enhancing', templateId: args.templateId });

      try {
        const md = await enhance({
          systemPrompt: template.systemPrompt,
          transcript,
          userNotesMarkdown: htmlToMarkdown(note?.rawMarkdown ?? ''),
          meetingTitle: meeting.title
        });
        notesRepo.saveEnhanced(args.meetingId, md);
        meetingsRepo.update(args.meetingId, { status: 'done' });
        return { ok: true, markdown: md };
      } catch (err) {
        meetingsRepo.update(args.meetingId, { status: 'done' });
        if (err instanceof OpenAiNotConfiguredError) {
          return { ok: false, message: err.message };
        }
        return { ok: false, message: (err as Error).message };
      }
    }
  );

  // Re-expose for the secret variant — settings.ts already covers whisper paths
  ipcMain.handle('settings:openAiKeyExists', async () => {
    return hasSecret(SECRET_NAMES.openAiKey);
  });

  ipcMain.handle('settings:getOpenAiKeyMasked', async () => {
    const key = await getSecret(SECRET_NAMES.openAiKey);
    if (!key) return null;
    return `${key.slice(0, 3)}…${key.slice(-4)}`;
  });

  ipcMain.handle(
    'llm:ask',
    async (
      _e,
      args: { meetingId: string; question: string; history: { role: 'user' | 'assistant'; content: string }[] }
    ) => {
      const meeting = meetingsRepo.get(args.meetingId);
      if (!meeting) throw new Error(`meeting ${args.meetingId} not found`);
      const segments = transcriptRepo.list(args.meetingId);
      const transcript = segments.map((s) => s.text).join('\n');
      const note = notesRepo.get(args.meetingId);
      try {
        const md = await ask({
          meetingTitle: meeting.title,
          transcript,
          userNotesMarkdown: htmlToMarkdown(note?.rawMarkdown ?? ''),
          enhancedMarkdown: note?.enhancedMarkdown ?? null,
          history: args.history,
          question: args.question
        });
        return { ok: true, markdown: md };
      } catch (err) {
        if (err instanceof OpenAiNotConfiguredError) return { ok: false, message: err.message };
        return { ok: false, message: (err as Error).message };
      }
    }
  );
}
