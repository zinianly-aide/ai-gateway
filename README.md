# ai-gateway

A Node.js/TypeScript AI gateway for Dify/OpenAI-compatible routing.

## Features (MVP)

- OpenAI-compatible `/v1/chat/completions`
- Multi-provider adapter skeleton
- Context compression hook
- Token counting via `tiktoken`
- Prisma schema for users/conversations/usage

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## Next steps

- JWT auth + API keys
- Redis rate limiting
- Usage/cost persistence
- Streaming support
- Provider fallback
