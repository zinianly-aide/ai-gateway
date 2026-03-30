import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import fastifyJwt from '@fastify/jwt';
import { ProviderRegistry } from './domain/providers/provider-registry.js';
import { OpenAIAdapter } from './domain/providers/openai/openai.adapter.js';
import { AnthropicAdapter } from './domain/providers/anthropic/anthropic.adapter.js';
import { TokenCounterService } from './domain/usage/token-counter.service.js';
import { CompressionService } from './domain/chat/compression.service.js';
import { ChatService } from './domain/chat/chat.service.js';
import { chatRoutes } from './routes/chat.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors);
  await app.register(sensible);
  await app.register(fastifyJwt, { secret: process.env.JWT_SECRET || 'change-me' });

  const registry = new ProviderRegistry();
  if (process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY) {
    registry.registerProvider(new OpenAIAdapter(process.env.OPENAI_BASE_URL, process.env.OPENAI_API_KEY));
  }
  if (process.env.ANTHROPIC_API_KEY) {
    registry.registerProvider(new AnthropicAdapter(process.env.ANTHROPIC_API_KEY));
  }

  const tokenCounter = new TokenCounterService();
  const compressionService = new CompressionService();
  const chatService = new ChatService(registry, tokenCounter, compressionService);

  app.decorate('chatService', chatService);
  app.addHook('preHandler', async (req: any) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const decoded = await req.jwtVerify();
        req.user = { id: (decoded as any).sub || 'demo-user' };
        return;
      } catch {}
    }
    req.user = { id: 'demo-user' };
  });

  await healthRoutes(app);
  await authRoutes(app);
  await chatRoutes(app);

  return app;
}
