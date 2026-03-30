import axios from 'axios';
import type { ProviderAdapter } from '../base/provider-adapter.js';
import type { ChatRequest, ChatResponse } from '../../../core-types.js';

export class OpenAIAdapter implements ProviderAdapter {
  name = 'openai';

  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  supports(model: string): boolean {
    return !!model;
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const res = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        stream: false
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = res.data;
    const choice = data.choices?.[0];

    return {
      id: data.id,
      provider: this.name,
      model: data.model,
      content: choice?.message?.content ?? '',
      finishReason: choice?.finish_reason,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens ?? 0,
            outputTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0
          }
        : undefined,
      raw: data
    };
  }
}
