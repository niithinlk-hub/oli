import { ipcMain, dialog, BrowserWindow } from 'electron';
import { settingsRepo, SETTINGS_KEYS } from '../db/settings';
import type { AppSettings } from '@shared/types';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (): AppSettings => {
    return {
      whisperBinaryPath: settingsRepo.get(SETTINGS_KEYS.whisperBinary),
      whisperModelPath: settingsRepo.get(SETTINGS_KEYS.whisperModel),
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

  ipcMain.handle('settings:pickFile', async (_e, opts: { title: string; filters?: { name: string; extensions: string[] }[] }) => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: opts.title,
      properties: ['openFile'],
      filters: opts.filters
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });
}
