/**
 * LLM provider abstraction. Renderer picks one of: openai | anthropic | gemini | groq.
 * Each provider implements the same enhance() and ask() interface.
 *
 * API keys are stored per-provider in safeStorage under separate secret names.
 * The active provider id lives in the settings table at key `llm.provider`.
 */
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { getSecret, setSecret, deleteSecret, hasSecret } from '../secrets';
import { settingsRepo } from '../db/settings';

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'groq';

interface ProviderConfig {
  id: ProviderId;
  label: string;
  defaultModel: string;
  secretName: string;
  consoleUrl: string;
  keyPrefix?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: 'openai',
    label: 'OpenAI (GPT-4o)',
    defaultModel: 'gpt-4o',
    secretName: 'openai-key',
    consoleUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-'
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-4-5',
    secretName: 'anthropic-key',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-'
  },
  gemini: {
    id: 'gemini',
    label: 'Google (Gemini)',
    defaultModel: 'gemini-1.5-pro-latest',
    secretName: 'gemini-key',
    consoleUrl: 'https://aistudio.google.com/app/apikey'
  },
  groq: {
    id: 'groq',
    label: 'Groq (Llama 3.3)',
    defaultModel: 'llama-3.3-70b-versatile',
    secretName: 'groq-key',
    consoleUrl: 'https://console.groq.com/keys',
    keyPrefix: 'gsk_'
  }
};

const SETTINGS_PROVIDER_KEY = 'llm.provider';
const SETTINGS_MODEL_PREFIX = 'llm.model.';

export class LlmNotConfiguredError extends Error {
  constructor(provider: ProviderId) {
    super(
      `${PROVIDERS[provider].label} API key not set. Add it in Settings → AI provider.`
    );
  }
}

export function getActiveProvider(): ProviderId {
  const v = settingsRepo.get(SETTINGS_PROVIDER_KEY);
  if (v && v in PROVIDERS) return v as ProviderId;
  return 'openai';
}

export function setActiveProvider(p: ProviderId): void {
  settingsRepo.set(SETTINGS_PROVIDER_KEY, p);
}

export function getModelOverride(p: ProviderId): string | null {
  return settingsRepo.get(SETTINGS_MODEL_PREFIX + p);
}

export function setModelOverride(p: ProviderId, model: string | null): void {
  if (model && model.trim()) settingsRepo.set(SETTINGS_MODEL_PREFIX + p, model.trim());
  else settingsRepo.delete(SETTINGS_MODEL_PREFIX + p);
}

function activeModel(p: ProviderId): string {
  return getModelOverride(p) ?? PROVIDERS[p].defaultModel;
}

export async function getProviderKey(p: ProviderId): Promise<string | null> {
  return getSecret(PROVIDERS[p].secretName);
}

export async function setProviderKey(p: ProviderId, key: string): Promise<void> {
  await setSecret(PROVIDERS[p].secretName, key);
}

export async function deleteProviderKey(p: ProviderId): Promise<void> {
  await deleteSecret(PROVIDERS[p].secretName);
}

export async function hasProviderKey(p: ProviderId): Promise<boolean> {
  return hasSecret(PROVIDERS[p].secretName);
}

export async function maskedProviderKey(p: ProviderId): Promise<string | null> {
  const k = await getSecret(PROVIDERS[p].secretName);
  if (!k) return null;
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export async function listProviderStatus(): Promise<
  { id: ProviderId; label: string; configured: boolean; model: string }[]
> {
  return Promise.all(
    (Object.keys(PROVIDERS) as ProviderId[]).map(async (id) => ({
      id,
      label: PROVIDERS[id].label,
      configured: await hasProviderKey(id),
      model: activeModel(id)
    }))
  );
}

export async function validateKey(
  p: ProviderId,
  apiKey: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    if (p === 'openai') {
      await new OpenAI({ apiKey }).models.list();
    } else if (p === 'anthropic') {
      await new Anthropic({ apiKey }).messages.create({
        model: PROVIDERS.anthropic.defaultModel,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }]
      });
    } else if (p === 'gemini') {
      const m = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: PROVIDERS.gemini.defaultModel
      });
      await m.generateContent('ping');
    } else if (p === 'groq') {
      await new Groq({ apiKey }).chat.completions.create({
        model: PROVIDERS.groq.defaultModel,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }]
      });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

const MAX_TRANSCRIPT_CHARS = 60_000;

