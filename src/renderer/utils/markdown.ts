import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: true
});

/**
 * Render trusted-but-let's-not-eval markdown to sanitized HTML. The output
 * is what comes back from GPT-4o, so we still purify before injection.
 */
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'rel']
  });
}
