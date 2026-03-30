import axios from 'axios';
import type { AxiosError } from 'axios';
import type { ProviderAdapter } from './base/provider-adapter.js';
import type { ChatRequest, ChatResponse } from '../../core-types.js';

export class DifyProviderError extends Error {
  statusCode: number;
  type: string;
  code?: string;
  details?: any;

  constructor(message: string, opts?: { statusCode?: number; type?: string; code?: string; details?: any }) {
    super(message);
    this.name = 'DifyProviderError';
    this.statusCode = opts?.statusCode ?? 500;
    this.type = opts?.type ?? 'provider_error';
    this.code = opts?.code;
    this.details = opts?.details;
  }
}

/**
 * Dify app API adapter.
 * Maps gateway chat requests into Dify /v1/chat-messages blocking calls.
 *
 * Notes:
 * - conversation continuation uses input.conversationId
 * - OpenAI-style usage is mapped from Dify metadata.usage when available
 * - provider errors are normalized for upper-layer OpenAI-style error responses
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
    const query = this.buildQuery(input.messages);

    try {
      const res = await axios.post(
        `${this.baseUrl}/chat-messages`,
        {
          inputs: input.metadata?.inputs ?? {},
          query,
          response_mode: 'blocking',
          conversation_id: input.conversationId || undefined,
          user: `${this.userPrefix}:${input.userId}`
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120_000
        }
      );

      const data = res.data;
      const usage = this.mapUsage(data?.metadata?.usage);
      const content = data.answer || '';
      const responseId = data.message_id || data.task_id || data.conversation_id || crypto.randomUUID();

      return {
        id: responseId,
        provider: this.name,
        model: input.model || 'dify-app',
        content,
        finishReason: 'stop',
        usage,
        raw: {
          ...data,
          gateway: {
            upstreamConversationId: data.conversation_id,
            upstreamMessageId: data.message_id,
            upstreamTaskId: data.task_id
          }
        }
      };
    } catch (err) {
      throw this.normalizeError(err);
    }
  }

  private buildQuery(messages: ChatRequest['messages']): string {
    return messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
  }

  private mapUsage(usage: any): ChatResponse['usage'] | undefined {
    if (!usage || typeof usage !== 'object') return undefined;

    const inputTokens = Number(
      usage.prompt_tokens ?? usage.input_tokens ?? usage.total_tokens ?? 0
    );
    const outputTokens = Number(
      usage.completion_tokens ?? usage.output_tokens ?? 0
    );
    const totalTokens = Number(
      usage.total_tokens ?? inputTokens + outputTokens
    );

    if (!Number.isFinite(totalTokens)) return undefined;

    return {
      inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
      outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
      totalTokens
    };
  }

  private normalizeError(err: unknown): DifyProviderError {
    const e = err as AxiosError<any>;
    const statusCode = e.response?.status ?? 500;
    const data = e.response?.data ?? {};

    const providerCode =
      data.code || data.error_code || data.status || undefined;
    const providerMessage =
      data.message || data.msg || data.error || e.message || 'Dify request failed';

    let type = 'provider_error';
    if (statusCode === 400) type = 'invalid_request_error';
    else if (statusCode === 401 || statusCode === 403) type = 'authentication_error';
    else if (statusCode === 404) type = 'not_found_error';
    else if (statusCode === 408 || statusCode === 504) type = 'timeout_error';
    else if (statusCode === 429) type = 'rate_limit_error';
    else if (statusCode >= 500) type = 'api_error';

    return new DifyProviderError(providerMessage, {
      statusCode,
      type,
      code: providerCode,
      details: data
    });
  }
}
