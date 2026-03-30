import type { FastifyInstance } from 'fastify';

export async function chatRoutes(app: FastifyInstance) {
  app.post('/v1/chat/completions', async (req: any, reply) => {
    const body = req.body as any;
    const result = await app.chatService.chat({
      userId: req.user.id,
      provider: body.provider || 'openai',
      model: body.model,
      messages: body.messages,
      temperature: body.temperature,
      maxTokens: body.max_tokens,
      stream: body.stream,
      conversationId: body.conversation_id
    });

    return reply.send({
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
    });
  });
}
