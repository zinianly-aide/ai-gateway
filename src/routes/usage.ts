import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function usageRoutes(app: FastifyInstance) {
  app.get('/v1/usage', async (req: any) => {
    const records = await prisma.usageRecord.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const summary = records.reduce(
      (acc, r) => {
        acc.inputTokens += r.inputTokens;
        acc.outputTokens += r.outputTokens;
        acc.cost += r.cost;
        return acc;
      },
      { inputTokens: 0, outputTokens: 0, cost: 0 }
    );

    return {
      summary,
      data: records
    };
  });
}
