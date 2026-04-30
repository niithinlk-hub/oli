import { ipcMain } from 'electron';
import { meetingsRepo, notesRepo, transcriptRepo } from '../db/repo';
import {
  enhance,
  ask,
  validateKey,
  setProviderKey,
  deleteProviderKey,
  hasProviderKey,
  maskedProviderKey,
  getActiveProvider,
  setActiveProvider,
  listProviderStatus,
  getModelOverride,
  setModelOverride,
  PROVIDERS,
  LlmNotConfiguredError,
  type ProviderId
} from '../llm/providers';
import { getTemplate, listTemplates } from '../llm/templates';
import { htmlToMarkdown } from '../llm/html-to-markdown';

export function registerLlmIpc(): void {
  ipcMain.handle('templates:list', () => listTemplates());

  // Backwards-compat aliases that map onto the OpenAI provider.
  ipcMain.handle('settings:setOpenAiKey', async (_e, key: string | null) => {
    if (!key) {
      await deleteProviderKey('openai');
      return { ok: true, message: 'API key removed.' };
    }
    const v = await validateKey('openai', key);
    if (!v.ok) return { ok: false, message: `Invalid API key: ${v.message ?? 'auth probe failed'}` };
    await setProviderKey('openai', key);
    return { ok: true, message: 'API key saved.' };
  });
  ipcMain.handle('settings:hasOpenAiKey', () => hasProviderKey('openai'));
  ipcMain.handle('settings:getOpenAiKeyMasked', () => maskedProviderKey('openai'));

  // Multi-provider IPC.
  ipcMain.handle('llm:listProviders', () => listProviderStatus());
  ipcMain.handle('llm:getActiveProvider', () => getActiveProvider());
  ipcMain.handle('llm:setActiveProvider', (_e, p: ProviderId) => {
    if (!(p in PROVIDERS)) throw new Error(`unknown provider: ${p}`);
    setActiveProvider(p);
  });
  ipcMain.handle('llm:setProviderKey', async (_e, p: ProviderId, key: string | null) => {
    if (!(p in PROVIDERS)) throw new Error(`unknown provider: ${p}`);
    if (!key) {
      await deleteProviderKey(p);
      return { ok: true, message: 'API key removed.' };
    }
    const v = await validateKey(p, key);
    if (!v.ok) return { ok: false, message: `Invalid API key: ${v.message ?? 'auth probe failed'}` };
    await setProviderKey(p, key);
    return { ok: true, message: 'API key saved.' };
  });
  ipcMain.handle('llm:getModelOverride', (_e, p: ProviderId) => getModelOverride(p));
  ipcMain.handle('llm:setModelOverride', (_e, p: ProviderId, model: string | null) =>
    setModelOverride(p, model)
  );
  ipcMain.handle('llm:getMaskedKey', (_e, p: ProviderId) => maskedProviderKey(p));

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
        if (err instanceof LlmNotConfiguredError) {
          return { ok: false, message: err.message };
        }
        return { ok: false, message: (err as Error).message };
      }
    }
  );

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
        if (err instanceof LlmNotConfiguredError) return { ok: false, message: err.message };
        return { ok: false, message: (err as Error).message };
      }
    }
  );
}
