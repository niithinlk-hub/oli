/**
 * Ask my meetings — retrieve-then-generate over the embedding store.
 *
 * Flow:
 *  1. Embed user query, top-k=8 semantic search via `searchEmbeddings`.
 *  2. Inject hits as numbered context into a chat prompt.
 *  3. Call `chat()` with citation-encouraging system prompt.
 *  4. Persist conversation + assistant message + citations.
 *
 * Citations are stored as JSON arrays of `{ meetingId, segmentId? }` so the
 * renderer can deep-link into the relevant transcript timestamp.
 */
import { randomUUID } from 'node:crypto';
import { initDb } from '../db/repo';
import { searchEmbeddings, type SearchHit } from '../embeddings';
import { chat, LlmNotConfiguredError, type ChatTurn } from '../llm/providers';

export interface AskCitation {
  meetingId: string;
  meetingTitle: string;
  segmentId: number | null;
  segmentStartMs: number | null;
  score: number;
}

export interface AskMessage {
  id: number;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: AskCitation[];
  createdAt: number;
}

export interface AskConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export const askRepo = {
  listConversations(): AskConversation[] {
    const rows = initDb()
      .prepare(
        `SELECT c.*, COUNT(m.id) AS message_count FROM ask_conversations c
         LEFT JOIN ask_messages m ON m.conversation_id = c.id
         GROUP BY c.id
         ORDER BY c.updated_at DESC`
      )
      .all() as Array<{
        id: string;
        title: string;
        created_at: number;
        updated_at: number;
        message_count: number;
      }>;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      messageCount: r.message_count
    }));
  },
  createConversation(title: string): AskConversation {
    const id = randomUUID();
    const now = Date.now();
    initDb()
      .prepare(
        'INSERT INTO ask_conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
      )
      .run(id, title, now, now);
    return { id, title, createdAt: now, updatedAt: now, messageCount: 0 };
  },
  deleteConversation(id: string): void {
    initDb().prepare('DELETE FROM ask_conversations WHERE id = ?').run(id);
  },
  listMessages(conversationId: string): AskMessage[] {
    const rows = initDb()
      .prepare('SELECT * FROM ask_messages WHERE conversation_id = ? ORDER BY id ASC')
      .all(conversationId) as Array<{
        id: number;
        conversation_id: string;
        role: 'user' | 'assistant';
        content: string;
        citations_json: string | null;
        created_at: number;
      }>;
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      citations: r.citations_json ? (JSON.parse(r.citations_json) as AskCitation[]) : [],
      createdAt: r.created_at
    }));
  },
  appendMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    citations: AskCitation[] = []
  ): AskMessage {
    const now = Date.now();
    const result = initDb()
      .prepare(
        `INSERT INTO ask_messages (conversation_id, role, content, citations_json, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        conversationId,
        role,
        content,
        citations.length > 0 ? JSON.stringify(citations) : null,
        now
      );
    initDb()
      .prepare('UPDATE ask_conversations SET updated_at = ? WHERE id = ?')
      .run(now, conversationId);
    return {
      id: Number(result.lastInsertRowid),
      conversationId,
      role,
      content,
      citations,
      createdAt: now
    };
  }
};

const ASK_SYSTEM = `You are Oli, the user's AI meeting memory. Answer using ONLY the provided meeting context. Cite sources inline as [1], [2], … matching the numbered context entries — every factual claim should carry a citation. If the answer is not in the context, say so plainly. Be concise. Use GitHub-flavored markdown.`;

export async function askMeetings(
  conversationId: string,
  question: string
): Promise<{ message: AskMessage; hits: SearchHit[] }> {
  // Persist the user turn first.
  askRepo.appendMessage(conversationId, 'user', question);

  let hits: SearchHit[] = [];
  try {
    hits = await searchEmbeddings(question, 8);
  } catch (err) {
    // No embeddings yet, OR no OpenAI key. Fall through with empty context;
    // the LLM will tell the user it doesn't know.
    if (!(err instanceof LlmNotConfiguredError)) {
      console.warn('ask search failed:', (err as Error).message);
    }
  }

  const numbered = hits
    .map((h, i) => `[${i + 1}] (${h.kind} · ${h.meetingTitle})\n${h.content}`)
    .join('\n\n');

  const userMessage = `Context (top ${hits.length} matches):\n\n${numbered || '(no relevant meetings indexed yet)'}\n\nQuestion: ${question}`;

  const history = askRepo
    .listMessages(conversationId)
    .filter((m) => m.role !== 'user' || m.content !== question)
    .map<ChatTurn>((m) => ({ role: m.role, content: m.content }));

  let answer: string;
  try {
    answer = await chat({
      systemPrompt: ASK_SYSTEM,
      userMessage,
      history,
      temperature: 0.2
    });
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      answer = `_${err.message}_`;
    } else {
      throw err;
    }
  }

  const citations: AskCitation[] = hits.map((h) => ({
    meetingId: h.meetingId,
    meetingTitle: h.meetingTitle,
    segmentId: h.segmentId,
    segmentStartMs: h.segmentStartMs,
    score: h.score
  }));
  const msg = askRepo.appendMessage(conversationId, 'assistant', answer, citations);
  return { message: msg, hits };
}
