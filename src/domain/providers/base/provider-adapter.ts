import type { ChatRequest, ChatResponse } from '../../../core-types.js';

export interface ProviderAdapter {
  name: string;
  supports(model: string): boolean;
  chat(input: ChatRequest): Promise<ChatResponse>;
}
