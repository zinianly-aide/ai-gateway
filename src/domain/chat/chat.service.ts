import type { ChatRequest, ChatResponse, ChatMessage } from '../../core-types.js';
import { ProviderRegistry } from '../providers/provider-registry.js';
import { TokenCounterService } from '../usage/token-counter.service.js';
import { CompressionService } from './compression.service.js';
import { PersistenceService } from '../usage/persistence.service.js';

export class ChatService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly tokenCounter: TokenCounterService,
    private readonly compressionService: CompressionService,
    private readonly persistenceService: PersistenceService
  ) {}

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const messages = await this.prepareMessages(input);
    const provider = this.registry.getProvider(input.provider);
    const response = await provider.chat({ ...input, messages });
    const persisted = await this.persistenceService.persist({
      request: input,
      requestMessages: messages,
      response
    });
    response.raw = {
      ...(response.raw || {}),
      gateway: {
        ...(response.raw?.gateway || {}),
        persistedConversationId: persisted.conversationId,
        upstreamConversationId: persisted.upstreamConversationId || response.raw?.gateway?.upstreamConversationId
      }
    };
    return response;
  }

  async streamChat(input: ChatRequest): Promise<AsyncGenerator<string, void, unknown>> {
    const messages = await this.prepareMessages(input);
    const provider = this.registry.getProvider(input.provider);
    if (!provider.streamChat) {
      throw new Error(`Provider ${input.provider} does not support streaming`);
    }
    return provider.streamChat({ ...input, messages });
  }

  private async prepareMessages(input: ChatRequest): Promise<ChatMessage[]> {
    let messages: ChatMessage[] = [...input.messages];
    const estimatedTokens = this.tokenCounter.countMessages(input.model, messages);

    if (this.compressionService.shouldCompress(estimatedTokens, 128000)) {
      const compressed = await this.compressionService.compress(messages);
      messages = [
        ...messages.filter((m) => m.role === 'system'),
        { role: 'system', content: `Conversation summary:\n${compressed.summary}` },
        ...compressed.recentMessages
      ];
    }

    return messages;
  }
}
