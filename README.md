# ai-gateway

A Node.js/TypeScript AI gateway for Dify/OpenAI-compatible routing.

## What works now

- OpenAI-compatible `POST /v1/chat/completions`
- OpenAI-compatible `GET /v1/models`
- Dify bridge for blocking + streaming chat
- Model auto-routing:
  - `dify-app` / `dify/*` -> `dify`
  - `claude*` -> `anthropic`
  - fallback -> `openai`
- JWT dev login endpoint for local testing
- Local JSON persistence for:
  - conversations
  - messages
  - usage records
- Local + upstream conversation continuation:
  - `gateway_conversation_id` for local conversation restore
  - `conversation_id` for upstream Dify continuation
- Token counting with `tiktoken`
- Context budget estimation + compression metadata for Cline-style clients

## Current storage model

This project currently uses **local JSON storage**, not PostgreSQL.

Default file:

```bash
data/local-store.json
```

This keeps the setup minimal while building out token-aware context management.

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## Environment

Required for Dify routing:

```bash
DIFY_BASE_URL=http://localhost/v1
DIFY_API_KEY=app-xxxxx
JWT_SECRET=change-me
```

Optional:

```bash
PORT=3000
DIFY_TIMEOUT_MS=180000
LOCAL_STORE_PATH=./data/local-store.json
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

## Dev login

Get a JWT for local testing:

```bash
curl -X POST http://localhost:3000/auth/dev-login
```

Use the returned `accessToken` as:

```bash
Authorization: Bearer <token>
```

## OpenAI-compatible usage

### List models

```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer <token>"
```

### Blocking chat

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "dify-app",
    "messages": [
      {"role": "user", "content": "hello"}
    ]
  }'
```

### Streaming chat

```bash
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "dify-app",
    "stream": true,
    "messages": [
      {"role": "user", "content": "hello"}
    ]
  }'
```

## Conversation continuation

The gateway supports two IDs:

- `conversation_id`: upstream Dify conversation id
- `gateway_conversation_id`: local ai-gateway conversation id

Send both back on the next request to restore local history and continue the upstream Dify session.

Example:

```json
{
  "model": "dify-app",
  "conversation_id": "upstream-conv-id",
  "gateway_conversation_id": "local-conv-id",
  "messages": [
    {"role": "user", "content": "continue"}
  ]
}
```

## Token debug / compression metadata

Responses may include:

```json
{
  "token_debug": {
    "compressed": false,
    "originalMessageCount": 1,
    "historicalMessageCount": 2,
    "mergedMessageCount": 3,
    "finalMessageCount": 3,
    "restoredFromConversation": "local-conv-id",
    "restoredUpstreamConversationId": "upstream-conv-id",
    "before": {
      "inputTokens": 57,
      "reservedOutputTokens": 512,
      "modelLimit": 16000,
      "availableContextTokens": 15488,
      "remainingInputBudget": 15431,
      "compressionThreshold": 12390
    },
    "after": {
      "inputTokens": 57,
      "reservedOutputTokens": 512,
      "modelLimit": 16000,
      "availableContextTokens": 15488,
      "remainingInputBudget": 15431,
      "compressionThreshold": 12390
    },
    "compressionSummaryTokens": 0,
    "pinnedFactsCount": 0,
    "droppedMessageCount": 0,
    "keptRecentTurns": 0
  }
}
```

This is intended for client-side debugging and context-budget tuning.

## Query APIs

### List conversations

```bash
curl http://localhost:3000/v1/conversations \
  -H "Authorization: Bearer <token>"
```

### Get one conversation

```bash
curl http://localhost:3000/v1/conversations/<gateway_conversation_id> \
  -H "Authorization: Bearer <token>"
```

### Usage summary

```bash
curl http://localhost:3000/v1/usage \
  -H "Authorization: Bearer <token>"
```

## Cline setup

Use ai-gateway as an OpenAI-compatible endpoint:

- Base URL: `http://127.0.0.1:3000/v1`
- API Key: JWT from `/auth/dev-login`
- Model: `dify-app`

Recommended request metadata for context tuning:

```json
{
  "metadata": {
    "modelLimit": 16000,
    "reservedOutputTokens": 1024
  }
}
```

## Notes

- Streaming currently forwards upstream chunks as OpenAI-style SSE chunks.
- Dify upstream reasoning / hidden-thought style output is **not filtered** right now by request.
- PostgreSQL/Prisma schema remains in the repo, but runtime persistence is currently local-first.

## Next sensible steps

- Make compression parameters configurable
- Add real API key auth
- Add optional PostgreSQL adapter behind a storage interface
- Add better streaming final metadata / usage handling
- Add provider fallback / retry policies
