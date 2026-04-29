import TurndownService from 'turndown';

let cached: TurndownService | null = null;

function getService(): TurndownService {
  if (cached) return cached;
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  });
  td.addRule('strikethrough', {
    filter: ['del', 's' as any],
    replacement: (content: string) => `~~${content}~~`
  });
  cached = td;
  return cached;
}

export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';
  return getService().turndown(html).trim();
}
