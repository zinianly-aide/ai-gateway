# ai-gateway

A Node.js/TypeScript AI gateway for Dify/OpenAI-compatible routing.

## Features (MVP)

- OpenAI-compatible `/v1/chat/completions`
- Multi-provider adapter skeleton: OpenAI / Anthropic / Dify
- Context compression hook
- Token counting via `tiktoken`
- Prisma schema for users/conversations/usage
- JWT dev login endpoint

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## Dev login

```bash
curl -X POST http://localhost:3000/auth/dev-login
```

## Local Dify bridge

Set in `.env`:

```bash
DIFY_BASE_URL=http://localhost/v1
DIFY_API_KEY=app-xxxxx
```

Then call gateway with:

```json
{
  "provider": "dify",
  "model": "dify-app",
  "messages": [
    {"role": "user", "content": "hello"}
  ]
}
```

The gateway will forward to Dify `/v1/chat-messages` in blocking mode.

## Next steps

- Real API key auth
- Redis rate limiting
- Usage/cost persistence
- Streaming support
- Provider fallback
