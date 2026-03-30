import type { ChatMessage } from '../../core-types.js';

export class CompressionService {
  shouldCompress(currentTokens: number, compressionThreshold: number): boolean {
    return currentTokens > compressionThreshold;
  }

  async compress(messages: ChatMessage[]) {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const userAssistantMessages = nonSystemMessages.filter((m) => m.role === 'user' || m.role === 'assistant');
    const otherMessages = nonSystemMessages.filter((m) => m.role !== 'user' && m.role !== 'assistant');

    const keepRecentTurns = Math.min(12, userAssistantMessages.length);
    const oldMessages = userAssistantMessages.slice(0, Math.max(0, userAssistantMessages.length - keepRecentTurns));
    const recentMessages = userAssistantMessages.slice(-keepRecentTurns);

    const summary = oldMessages
      .map((m) => `[${m.role}] ${String(m.content).replace(/\s+/g, ' ').trim()}`)
      .join('\n')
      .slice(0, 8000);

    const pinnedFacts = oldMessages
      .filter((m) => m.role === 'user')
      .slice(-8)
      .map((m) => String(m.content).replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 8);

    return {
      summary,
      pinnedFacts,
      systemMessages,
      recentMessages: [...otherMessages.slice(-4), ...recentMessages],
      droppedMessageCount: oldMessages.length,
      keptRecentTurns: keepRecentTurns
    };
  }
}
