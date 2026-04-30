import { ipcMain, dialog, BrowserWindow } from 'electron';
import { settingsRepo, SETTINGS_KEYS } from '../db/settings';
import { defaultWhisperBinary, defaultWhisperModel } from '../whisper/worker';
import {
  MODEL_CATALOG,
  broadcastProgress,
  deleteModel,
  downloadModel,
  listInstalledModels,
  modelFilePath,
  selectInstalledAsDefault
} from '../whisper/models';
import type { AppSettings } from '@shared/types';

const activeDownloads = new Map<string, AbortController>();

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (): AppSettings => {
    return {
      whisperBinaryPath: settingsRepo.get(SETTINGS_KEYS.whisperBinary),
      whisperModelPath: settingsRepo.get(SETTINGS_KEYS.whisperModel),
      whisperBinaryDefault: defaultWhisperBinary(),
      whisperModelDefault: defaultWhisperModel(),
      openAiKeyPresent: settingsRepo.get(SETTINGS_KEYS.openAiKeyPresent) === '1'
    };
  });

  ipcMain.handle('settings:setWhisperBinary', (_e, path: string | null) => {
    if (path) settingsRepo.set(SETTINGS_KEYS.whisperBinary, path);
    else settingsRepo.delete(SETTINGS_KEYS.whisperBinary);
  });

  ipcMain.handle('settings:setWhisperModel', (_e, path: string | null) => {
    if (path) settingsRepo.set(SETTINGS_KEYS.whisperModel, path);
    else settingsRepo.delete(SETTINGS_KEYS.whisperModel);
  });

  ipcMain.handle(
    'settings:pickFile',
    async (_e, opts: { title: string; filters?: { name: string; extensions: string[] }[] }) => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      const res = await dialog.showOpenDialog(win ?? new BrowserWindow({ show: false }), {
        title: opts.title,
        properties: ['openFile'],
        filters: opts.filters
      });
      if (res.canceled || res.filePaths.length === 0) return null;
      return res.filePaths[0];
    }
  );

  // Whisper model catalog + download manager.
  ipcMain.handle('whisper:listCatalog', () => MODEL_CATALOG);
  ipcMain.handle('whisper:listInstalled', () => listInstalledModels());

  ipcMain.handle('whisper:downloadModel', async (_e, modelId: string) => {
    if (activeDownloads.has(modelId)) {
      return { ok: false, message: 'Already downloading.' };
    }
    const ctl = new AbortController();
    activeDownloads.set(modelId, ctl);
    try {
      const path = await downloadModel(
        modelId,
        (loaded, total) => broadcastProgress(modelId, loaded, total),
        ctl.signal
      );
      // Auto-select if no model is currently configured.
      if (!settingsRepo.get(SETTINGS_KEYS.whisperModel)) {
        selectInstalledAsDefault(modelId);
      }
      return { ok: true, path };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    } finally {
      activeDownloads.delete(modelId);
    }
  });

  ipcMain.handle('whisper:cancelDownload', (_e, modelId: string) => {
    activeDownloads.get(modelId)?.abort();
    activeDownloads.delete(modelId);
  });

  ipcMain.handle('whisper:deleteModel', async (_e, modelId: string) => {
    const path = modelFilePath(modelId);
    await deleteModel(modelId);
    // If Settings pointed at the deleted file, clear it.
    if (settingsRepo.get(SETTINGS_KEYS.whisperModel) === path) {
      settingsRepo.delete(SETTINGS_KEYS.whisperModel);
    }
  });

  ipcMain.handle('whisper:selectModel', (_e, modelId: string) => {
    selectInstalledAsDefault(modelId);
  });
}
