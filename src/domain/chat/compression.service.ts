import type { ChatMessage } from '../../core-types.js';

export class CompressionService {
  shouldCompress(currentTokens: number, modelLimit: number): boolean {
    return currentTokens > modelLimit * 0.75;
  }

  async compress(messages: ChatMessage[]) {
    const oldMessages = messages.slice(0, -12);
    const recentMessages = messages.slice(-12);
    const summary = oldMessages.map((m) => `[${m.role}] ${m.content}`).join('\n').slice(0, 4000);
    return { summary, pinnedFacts: [] as string[], recentMessages };
  }
}