function truncate(text: string): string {
  if (text.length <= MAX_TRANSCRIPT_CHARS) return text;
  return text.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[transcript truncated…]';
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteArgs {
  systemPrompt: string;
  userMessage: string;
  history?: ChatTurn[];
  temperature?: number;
}

/**
 * Public raw chat helper. Same shape as `complete()` but exported so other
 * modules (Ask my meetings, structured retry) can drive the dispatcher with
 * their own system prompt + history without going through enhance/ask.
 */
export async function chat(args: CompleteArgs): Promise<string> {
  return complete(args);
}

async function complete(args: CompleteArgs): Promise<string> {
  const provider = getActiveProvider();
  const key = await getProviderKey(provider);
  if (!key) throw new LlmNotConfiguredError(provider);
  const model = activeModel(provider);
  const temperature = args.temperature ?? 0.3;
  const history = args.history ?? [];

  if (provider === 'openai') {
    const client = new OpenAI({ apiKey: key });
    const r = await client.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: 'system', content: args.systemPrompt },
        ...history,
        { role: 'user', content: args.userMessage }
      ]
    });
    return r.choices[0]?.message?.content?.trim() ?? '';
  }

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: key });
    const r = await client.messages.create({
      model,
      max_tokens: 4096,
      temperature,
      system: args.systemPrompt,
      messages: [
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: args.userMessage }
      ]
    });
    return r.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }

  if (provider === 'gemini') {
    const client = new GoogleGenerativeAI(key);
    const m = client.getGenerativeModel({
      model,
      systemInstruction: args.systemPrompt,
      generationConfig: { temperature, maxOutputTokens: 4096 }
    });
    const chat = m.startChat({
      history: history.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }))
    });
    const r = await chat.sendMessage(args.userMessage);
    return r.response.text().trim();
  }

  if (provider === 'groq') {
    const client = new Groq({ apiKey: key });
    const r = await client.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: 'system', content: args.systemPrompt },
        ...history,
        { role: 'user', content: args.userMessage }
      ]
    });
    return r.choices[0]?.message?.content?.trim() ?? '';
  }

  throw new Error(`unknown provider: ${provider}`);
}

/* ─── Structured extraction (Phase 3.2) ──────────────────────────────── */

import { z } from 'zod';

export const StructuredOutput = z.object({
  summary: z.string(),
  decisions: z
    .array(
      z.object({
        text: z.string(),
        segmentRef: z.number().int().nullable().optional()
      })
    )
    .default([]),
  actionItems: z
    .array(
      z.object({
        owner: z.string().nullable().optional().default(null),
        task: z.string(),
        due: z.string().nullable().optional().default(null),
        segmentRef: z.number().int().nullable().optional().default(null)
      })
    )
    .default([]),
  topics: z.array(z.string()).default([])
});
export type StructuredOutput = z.infer<typeof StructuredOutput>;

const STRUCTURED_SYSTEM = `You are a meeting analyst. Extract a JSON object with the following exact schema:
{
  "summary": "2-4 sentence overview",
  "decisions": [{ "text": "...", "segmentRef": null }],
  "actionItems": [{ "owner": "name or null", "task": "...", "due": "ISO date or null", "segmentRef": null }],
  "topics": ["topic1", "topic2"]
}
Rules:
- "decisions" = concrete decisions made, not opinions
- "actionItems" = concrete tasks with owners if stated. Owner = null if unclear.
- "due" = ISO date string if explicitly stated; null otherwise. Don't guess.
- "topics" = 3-7 short topic labels (1-3 words each).
- Output ONLY valid JSON. No prose, no markdown fences, no commentary.`;

interface ExtractStructuredArgs {
  meetingTitle: string;
  transcript: string;
  userNotesMarkdown: string;
}

export async function extractStructured(
  args: ExtractStructuredArgs
): Promise<StructuredOutput> {
  const provider = getActiveProvider();
  const key = await getProviderKey(provider);
  if (!key) throw new LlmNotConfiguredError(provider);
  const model = activeModel(provider);
  const transcript = truncate(args.transcript);
  const userMessage = `Meeting: ${args.meetingTitle}

Notes (markdown):
"""
${args.userNotesMarkdown || '(none)'}
"""

Transcript:
"""
${transcript}
"""

Return the JSON now.`;

  let raw = '';

  if (provider === 'openai') {
    const r = await new OpenAI({ apiKey: key }).chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: STRUCTURED_SYSTEM },
        { role: 'user', content: userMessage }
      ]
    });
    raw = r.choices[0]?.message?.content ?? '';
  } else if (provider === 'anthropic') {
    const r = await new Anthropic({ apiKey: key }).messages.create({
      model,
      max_tokens: 4096,
      temperature: 0.1,
      system: STRUCTURED_SYSTEM + '\n\nReply with ONLY a single JSON object — no prose.',
      messages: [{ role: 'user', content: userMessage }]
    });
    raw = r.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  } else if (provider === 'gemini') {
    const m = new GoogleGenerativeAI(key).getGenerativeModel({
      model,
      systemInstruction: STRUCTURED_SYSTEM,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        maxOutputTokens: 4096
      }
    });
    const r = await m.generateContent(userMessage);
    raw = r.response.text();
  } else if (provider === 'groq') {
    const r = await new Groq({ apiKey: key }).chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: STRUCTURED_SYSTEM },
        { role: 'user', content: userMessage }
      ]
    });
    raw = r.choices[0]?.message?.content ?? '';
  }

  // Strip code fences if a model snuck them in despite the prompt.
  raw = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');

  const parseOnce = (): StructuredOutput | null => {
    try {
      const j = JSON.parse(raw);
      return StructuredOutput.parse(j);
    } catch {
      return null;
    }
  };

  const out = parseOnce();
  if (out) return out;

  // One retry with explicit "JSON only" reminder.
  const retry = await complete({
    systemPrompt:
      STRUCTURED_SYSTEM +
      '\n\nThe last response was unparseable. Return ONLY the JSON object now.',
    userMessage,
    temperature: 0
  });
  raw = retry.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const second = parseOnce();
  if (second) return second;
  throw new Error('LLM did not return parseable JSON');
}

