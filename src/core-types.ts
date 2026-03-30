export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface ChatRequest {
  userId: string;
  provider: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  conversationId?: string;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  id: string;
  provider: string;
  model: string;
  content: string;
  finishReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  raw?: any;
}
