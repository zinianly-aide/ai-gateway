import type { FastifyInstance } from 'fastify';
import { LocalStoreService } from '../domain/usage/local-store.service.js';

const store = new LocalStoreService();

export async function usageRoutes(app: FastifyInstance) {
  app.get('/v1/usage', async (req: any) => {
    const records = await store.listUsageRecords(req.user.id, 100);

    const summary = records.reduce(
      (acc, r) => {
        acc.inputTokens += r.inputTokens;
        acc.outputTokens += r.outputTokens;
        acc.cost += r.cost;
        acc.totalTokens += r.totalTokens;
        return acc;
      },
      { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 }
    );

    return {
      summary,
      data: records
    };
  });
}
