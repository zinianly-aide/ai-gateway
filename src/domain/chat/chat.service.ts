import type { ChatRequest, ChatResponse, ChatMessage } from '../../core-types.js';
import { ProviderRegistry } from '../providers/provider-registry.js';
import { TokenCounterService } from '../usage/token-counter.service.js';
import { CompressionService } from './compression.service.js';

export class ChatService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly tokenCounter: TokenCounterService,
    private readonly compressionService: CompressionService
  ) {}

  async chat(input: ChatRequest): Promise<ChatResponse> {
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

    const provider = this.registry.getProvider(input.provider);
    return provider.chat({ ...input, messages });
  }
}
