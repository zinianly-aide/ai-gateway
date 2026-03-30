import { prisma } from '../lib/prisma.js';

export class MessageRepo {
  async createMany(conversationId: string, messages: Array<{ role: string; content: string; tokenCount?: number; compressed?: boolean }>) {
    if (!messages.length) return;
    await prisma.message.createMany({
      data: messages.map((m) => ({
        conversationId,
        role: m.role,
        content: m.content,
        tokenCount: m.tokenCount ?? 0,
        compressed: m.compressed ?? false
      }))
    });
  }
}
