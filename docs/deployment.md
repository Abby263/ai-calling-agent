# Deployment Plan

## Phase 1 Production Hardening

1. Use Neon Postgres in production by setting `DEMO_MODE=false` and `DATABASE_URL`.
2. Enable `AUTH_REQUIRED=true` with Clerk credentials for paid task APIs.
3. Encrypt or redact transcripts at rest.
4. Add background orchestration with Redis plus Celery, BullMQ, or Temporal.
5. Add provider retry policies and idempotency keys for call creation.
6. Add structured logging and audit events for disclosure, consent, task deletion, and provider calls.

## Backend

Deploy FastAPI on a platform that supports public HTTPS webhooks.

Recommended runtime:

- Python 3.11+
- Neon Postgres or PostgreSQL 16+
- Redis 7+
- HTTPS public domain for Twilio callbacks

Run command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

## Frontend

Build and deploy the React app as static assets.

```bash
cd frontend
npm run build
```

Set `VITE_API_BASE_URL` to the backend origin at build time.

For the included Vercel deployment, leave `VITE_API_BASE_URL` unset so the app uses same-origin `/api` in production.

## Vercel

The repository includes:

- `vercel.json` for static frontend output plus Python API rewrites.
- `api/index.py` as the FastAPI serverless entrypoint.
- root `package.json` with a Vercel build command.
- `requirements.txt` for Python function dependencies.

When the project is connected to GitHub through Vercel Git integration, every merge to the production branch triggers a new production deployment automatically. Pull requests receive preview deployments.

Required production env vars include provider credentials plus:

- `AUTH_REQUIRED=true`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_AUTHORIZED_PARTIES`
- `FREE_REQUEST_LIMIT`
- `ADMIN_EMAILS` or `ADMIN_CLERK_SUBJECTS` for unlimited admin usage

The public website remains browsable without login. Task creation, task history, transcripts, approval, cancel, and delete APIs require a signed-in session when auth is enabled.

## Twilio

1. Buy or verify an outbound caller ID.
2. Configure account credentials as environment variables.
3. Set `PUBLIC_BASE_URL` to the backend HTTPS URL.
4. Keep `ALLOW_CALL_RECORDING=false` until recording compliance is approved.
5. Test with a verified number before calling businesses.

## LiveKit Voice Runtime

Use this path when `VOICE_RUNTIME=livekit`.

Vercel should not host the long-running agent worker. Keep Vercel as the product/API deployment and
run `workers/livekit_voice_agent` on LiveKit Cloud agent hosting or a container host.

Required env vars on Vercel:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_SIP_OUTBOUND_TRUNK_ID`
- `LIVEKIT_AGENT_NAME`
- `LIVEKIT_WEBHOOK_SECRET`

Required env vars on the worker:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_AGENT_NAME`
- `LIVEKIT_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

Keep `VOICE_RUNTIME=twilio` until the worker is deployed and the LiveKit outbound trunk can place a
test call through Twilio Elastic SIP Trunking.

## Google Places

1. Enable Places API.
2. Restrict key by backend IP or service identity.
3. Add quota alerts.
4. Monitor Details API usage because the app fetches phone, website, hours, rating, and maps URLs.

## OpenAI

1. Set `OPENAI_API_KEY`.
2. Choose `OPENAI_MODEL` per latency/cost needs.
3. Keep demo fallback enabled in staging until prompts and schemas pass regression tests.

## Error Handling and Observability

- Emit structured events for parse, search, ranking, approval, call create, webhook status, transcript extraction, summary, cancel, and delete.
- Mark provider failures on the task without losing partial results.
- Display uncertainty when transcripts are missing or extraction confidence is low.
- Add dead-letter queue handling for failed webhook/extraction jobs in later phases.

## Roadmap

1. Text-based search and preview.
2. Structured planner and ranking.
3. Twilio outbound calls with fixed questions.
4. Realtime AI voice conversation.
5. Transcript extraction and final summary.
6. Native mobile app and polished dashboard.
7. Additional verticals: salons, clinics, stores, hotels, venues, dietary requests.
