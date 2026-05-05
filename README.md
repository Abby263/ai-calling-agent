# Voice Concierge Agent

Production-oriented MVP for a voice concierge that can call user-provided phone numbers for a general task or search nearby businesses first, ask approved phone questions through an AI-disclosed call flow, extract structured answers, and summarize recommendations.

The default local mode is safe demo mode: no real calls, no external Places lookups, and no OpenAI requests unless you set provider keys and `DEMO_MODE=false`.

## Project Structure

```text
.
├── backend/                  # FastAPI API, agents, provider adapters, schema
│   ├── app/api/              # REST endpoints and Twilio webhooks
│   ├── app/core/             # Settings and environment handling
│   ├── app/db/               # In-memory dev store and PostgreSQL schema
│   └── app/services/         # Agents, orchestration, Places, Twilio
├── frontend/                 # React + TypeScript + Tailwind responsive web app
├── mobile/                   # Expo-ready mobile shell for later native buildout
├── packages/shared/          # Shared TypeScript API contracts
├── docs/                     # Architecture, prompts, API, deployment notes
├── docker-compose.yml        # Local PostgreSQL and Redis
└── .env.example              # Required environment variables
```

## Local Setup

```bash
cp .env.example .env
docker compose up -d

cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

cd ../frontend
npm install
npm run dev
```

Open the web app at `http://localhost:5173`. Backend health is available at `http://localhost:8000/health`.

## Environment Variables

`DEMO_MODE=true` keeps the app local and safe. Set it to `false` only after provider configuration is complete.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for production repository implementation |
| `REDIS_URL` | Queue backend for Celery/BullMQ/Temporal in later phases |
| `BACKEND_CORS_ORIGINS` | Comma-separated frontend origins |
| `PUBLIC_BASE_URL` | Public HTTPS URL for Twilio webhooks |
| `OPENAI_API_KEY` | Planning, extraction, and summarization |
| `OPENAI_MODEL` | Configurable GPT model name |
| `GOOGLE_PLACES_API_KEY` | Nearby business search |
| `TWILIO_ACCOUNT_SID` | Twilio project SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Verified outbound caller ID |
| `MAX_CALLS_PER_TASK` | Hard cap; default and MVP max is 5 |
| `ALLOW_CALL_RECORDING` | Enables Twilio recording/transcription callbacks when lawful and configured |
| `VITE_API_BASE_URL` | Frontend API URL |

## MVP Flow

1. User speaks, types, or pastes a general request.
2. `RequestParserAgent` detects `direct_calls` when phone numbers are present, or `nearby_search` when discovery is needed.
3. For direct calls, the app creates a contact call list from the provided numbers.
4. For nearby search, browser/manual location plus optional filters are used for Google Places.
5. User approves the call list and edits questions.
6. `VoiceCallAgent` places Twilio calls, or simulates calls in demo mode.
7. `TranscriptExtractionAgent` converts transcripts into structured outcome JSON.
8. `SummaryAgent` produces a tracker or comparison table with uncertainty notes.

## Current Implementation Notes

- The backend uses an in-memory task store in demo mode and an optional PostgreSQL store when `DEMO_MODE=false` with `DATABASE_URL` configured.
- Google Places, Twilio, and OpenAI integrations are implemented behind agent/provider boundaries with demo fallbacks.
- The web app starts from a natural-language task composer, supports direct phone-number call lists, keeps nearby filters behind an advanced panel, and includes request history, preview approval, question editing, call timeline, transcript viewer, summary, PDF print, email, JSON export, and delete history.
- Clinic requests such as "Book an appointment with a doctor from Apple Tree at Harbour Street near me" are handled as appointment availability tasks. The agent asks for slots and booking requirements but does not exchange medical details.
- The mobile app is an Expo-ready shell that mirrors the web flow and shares API contracts.

## Compliance Controls

- The call script always discloses that the caller is an AI assistant.
- Calls are made on behalf of the user and only after explicit approval.
- Calls are capped to `MAX_CALLS_PER_TASK`.
- Businesses without phone numbers, closed businesses, and blocked sensitive categories are skipped.
- The task deletion endpoint removes the task from the active store; production should cascade delete transcripts, recordings, and summaries from persistent storage.
- Recording is disabled by default and should only be enabled where lawful with provider configuration and retention controls.

## Verification

```bash
cd backend
pytest

cd ../frontend
npm run build
```

## Deployment

This repo includes `vercel.json`, a root `package.json`, and `api/index.py` so Vercel can deploy the Vite frontend and FastAPI API from the same project. See `docs/deployment.md` for production deployment steps, provider setup, and hardening checklist.
