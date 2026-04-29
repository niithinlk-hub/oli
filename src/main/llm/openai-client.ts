import OpenAI from 'openai';
import { getSecret, SECRET_NAMES } from '../secrets';

const MODEL = 'gpt-4o';
const MAX_TRANSCRIPT_CHARS = 60_000; // ~15k tokens

export class OpenAiNotConfiguredError extends Error {
  constructor() {
    super('OpenAI API key not set. Add it in Settings.');
  }
}

async function getClient(): Promise<OpenAI> {
  const key = await getSecret(SECRET_NAMES.openAiKey);
  if (!key) throw new OpenAiNotConfiguredError();
  return new OpenAI({ apiKey: key });
}

function truncate(text: string): string {
  if (text.length <= MAX_TRANSCRIPT_CHARS) return text;
  return text.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[transcript truncated…]';
}

interface EnhanceArgs {
  systemPrompt: string;
  transcript: string;
  userNotesMarkdown: string;
  meetingTitle: string;
}

export async function enhance(args: EnhanceArgs): Promise<string> {
  const client = await getClient();
  const transcript = truncate(args.transcript);

  const userMessage = `Meeting title: ${args.meetingTitle}

User's rough notes (markdown, may be empty):
"""
${args.userNotesMarkdown || '(none)'}
"""

Full transcript:
"""
${transcript}
"""

Produce the requested output in clean GitHub-flavored markdown. Do not wrap the output in a code fence.`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: args.systemPrompt },
      { role: 'user', content: userMessage }
    ]
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('OpenAI returned an empty response');
  return content;
}

interface AskArgs {
  meetingTitle: string;
  transcript: string;
  userNotesMarkdown: string;
  enhancedMarkdown: string | null;
  history: { role: 'user' | 'assistant'; content: string }[];
  question: string;
}

const ASK_SYSTEM = `You are Oli — the user's AI meeting memory. Answer questions about a specific meeting using ONLY the provided transcript, user notes, and enhanced notes. Be concise, specific, and quote exact phrasing when relevant. If the answer is not in the source material, say so clearly. Use GitHub-flavored markdown. Never fabricate.`;

export async function ask(args: AskArgs): Promise<string> {
  const client = await getClient();
  const transcript = truncate(args.transcript);

  const context = `Meeting title: ${args.meetingTitle}

User's notes (markdown):
"""
${args.userNotesMarkdown || '(none)'}
"""

Enhanced notes:
"""
${args.enhancedMarkdown ?? '(none)'}
"""

Full transcript:
"""
${transcript}
"""`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: ASK_SYSTEM },
    { role: 'user', content: context },
    ...args.history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: args.question }
  ];

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('OpenAI returned an empty response');
  return content;
}

export async function validateKey(apiKey: string): Promise<boolean> {
  try {
    const client = new OpenAI({ apiKey });
    await client.models.list();
    return true;
  } catch {
    return false;
  }
}
