import type { FastifyInstance } from 'fastify';

export async function modelRoutes(app: FastifyInstance) {
  app.get('/v1/models', async () => {
    return {
      object: 'list',
      data: app.modelRouter.listModels()
    };
  });
}
