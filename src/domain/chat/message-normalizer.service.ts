import type { ChatMessage } from '../../core-types.js';

function stringifyUnknown(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function normalizeMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content == null) return '';

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return stringifyUnknown(part);

        const typed = part as Record<string, any>;
        if (typed.type === 'text' && typeof typed.text === 'string') return typed.text;
        if (typed.type === 'input_text' && typeof typed.text === 'string') return typed.text;
        if (typeof typed.text === 'string') return typed.text;
        if (typeof typed.content === 'string') return typed.content;
        if (typed.type === 'image_url' && typed.image_url?.url) return `[image:${typed.image_url.url}]`;
        if (typed.type === 'input_image' && typed.image_url) return `[image:${typed.image_url}]`;
        return stringifyUnknown(part);
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof content === 'object') {
    const typed = content as Record<string, any>;
    if (typeof typed.text === 'string') return typed.text;
    if (typeof typed.content === 'string') return typed.content;
    return stringifyUnknown(content);
  }

  return stringifyUnknown(content);
}

export function normalizeChatMessage(message: any): ChatMessage {
  return {
    role: message.role,
    name: message.name,
    metadata: message.metadata,
    content: normalizeMessageContent(message.content)
  };
}

export function normalizeChatMessages(messages: any[]): ChatMessage[] {
  return (messages || []).map(normalizeChatMessage);
}
