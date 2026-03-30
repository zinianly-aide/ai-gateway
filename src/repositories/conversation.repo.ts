import { prisma } from '../lib/prisma.js';

export class ConversationRepo {
  async ensure(params: {
    id?: string;
    userId: string;
    provider: string;
    model: string;
    upstreamConversationId?: string;
  }) {
    if (params.id) {
      const existing = await prisma.conversation.findUnique({ where: { id: params.id } });
      if (existing) return existing;
    }

    return prisma.conversation.create({
      data: {
        id: params.id,
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        tokenState: params.upstreamConversationId ? { upstreamConversationId: params.upstreamConversationId } : undefined
      }
    });
  }

  async patchUpstreamConversationId(id: string, upstreamConversationId: string) {
    const existing = await prisma.conversation.findUnique({ where: { id } });
    const tokenState = {
      ...(existing?.tokenState as Record<string, any> | null ?? {}),
      upstreamConversationId
    };

    return prisma.conversation.update({
      where: { id },
      data: { tokenState }
    });
  }
}
