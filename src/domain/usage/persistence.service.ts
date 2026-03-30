import { randomUUID } from 'node:crypto';
import type { ChatMessage, ChatRequest, ChatResponse } from '../../core-types.js';
import { TokenCounterService } from './token-counter.service.js';
import { CostService } from './cost.service.js';
import { ConversationRepo } from '../../repositories/conversation.repo.js';
import { MessageRepo } from '../../repositories/message.repo.js';
import { UsageRepo } from '../../repositories/usage.repo.js';

export class PersistenceService {
  constructor(
    private readonly tokenCounter: TokenCounterService,
    private readonly costService: CostService,
    private readonly conversationRepo = new ConversationRepo(),
    private readonly messageRepo = new MessageRepo(),
    private readonly usageRepo = new UsageRepo()
  ) {}

  async persist(input: {
    request: ChatRequest;
    requestMessages: ChatMessage[];
    response: ChatResponse;
  }) {
    const upstreamConversationId = input.response.raw?.gateway?.upstreamConversationId as string | undefined;

    const conversation = await this.conversationRepo.ensure({
      id: input.request.conversationId,
      userId: input.request.userId,
      provider: input.request.provider,
      model: input.request.model,
      upstreamConversationId
    });

    if (upstreamConversationId) {
      await this.conversationRepo.patchUpstreamConversationId(conversation.id, upstreamConversationId);
    }

    await this.messageRepo.createMany(
      conversation.id,
      input.requestMessages.map((m) => ({
        role: m.role,
        content: m.content,
        tokenCount: this.tokenCounter.countText(input.request.model, m.content)
      }))
    );

    await this.messageRepo.createMany(conversation.id, [
      {
        role: 'assistant',
        content: input.response.content,
        tokenCount: this.tokenCounter.countText(input.request.model, input.response.content)
      }
    ]);

    if (input.response.usage) {
      await this.usageRepo.create({
        userId: input.request.userId,
        provider: input.request.provider,
        model: input.request.model,
        inputTokens: input.response.usage.inputTokens,
        outputTokens: input.response.usage.outputTokens,
        cost: this.costService.estimate(
          input.request.provider,
          input.request.model,
          input.response.usage.inputTokens,
          input.response.usage.outputTokens
        ),
        requestId: input.response.id || randomUUID()
      });
    }

    return {
      conversationId: conversation.id,
      upstreamConversationId
    };
  }
}
