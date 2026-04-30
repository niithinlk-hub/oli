import { ipcMain } from 'electron';
import {
  getSttProvider,
  setSttProvider,
  getGroqModel,
  setGroqModel,
  getChunkSeconds,
  setChunkSeconds,
  getConcurrency,
  setConcurrency,
  type SttProvider
} from '../stt';
import { GROQ_MODELS, pingGroqStt } from '../stt/groq';
import { hasProviderKey } from '../llm/providers';

export interface SttConfig {
  provider: SttProvider;
  groqModel: string;
  chunkSeconds: number;
  concurrency: number;
  groqKeyConfigured: boolean;
}

export function registerSttIpc(): void {
  ipcMain.handle('stt:get', async (): Promise<SttConfig> => {
    return {
      provider: getSttProvider(),
      groqModel: getGroqModel(),
      chunkSeconds: getChunkSeconds(),
      concurrency: getConcurrency(),
      groqKeyConfigured: await hasProviderKey('groq')
    };
  });

  ipcMain.handle('stt:setProvider', (_e, p: SttProvider) => {
    if (p !== 'local' && p !== 'groq') throw new Error(`unknown stt provider: ${p}`);
    setSttProvider(p);
  });

  ipcMain.handle('stt:setGroqModel', (_e, model: string | null) => setGroqModel(model));
  ipcMain.handle('stt:setChunkSeconds', (_e, n: number | null) => setChunkSeconds(n));
  ipcMain.handle('stt:setConcurrency', (_e, n: number | null) => setConcurrency(n));

  ipcMain.handle('stt:listGroqModels', () => GROQ_MODELS);
  ipcMain.handle('stt:pingGroq', async (_e, model: string | null) =>
    pingGroqStt(model ?? undefined)
  );
}
