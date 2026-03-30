import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function conversationRoutes(app: FastifyInstance) {
  app.get('/v1/conversations', async (req: any) => {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 3
        }
      }
    });

    return { data: conversations };
  });

  app.get('/v1/conversations/:id', async (req: any, reply) => {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!conversation) {
      return reply.code(404).send({ error: { message: 'Conversation not found', type: 'not_found_error' } });
    }

    return { data: conversation };
  });
}
