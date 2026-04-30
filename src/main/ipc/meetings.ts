import { ipcMain, app } from 'electron';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { meetingsRepo, notesRepo, transcriptRepo } from '../db/repo';
import { getActiveMeetingId, isRecording } from '../audio/recorder';
import type { Meeting } from '@shared/types';

export function registerMeetingIpc() {
  ipcMain.handle('meetings:list', () => meetingsRepo.list());
  ipcMain.handle('meetings:get', (_e, id: string) => meetingsRepo.get(id));
  ipcMain.handle('meetings:create', (_e, title: string) => meetingsRepo.create(title));
  ipcMain.handle('meetings:update', (_e, id: string, patch: Partial<Meeting>) =>
    meetingsRepo.update(id, patch)
  );
  ipcMain.handle('meetings:delete', async (_e, id: string) => {
    if (isRecording() && getActiveMeetingId() === id) {
      throw new Error('Stop the active recording before deleting this meeting.');
    }
    meetingsRepo.delete(id);
    const dir = join(app.getPath('userData'), 'recordings', id);
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`failed to remove recordings dir ${dir}:`, (err as Error).message);
    }
  });
  ipcMain.handle('meetings:search', (_e, q: string) =>
    q.trim().length === 0 ? [] : meetingsRepo.search(q.trim())
  );

  ipcMain.handle('transcript:list', (_e, meetingId: string) => transcriptRepo.list(meetingId));

  ipcMain.handle('notes:get', (_e, meetingId: string) => notesRepo.get(meetingId));
  ipcMain.handle('notes:save', (_e, meetingId: string, raw: string) =>
    notesRepo.save(meetingId, raw)
  );
}
