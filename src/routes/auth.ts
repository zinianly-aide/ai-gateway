import type { FastifyInstance } from 'fastify';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/dev-login', async (_req, reply) => {
    const token = await reply.jwtSign({ sub: 'demo-user', role: 'admin' });
    return { accessToken: token };
  });
}
