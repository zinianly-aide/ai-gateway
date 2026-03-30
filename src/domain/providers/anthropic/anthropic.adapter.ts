import axios from 'axios';
import type { ProviderAdapter } from '../base/provider-adapter.js';
import type { ChatRequest, ChatResponse } from '../../../core-types.js';

export class AnthropicAdapter implements ProviderAdapter {
  name = 'anthropic';

  constructor(private readonly apiKey: string) {}

  supports(model: string): boolean {
    return model.startsWith('claude');
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const system = input.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const messages = input.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const res = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: input.model,
        system,
        messages,
        max_tokens: input.maxTokens ?? 1024,
        temperature: input.temperature ?? 0.7
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    const data = res.data;
    const text = data.content?.map((x: any) => x.text ?? '').join('\n') ?? '';

    return {
      id: data.id,
      provider: this.name,
      model: data.model,
      content: text,
      finishReason: data.stop_reason,
      usage: data.usage
        ? {
            inputTokens: data.usage.input_tokens ?? 0,
            outputTokens: data.usage.output_tokens ?? 0,
            totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0)
          }
        : undefined,
      raw: data
    };
  }
}
