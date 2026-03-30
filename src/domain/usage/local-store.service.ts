import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface LocalStoreMessage {
  id: string;
  role: string;
  content: string;
  tokenCount: number;
  compressed: boolean;
  createdAt: string;
}

export interface LocalStoreConversation {
  id: string;
  userId: string;
  provider: string;
  model: string;
  summary?: string;
  tokenState?: Record<string, any>;
  upstreamConversationId?: string;
  messages: LocalStoreMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface LocalStoreUsageRecord {
  id: string;
  userId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  requestId: string;
  createdAt: string;
}

interface LocalStoreSchema {
  conversations: LocalStoreConversation[];
  usageRecords: LocalStoreUsageRecord[];
}

const DEFAULT_PATH = path.resolve(process.cwd(), 'data', 'local-store.json');

export class LocalStoreService {
  constructor(private readonly filePath = process.env.LOCAL_STORE_PATH || DEFAULT_PATH) {}

  private async ensureFile() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await readFile(this.filePath, 'utf8');
    } catch {
      await writeFile(this.filePath, JSON.stringify({ conversations: [], usageRecords: [] }, null, 2), 'utf8');
    }
  }

  private async read(): Promise<LocalStoreSchema> {
    await this.ensureFile();
    const raw = await readFile(this.filePath, 'utf8');
    return JSON.parse(raw) as LocalStoreSchema;
  }

  private async write(data: LocalStoreSchema) {
    await this.ensureFile();
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async ensureConversation(params: {
    id?: string;
    userId: string;
    provider: string;
    model: string;
    upstreamConversationId?: string;
  }) {
    const db = await this.read();
    const now = new Date().toISOString();

    let conversation = params.id
      ? db.conversations.find((x) => x.id === params.id && x.userId === params.userId)
      : undefined;

    if (!conversation) {
      conversation = {
        id: params.id || crypto.randomUUID(),
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        upstreamConversationId: params.upstreamConversationId,
        tokenState: params.upstreamConversationId ? { upstreamConversationId: params.upstreamConversationId } : {},
        messages: [],
        createdAt: now,
        updatedAt: now
      };
      db.conversations.push(conversation);
      await this.write(db);
      return conversation;
    }

    conversation.provider = params.provider;
    conversation.model = params.model;
    if (params.upstreamConversationId) {
      conversation.upstreamConversationId = params.upstreamConversationId;
      conversation.tokenState = {
        ...(conversation.tokenState || {}),
        upstreamConversationId: params.upstreamConversationId
      };
    }
    conversation.updatedAt = now;
    await this.write(db);
    return conversation;
  }

  async appendMessages(conversationId: string, messages: Array<Omit<LocalStoreMessage, 'id' | 'createdAt'>>) {
    if (!messages.length) return;
    const db = await this.read();
    const conversation = db.conversations.find((x) => x.id === conversationId);
    if (!conversation) throw new Error(`Conversation not found: ${conversationId}`);

    const now = new Date().toISOString();
    conversation.messages.push(
      ...messages.map((m) => ({
        id: crypto.randomUUID(),
        createdAt: now,
        ...m
      }))
    );
    conversation.updatedAt = now;
    await this.write(db);
  }

  async listConversations(userId: string, limit = 50) {
    const db = await this.read();
    return db.conversations
      .filter((x) => x.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map((c) => ({
        ...c,
        messages: c.messages.slice(-3)
      }));
  }

  async getConversation(userId: string, id: string) {
    const db = await this.read();
    return db.conversations.find((x) => x.userId === userId && x.id === id) || null;
  }

  async getConversationByUpstreamConversationId(userId: string, upstreamConversationId: string) {
    const db = await this.read();
    return db.conversations.find((x) => x.userId === userId && x.upstreamConversationId === upstreamConversationId) || null;
  }

  async createUsageRecord(record: LocalStoreUsageRecord) {
    const db = await this.read();
    db.usageRecords.push(record);
    await this.write(db);
    return record;
  }

  async listUsageRecords(userId: string, limit = 100) {
    const db = await this.read();
    return db.usageRecords
      .filter((x) => x.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}
