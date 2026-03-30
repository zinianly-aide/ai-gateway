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

export class DifyAdapter implements ProviderAdapter {
  name = 'dify';

  private debugLog(stage: string, meta: Record[str, any] | Record<string, any>) {
    try {
      console.log('[dify]', stage, JSON.stringify(meta));
    } catch {
      console.log('[dify]', stage, meta);
    }
  }

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
      this.debugLog('blocking.request', { baseUrl: this.baseUrl, conversationId: input.conversationId || null, userId: input.userId, model: input.model, queryPreview: query.slice(0, 120) });
      const startedAt = Date.now();
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
          timeout: Number(process.env.DIFY_TIMEOUT_MS || 180000)
        }
      );

      this.debugLog('blocking.response', { elapsedMs: Date.now() - startedAt, status: res.status, upstreamConversationId: res.data?.conversation_id || null, hasAnswer: Boolean(res.data?.answer), answerPreview: String(res.data?.answer || '').slice(0, 120) });
      return this.mapBlockingResponse(res.data, input.model || 'dify-app');
    } catch (err) {
      this.debugLog('blocking.error', { message: (err as any)?.message || 'unknown error' });
      throw this.normalizeError(err);
    }
  }

  async *streamChat(input: ChatRequest): AsyncGenerator<string, void, unknown> {
    const query = this.buildQuery(input.messages);

    let response;
    try {
      this.debugLog('stream.request', { baseUrl: this.baseUrl, conversationId: input.conversationId || null, userId: input.userId, model: input.model, queryPreview: query.slice(0, 120) });
      response = await fetch(`${this.baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: input.metadata?.inputs ?? {},
          query,
          response_mode: 'streaming',
          conversation_id: input.conversationId || undefined,
          user: `${this.userPrefix}:${input.userId}`
        })
      });
    } catch (err) {
      this.debugLog('blocking.error', { message: (err as any)?.message || 'unknown error' });
      throw this.normalizeError(err);
    }

    if (!response.ok || !response.body) {
      let details: any = {};
      try {
        details = await response.json();
      } catch {}
      throw new DifyProviderError(details?.message || `Dify streaming failed: HTTP ${response.status}`, {
        statusCode: response.status,
        type: response.status === 429 ? 'rate_limit_error' : response.status >= 500 ? 'api_error' : 'provider_error',
        code: details?.code,
        details
      });
    }

    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of response.body as any) {
      buffer += decoder.decode(chunk, { stream: true });

      while (true) {
        const idx = buffer.indexOf('\n\n');
        if (idx === -1) break;

        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        const lines = rawEvent.split('\n').filter(Boolean);
        const dataLines = lines.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim());
        if (!dataLines.length) continue;

        const payload = dataLines.join('\n');
        if (payload === '[DONE]') return;

        let event: any;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        if (event.event === 'message' || event.event === 'agent_message') {
          const text = event.answer ?? event.chunk ?? event.delta ?? '';
          if (text) {
            this.debugLog('stream.chunk', { len: String(text).length, preview: String(text).slice(0, 80) });
            yield text;
          }
        }

        if (event.event === 'error') {
          throw new DifyProviderError(event.message || 'Dify streaming error', {
            statusCode: 500,
            type: 'provider_error',
            code: event.code,
            details: event
          });
        }
      }
    }
  }

  private buildQuery(messages: ChatRequest['messages']): string {
    return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  }

  private mapBlockingResponse(data: any, model: string): ChatResponse {
    const usage = this.mapUsage(data?.metadata?.usage);
    const content = data.answer || '';
    const responseId = data.message_id || data.task_id || data.conversation_id || crypto.randomUUID();

    return {
      id: responseId,
      provider: this.name,
      model,
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
  }

  private mapUsage(usage: any): ChatResponse['usage'] | undefined {
    if (!usage || typeof usage !== 'object') return undefined;
    const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.total_tokens ?? 0);
    const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
    const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens);
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
    const providerCode = data.code || data.error_code || data.status || undefined;
    const providerMessage = data.message || data.msg || data.error || e.message || 'Dify request failed';

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
