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

  async streamChat(input: ChatRequest): Promise<{
    stream: AsyncGenerator<string, void, unknown>;
    onFinal: () => Promise<{ persistedConversationId?: string }>;
  }> {
    const messages = await this.prepareMessages(input);
    const provider = this.registry.getProvider(input.provider);
    if (!provider.streamChat) {
      throw new Error(`Provider ${input.provider} does not support streaming`);
    }

    const rawStream = provider.streamChat({ ...input, messages });
    let fullText = '';

    async function* collectingStream() {
      for await (const chunk of rawStream) {
        fullText += chunk;
        yield chunk;
      }
    }

    return {
      stream: collectingStream(),
      onFinal: async () => {
        const response: ChatResponse = {
          id: crypto.randomUUID(),
          provider: input.provider,
          model: input.model,
          content: fullText,
          finishReason: 'stop',
          raw: {
            gateway: {
              upstreamConversationId: input.conversationId
            }
          }
        };

        const persisted = await this.persistenceService.persist({
          request: input,
          requestMessages: messages,
          response
        });

        return { persistedConversationId: persisted.conversationId };
      }
    };
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
