import axios from 'axios';
import type { ProviderAdapter } from './base/provider-adapter.js';
import type { ChatRequest, ChatResponse } from '../../core-types.js';

/**
 * Dify app API adapter.
 * Uses Dify /v1/chat-messages endpoint and maps gateway chat requests into a single query.
 * This is an MVP bridge for local Dify instances.
 */
export class DifyAdapter implements ProviderAdapter {
  name = 'dify';

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly userPrefix = 'gateway-user'
  ) {}

  supports(_model: string): boolean {
    return true;
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const query = input.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const res = await axios.post(
      `${this.baseUrl}/chat-messages`,
      {
        inputs: {},
        query,
        response_mode: 'blocking',
        conversation_id: input.conversationId,
        user: `${this.userPrefix}:${input.userId}`
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = res.data;

    return {
      id: data.message_id || data.conversation_id || crypto.randomUUID(),
      provider: this.name,
      model: input.model || 'dify-app',
      content: data.answer || '',
      finishReason: 'stop',
      usage: data.metadata?.usage
        ? {
            inputTokens: data.metadata.usage.prompt_tokens ?? 0,
            outputTokens: data.metadata.usage.completion_tokens ?? 0,
            totalTokens:
              (data.metadata.usage.prompt_tokens ?? 0) +
              (data.metadata.usage.completion_tokens ?? 0)
          }
        : undefined,
      raw: data
    };
  }
}
