import { DifyProviderError } from '../domain/providers/dify.adapter.js';
import type { FastifyInstance } from 'fastify';

export async function chatRoutes(app: FastifyInstance) {
  app.post('/v1/chat/completions', async (req: any, reply) => {
    try {
      const body = req.body as any;
      const result = await app.chatService.chat({
        userId: req.user.id,
        provider: body.provider || 'openai',
        model: body.model,
        messages: body.messages,
        temperature: body.temperature,
        maxTokens: body.max_tokens,
        stream: body.stream,
        conversationId: body.conversation_id,
        metadata: body.metadata
      });

      const response: any = {
        id: result.id,
        object: 'chat.completion',
        model: result.model,
        choices: [
          {
            index: 0,
            finish_reason: result.finishReason ?? 'stop',
            message: {
              role: 'assistant',
              content: result.content
            }
          }
        ],
        usage: result.usage
          ? {
              prompt_tokens: result.usage.inputTokens,
              completion_tokens: result.usage.outputTokens,
              total_tokens: result.usage.totalTokens
            }
          : undefined
      };

      const upstreamConversationId = result.raw?.gateway?.upstreamConversationId;
      if (upstreamConversationId) {
        response.conversation_id = upstreamConversationId;
      }

      return reply.send(response);
    } catch (err: any) {
      if (err instanceof DifyProviderError) {
        return reply.code(err.statusCode).send({
          error: {
            message: err.message,
            type: err.type,
            param: null,
            code: err.code || null
          }
        });
      }

      req.log.error(err);
      return reply.code(500).send({
        error: {
          message: err?.message || 'Internal Server Error',
          type: 'internal_server_error',
          param: null,
          code: null
        }
      });
    }
  });
}
