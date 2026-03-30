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

## Dify bridge behavior

- `conversation_id` from gateway request is forwarded to Dify `conversation_id`
- Dify returned `conversation_id` is exposed back in gateway response
- Dify `metadata.usage` is mapped into OpenAI-style `usage`
- Dify upstream errors are normalized into OpenAI-style `error` payloads

## Dify streaming

Set `stream: true` in `/v1/chat/completions` and the gateway will proxy Dify streaming responses as OpenAI-style SSE chunks.

## Persistence (MVP)

Blocking chat requests now persist:

- local conversation records
- request/assistant messages
- usage records

Responses may include `gateway_conversation_id` for the local persisted conversation id.

## Query APIs

- `GET /v1/conversations` list recent local conversations
- `GET /v1/conversations/:id` get one conversation with messages
- `GET /v1/usage` get local usage summary and recent records

Streaming requests now persist the final assistant output after stream completion.
