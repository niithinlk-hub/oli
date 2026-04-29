import { ipcMain, dialog, BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import { meetingsRepo, notesRepo, transcriptRepo } from '../db/repo';
import { htmlToMarkdown } from '../llm/html-to-markdown';

function fmtTimestamp(ms: number): string {
  const t = Math.floor(ms / 1000);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function buildMarkdown(meetingId: string): string | null {
  const meeting = meetingsRepo.get(meetingId);
  if (!meeting) return null;
  const note = notesRepo.get(meetingId);
  const transcript = transcriptRepo.list(meetingId);

  const startedAt = new Date(meeting.startedAt).toLocaleString();
  const userNotesMd = htmlToMarkdown(note?.rawMarkdown ?? '');

  const parts: string[] = [];
  parts.push(`# ${meeting.title}`);
  parts.push(`*${startedAt}*`);
  parts.push('');

  if (note?.enhancedMarkdown) {
    parts.push('## Oli enhanced');
    parts.push('');
    parts.push(note.enhancedMarkdown);
    parts.push('');
  }

  if (userNotesMd) {
    parts.push('## Notes');
    parts.push('');
    parts.push(userNotesMd);
    parts.push('');
  }

  if (transcript.length > 0) {
    parts.push('## Transcript');
    parts.push('');
    for (const seg of transcript) {
      parts.push(`- \`${fmtTimestamp(seg.startMs)}\` ${seg.text}`);
    }
  }

  return parts.join('\n');
}

function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 80);
}

export function registerExportIpc(): void {
  ipcMain.handle('meetings:exportMarkdown', async (_e, meetingId: string) => {
    const md = buildMarkdown(meetingId);
    if (md == null) return { ok: false, message: 'Meeting not found.' };
    const meeting = meetingsRepo.get(meetingId)!;
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showSaveDialog(win!, {
      title: 'Export meeting',
      defaultPath: `${safeFileName(meeting.title)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (res.canceled || !res.filePath) return { ok: false, message: 'Cancelled.' };
    try {
      await writeFile(res.filePath, md, 'utf8');
      return { ok: true, path: res.filePath };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  });
}
