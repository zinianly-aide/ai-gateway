import { encoding_for_model, get_encoding } from 'tiktoken';
import type { ChatMessage } from '../../core-types.js';

export class TokenCounterService {
  countText(model: string, text: string): number {
    try {
      const enc = encoding_for_model(model as any);
      const tokens = enc.encode(text);
      enc.free();
      return tokens.length;
    } catch {
      const enc = get_encoding('cl100k_base');
      const tokens = enc.encode(text);
      enc.free();
      return tokens.length;
    }
  }

  countMessages(model: string, messages: ChatMessage[]): number {
    return messages.reduce((sum, m) => sum + this.countText(model, `${m.role}: ${m.content}`), 0);
  }
}
