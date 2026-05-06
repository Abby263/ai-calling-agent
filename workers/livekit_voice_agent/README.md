# LiveKit Voice Agent Worker

This worker is the production realtime voice path for Voice Concierge.

It is intentionally deployed outside Vercel because LiveKit Agents are long-running workers that
hold realtime media sessions over WebSocket/WebRTC. Vercel remains the web/API deployment; this
worker joins LiveKit rooms, speaks through OpenAI Realtime, and posts final call transcripts back to
the Vercel API.

## Environment

```bash
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_AGENT_NAME=voice-concierge-caller
LIVEKIT_WEBHOOK_SECRET=...
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-realtime
LIVEKIT_AGENT_VOICE=marin
```

`LIVEKIT_AGENT_NAME` must match the value configured in the Vercel API so explicit dispatch can find
the worker.

## Local Run

```bash
uv sync
uv run agent.py dev
```

## Production Run

```bash
uv sync --frozen
uv run agent.py start
```

Deploy this worker on LiveKit Cloud agent hosting, Fly.io, Render, Railway, ECS, Kubernetes, or any
container host that can keep a long-running process alive.