/* ─── Embeddings (Phase 3.3) ──────────────────────────────────────────── */

export type EmbedProvider = 'openai-small' | 'openai-large';

const EMBED_MODEL_MAP: Record<EmbedProvider, { model: string; dim: number }> = {
  'openai-small': { model: 'text-embedding-3-small', dim: 1536 },
  'openai-large': { model: 'text-embedding-3-large', dim: 3072 }
};

export function embedDimensions(provider: EmbedProvider): number {
  return EMBED_MODEL_MAP[provider].dim;
}

export function embedModelName(provider: EmbedProvider): string {
  return EMBED_MODEL_MAP[provider].model;
}

/**
 * Batch embed. Reuses the OpenAI key (most users already have one). Falls
 * back to throwing LlmNotConfiguredError if absent. We don't run embeddings
 * via Anthropic/Gemini/Groq — none of them ship cheap general-purpose embed
 * APIs at the time of writing.
 */
export async function embedBatch(
  texts: string[],
  provider: EmbedProvider = 'openai-small'
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const key = await getProviderKey('openai');
  if (!key) throw new LlmNotConfiguredError('openai');
  const client = new OpenAI({ apiKey: key });
  const r = await client.embeddings.create({
    model: EMBED_MODEL_MAP[provider].model,
    input: texts
  });
  return r.data.map((d) => d.embedding);
}

interface EnhanceArgs {
  systemPrompt: string;
  transcript: string;
  userNotesMarkdown: string;
  meetingTitle: string;
}

export async function enhance(args: EnhanceArgs): Promise<string> {
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

  const out = await complete({
    systemPrompt: args.systemPrompt,
    userMessage,
    temperature: 0.3
  });
  if (!out) throw new Error('LLM returned an empty response');
  return out;
}

export type EmailTone =
  | 'professional'
  | 'friendly'
  | 'concise'
  | 'persuasive'
  | 'apologetic'
  | 'assertive'
  | 'neutral';

export type EmailIntent =
  | 'rephrase'
  | 'reply'
  | 'shorten'
  | 'lengthen'
  | 'fix-grammar'
  | 'translate-en';

interface RephraseEmailArgs {
  originalText: string;
  tone: EmailTone;
  intent: EmailIntent;
  contextNote?: string;
}

const EMAIL_SYSTEM = `You are an expert email writer. Rewrite the user's email or draft per the requested tone and intent. Rules:
- Preserve original meaning and any hard facts (names, dates, numbers, amounts).
- Output ONLY the rewritten email body — no preamble, no markdown fences, no commentary.
- If a salutation or sign-off is present, keep an equivalent one. If absent, do not invent personal names.
- Never add new commitments the user did not make.
- Keep the language clean, natural, and human.`;

function intentDirective(intent: EmailIntent): string {
  switch (intent) {
    case 'rephrase':
      return 'Rephrase the email keeping the same length and intent.';
    case 'reply':
      return 'Write a reply to this email. Address the points raised.';
    case 'shorten':
      return 'Shorten the email to roughly half the length while preserving every key point.';
    case 'lengthen':
      return 'Expand the email with more detail, examples, and context where helpful.';
    case 'fix-grammar':
      return 'Fix grammar, spelling, and awkward phrasing only. Keep wording and length as close to original as possible.';
    case 'translate-en':
      return 'Translate the email to clear, natural English. Preserve formatting.';
  }
}

export async function rephraseEmail(args: RephraseEmailArgs): Promise<string> {
  const directive = intentDirective(args.intent);
  const userMessage = `${directive}
Tone: ${args.tone}.
${args.contextNote ? `Extra context (do NOT include verbatim, just inform tone/content): ${args.contextNote}\n` : ''}
Original email / draft:
"""
${args.originalText}
"""`;

  const out = await complete({
    systemPrompt: EMAIL_SYSTEM,
    userMessage,
    temperature: 0.4
  });
  if (!out) throw new Error('LLM returned an empty response');
  return out;
}

interface AskArgs {
  meetingTitle: string;
  transcript: string;
  userNotesMarkdown: string;
  enhancedMarkdown: string | null;
  history: ChatTurn[];
  question: string;
}

const ASK_SYSTEM = `You are Oli — the user's AI meeting memory. Answer questions about a specific meeting using ONLY the provided transcript, user notes, and enhanced notes. Be concise, specific, and quote exact phrasing when relevant. If the answer is not in the source material, say so clearly. Use GitHub-flavored markdown. Never fabricate.`;

export async function ask(args: AskArgs): Promise<string> {
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
"""

Question: ${args.question}`;

  const out = await complete({
    systemPrompt: ASK_SYSTEM,
    userMessage: context,
    history: args.history,
    temperature: 0.2
  });
  if (!out) throw new Error('LLM returned an empty response');
  return out;
}
