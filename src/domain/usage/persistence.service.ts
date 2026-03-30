import { randomUUID } from 'node:crypto';
import type { ChatMessage, ChatRequest, ChatResponse } from '../../core-types.js';
import { TokenCounterService } from './token-counter.service.js';
import { CostService } from './cost.service.js';
import { LocalStoreService } from './local-store.service.js';

export class PersistenceService {
  constructor(
    private readonly tokenCounter: TokenCounterService,
    private readonly costService: CostService,
    private readonly store = new LocalStoreService()
  ) {}

  async persist(input: {
    request: ChatRequest;
    requestMessages: ChatMessage[];
    response: ChatResponse;
  }) {
    const upstreamConversationId = input.response.raw?.gateway?.upstreamConversationId as string | undefined;

    const conversation = await this.store.ensureConversation({
      id: input.request.conversationId,
      userId: input.request.userId,
      provider: input.request.provider,
      model: input.request.model,
      upstreamConversationId
    });

    await this.store.appendMessages(
      conversation.id,
      input.requestMessages.map((m) => ({
        role: m.role,
        content: m.content,
        tokenCount: this.tokenCounter.countText(input.request.model, m.content),
        compressed: false
      }))
    );

    await this.store.appendMessages(conversation.id, [
      {
        role: 'assistant',
        content: input.response.content,
        tokenCount: this.tokenCounter.countText(input.request.model, input.response.content),
        compressed: false
      }
    ]);

    if (input.response.usage) {
      await this.store.createUsageRecord({
        id: randomUUID(),
        userId: input.request.userId,
        provider: input.request.provider,
        model: input.request.model,
        inputTokens: input.response.usage.inputTokens,
        outputTokens: input.response.usage.outputTokens,
        totalTokens: input.response.usage.totalTokens,
        cost: this.costService.estimate(
          input.request.provider,
          input.request.model,
          input.response.usage.inputTokens,
          input.response.usage.outputTokens
        ),
        requestId: input.response.id || randomUUID(),
        createdAt: new Date().toISOString()
      });
    }

    return {
      conversationId: conversation.id,
      upstreamConversationId
    };
  }
}
