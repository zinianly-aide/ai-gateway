import type { FastifyInstance } from 'fastify';
import { LocalStoreService } from '../domain/usage/local-store.service.js';

const store = new LocalStoreService();

export async function conversationRoutes(app: FastifyInstance) {
  app.get('/v1/conversations', async (req: any) => {
    const conversations = await store.listConversations(req.user.id, 50);
    return { data: conversations };
  });

  app.get('/v1/conversations/:id', async (req: any, reply) => {
    const conversation = await store.getConversation(req.user.id, req.params.id);

    if (!conversation) {
      return reply.code(404).send({ error: { message: 'Conversation not found', type: 'not_found_error' } });
    }

    return { data: conversation };
  });
}
