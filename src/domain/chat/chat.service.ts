import type { ChatRequest, ChatResponse, ChatMessage } from '../../core-types.js';
import { ProviderRegistry } from '../providers/provider-registry.js';
import { TokenCounterService } from '../usage/token-counter.service.js';
import { CompressionService } from './compression.service.js';
import { PersistenceService } from '../usage/persistence.service.js';
import { LocalStoreService } from '../usage/local-store.service.js';
import { normalizeChatMessages } from './message-normalizer.service.js';

export class ChatService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly tokenCounter: TokenCounterService,
    private readonly compressionService: CompressionService,
    private readonly persistenceService: PersistenceService,
    private readonly localStore = new LocalStoreService()
  ) {}

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const prepared = await this.prepareMessages(input);
    const provider = this.registry.getProvider(input.provider);
    const response = await provider.chat({ ...input, messages: prepared.messages });

    response.raw = {
      ...(response.raw || {}),
      gateway: {
        ...(response.raw?.gateway || {}),
        tokenDebug: prepared.tokenDebug
      }
    };

    try {
      const persisted = await this.persistenceService.persist({
        request: input,
        requestMessages: prepared.messages,
        response
      });
      response.raw = {
        ...(response.raw || {}),
        gateway: {
          ...(response.raw?.gateway || {}),
          persistedConversationId: persisted.conversationId,
          upstreamConversationId: persisted.upstreamConversationId || response.raw?.gateway?.upstreamConversationId,
          persistenceStatus: 'ok'
        }
      };
    } catch (err: any) {
      console.error('[persistence] blocking.persist.error', err?.message || err);
      response.raw = {
        ...(response.raw || {}),
        gateway: {
          ...(response.raw?.gateway || {}),
          persistenceStatus: 'degraded',
          persistenceError: err?.message || String(err)
        }
      };
    }

    return response;
  }

  async streamChat(input: ChatRequest): Promise<{
    stream: AsyncGenerator<string, void, unknown>;
    onFinal: () => Promise<{ persistedConversationId?: string; persistenceStatus: 'ok' | 'degraded'; persistenceError?: string }>;
  }> {
    const prepared = await this.prepareMessages(input);
    const provider = this.registry.getProvider(input.provider);
    if (!provider.streamChat) {
      throw new Error(`Provider ${input.provider} does not support streaming`);
    }

    const rawStream = provider.streamChat({ ...input, messages: prepared.messages });
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
              upstreamConversationId: input.conversationId,
              tokenDebug: prepared.tokenDebug
            }
          }
        };

        try {
          const persisted = await this.persistenceService.persist({
            request: input,
            requestMessages: prepared.messages,
            response
          });
          return {
            persistedConversationId: persisted.conversationId,
            persistenceStatus: 'ok' as const
          };
        } catch (err: any) {
          console.error('[persistence] streaming.persist.error', err?.message || err);
          return {
            persistenceStatus: 'degraded' as const,
            persistenceError: err?.message || String(err)
          };
        }
      }
    };
  }

  private async prepareMessages(input: ChatRequest): Promise<{
    messages: ChatMessage[];
    tokenDebug: Record<string, any>;
  }> {
    const modelLimit = Number(input.metadata?.modelLimit || input.metadata?.model_limit || 128000);
    const reservedOutputTokens = Number(input.maxTokens || input.metadata?.reservedOutputTokens || 4096);

    const localConversation = input.localConversationId
      ? await this.localStore.getConversation(input.userId, input.localConversationId)
      : input.conversationId
        ? await this.localStore.getConversationByUpstreamConversationId(input.userId, input.conversationId)
        : null;

    const historyMessages: ChatMessage[] = (localConversation?.messages || []).map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content
    }));

    const incomingMessages: ChatMessage[] = normalizeChatMessages(input.messages);
    const mergedMessages = historyMessages.length
      ? this.mergeHistoricalAndIncomingMessages(historyMessages, incomingMessages)
      : incomingMessages;

    let messages: ChatMessage[] = mergedMessages;
    const before = this.tokenCounter.estimateAvailableContext({
      model: input.model,
      messages,
      modelLimit,
      reservedOutputTokens
    });

    let compressed = false;
    let compressionSummaryTokens = 0;
    let pinnedFactsCount = 0;
    let droppedMessageCount = 0;
    let keptRecentTurns = 0;

    if (this.compressionService.shouldCompress(before.inputTokens, before.compressionThreshold)) {
      const result = await this.compressionService.compress(messages);
      const summaryBlock = [
        'Conversation summary:',
        result.summary,
        result.pinnedFacts.length ? `Pinned facts:\n- ${result.pinnedFacts.join('\n- ')}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');

      const dedupedSystemMessages = result.systemMessages.filter(
        (m, i, arr) => arr.findIndex((x) => x.role === 'system' && x.content === m.content) === i
      );

      messages = [
        ...dedupedSystemMessages,
        { role: 'system', content: summaryBlock },
        ...result.recentMessages
      ];

      compressed = true;
      compressionSummaryTokens = this.tokenCounter.countText(input.model, summaryBlock);
      pinnedFactsCount = result.pinnedFacts.length;
      droppedMessageCount = result.droppedMessageCount;
      keptRecentTurns = result.keptRecentTurns;
    }

    const after = this.tokenCounter.estimateAvailableContext({
      model: input.model,
      messages,
      modelLimit,
      reservedOutputTokens
    });

    return {
      messages,
      tokenDebug: {
        compressed,
        originalMessageCount: input.messages.length,
        historicalMessageCount: historyMessages.length,
        mergedMessageCount: mergedMessages.length,
        finalMessageCount: messages.length,
        restoredFromConversation: localConversation?.id || null,
        restoredUpstreamConversationId: localConversation?.upstreamConversationId || input.conversationId || null,
        before,
        after,
        compressionSummaryTokens,
        pinnedFactsCount,
        droppedMessageCount,
        keptRecentTurns
      }
    };
  }

  private mergeHistoricalAndIncomingMessages(historyMessages: ChatMessage[], incomingMessages: ChatMessage[]) {
    if (!historyMessages.length) return incomingMessages;
    if (!incomingMessages.length) return historyMessages;

    const normalizedIncoming = new Set(incomingMessages.map((m) => `${m.role}:${m.content}`));
    const dedupedHistory = historyMessages.filter((m) => !normalizedIncoming.has(`${m.role}:${m.content}`));
    return [...dedupedHistory, ...incomingMessages];
  }
}
