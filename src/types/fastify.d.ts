import 'fastify';
import type { ChatService } from '../domain/chat/chat.service.js';
import type { ModelRouterService } from '../domain/routing/model-router.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    chatService: ChatService;
    modelRouter: ModelRouterService;
  }

  interface FastifyRequest {
    user?: {
      id: string;
    };
  }
}
