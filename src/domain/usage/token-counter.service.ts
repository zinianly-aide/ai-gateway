import { encoding_for_model, get_encoding } from 'tiktoken';
import type { ChatMessage } from '../../core-types.js';

export class TokenCounterService {
  private getEncoder(model: string) {
    try {
      return encoding_for_model(model as any);
    } catch {
      return get_encoding('cl100k_base');
    }
  }

  countText(model: string, text: string): number {
    const enc = this.getEncoder(model);
    const tokens = enc.encode(text || '');
    enc.free();
    return tokens.length;
  }

  countMessage(model: string, message: ChatMessage): number {
    const base = this.countText(model, message.content || '');
    const roleOverhead = 4;
    const nameOverhead = message.name ? 2 : 0;
    return base + roleOverhead + nameOverhead;
  }

  countMessages(model: string, messages: ChatMessage[]): number {
    const perRequestOverhead = 3;
    return messages.reduce((sum, m) => sum + this.countMessage(model, m), perRequestOverhead);
  }

  estimateAvailableContext(params: {
    model: string;
    messages: ChatMessage[];
    modelLimit: number;
    reservedOutputTokens?: number;
  }) {
    const inputTokens = this.countMessages(params.model, params.messages);
    const reservedOutputTokens = params.reservedOutputTokens ?? 4096;
    const availableContextTokens = Math.max(params.modelLimit - reservedOutputTokens, 0);
    const remainingInputBudget = Math.max(availableContextTokens - inputTokens, 0);

    return {
      inputTokens,
      reservedOutputTokens,
      modelLimit: params.modelLimit,
      availableContextTokens,
      remainingInputBudget,
      compressionThreshold: Math.floor(availableContextTokens * 0.8)
    };
  }
}
