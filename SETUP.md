# Setup Guide

This guide explains how to run Voice Concierge Agent locally, how to configure real providers, and how to deploy the production app.

## 1. Prerequisites

Install:

- Node.js 20 or newer
- npm
- Python 3.11 or newer
- Docker Desktop or another Docker runtime
- GitHub CLI, optional but recommended
- Vercel CLI, optional but recommended

Check versions:

```bash
node --version
npm --version
python --version
docker --version
```

## 2. Clone And Install

```bash
git clone https://github.com/Abby263/ai-calling-agent.git
cd ai-calling-agent
cp .env.example .env
```

Install frontend dependencies:

```bash
npm ci --prefix frontend
```

Install backend dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cd ..
```

## 3. Start Local Infrastructure

The included compose file starts PostgreSQL and Redis.

```bash
docker compose up -d
```

Default local URLs:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

## 4. Run In Safe Demo Mode

Demo mode is the safest first run. It does not place real phone calls, call Google Places, or make OpenAI requests.

Make sure `.env` contains:

```bash
DEMO_MODE=true
ALLOW_CALL_RECORDING=false
VITE_API_BASE_URL=http://localhost:8000
```

Start the backend:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Start the frontend in another terminal:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Health check:

```bash
curl -sS http://localhost:8000/health
```

Expected demo response:

```json
{
  "status": "ok",
  "demo_mode": true,
  "google_places_enabled": false,
  "twilio_enabled": false,
  "openai_enabled": false
}
```

## 5. Environment Variables

Copy `.env.example` to `.env` and fill only what you need.

```bash
cp .env.example .env
```

### Shared

| Variable | Example | Notes |
| --- | --- | --- |
| `APP_ENV` | `development` | Use `production` in deployed environments |
| `PUBLIC_BASE_URL` | `https://your-domain.com` | Public backend URL for callbacks |
| `BACKEND_CORS_ORIGINS` | `http://localhost:5173` | Comma-separated frontend origins |
| `DEMO_MODE` | `true` | Set to `false` only after real providers are configured |
| `MAX_CALLS_PER_TASK` | `5` | Hard limit per task |
| `ALLOW_CALL_RECORDING` | `false` | Enable only where lawful and configured |

### Database And Queue

| Variable | Example | How to get it |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Local Docker, Supabase, Neon, Railway, Render, RDS, or another Postgres provider |
| `REDIS_URL` | `redis://localhost:6379/0` | Local Docker, Upstash, Railway, Render, or Elasticache |

Local default:

```bash
DATABASE_URL=postgresql://voice_concierge:voice_concierge@localhost:5432/voice_concierge
REDIS_URL=redis://localhost:6379/0
```

### OpenAI

| Variable | Example | How to get it |
| --- | --- | --- |
| `OPENAI_API_KEY` | `sk-...` | Create an API key in the OpenAI dashboard |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Choose a model your account can access |

Steps:

1. Go to the OpenAI platform dashboard.
2. Create or select a project.
3. Create an API key.
4. Add it to `.env` locally and to Vercel project environment variables for production.

### Google Places

| Variable | Example | How to get it |
| --- | --- | --- |
| `GOOGLE_PLACES_API_KEY` | `AIza...` | Google Cloud Console API key |

Steps:

1. Open Google Cloud Console.
2. Create or select a project.
3. Enable Places API.
4. Create an API key.
5. Restrict the key to the required APIs.
6. For production, add HTTP referrer or server restrictions based on your deployment pattern.
7. Add `GOOGLE_PLACES_API_KEY` to `.env` and Vercel.

### Twilio

| Variable | Example | How to get it |
| --- | --- | --- |
| `TWILIO_ACCOUNT_SID` | `AC...` | Twilio Console project dashboard |
| `TWILIO_AUTH_TOKEN` | `...` | Twilio Console project dashboard |
| `TWILIO_FROM_NUMBER` | `+14165550100` | Purchased or verified Twilio number |

Steps:

1. Create a Twilio account.
2. Buy a voice-capable phone number or verify a caller ID for test mode.
3. Copy Account SID and Auth Token from the Twilio Console.
4. Set `TWILIO_FROM_NUMBER` to the E.164 phone number you will call from.
5. Configure webhook URLs after deployment.

For local webhook testing, expose the backend:

```bash
ngrok http 8000
```

Then set:

```bash
PUBLIC_BASE_URL=https://your-ngrok-url.ngrok.app
```

### Frontend

| Variable | Example | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Used locally. On Vercel, same-origin API routing can be used instead |

## 6. Real Provider Mode

After configuring OpenAI, Google Places, Twilio, and Postgres:

```bash
DEMO_MODE=false
```

Then restart the backend.

Run health check:

```bash
curl -sS http://localhost:8000/health
```

You should see provider flags change to `true` for configured services.

## 7. Database Schema

The database schema is in:

```text
backend/app/db/schema.sql
```

Tables:

- `users`
- `search_tasks`
- `businesses`
- `calls`
- `summaries`

Apply schema manually to your Postgres provider or wire it into your migration tool.

Example:

```bash
psql "$DATABASE_URL" -f backend/app/db/schema.sql
```

## 8. Vercel Deployment

This repository includes:

- `vercel.json`
- root `package.json`
- `api/index.py`
- `requirements.txt`

Deploy:

```bash
npx vercel deploy --prod
```

Recommended Vercel environment variables:

```bash
APP_ENV=production
PUBLIC_BASE_URL=https://your-vercel-domain.vercel.app
DATABASE_URL=...
REDIS_URL=...
BACKEND_CORS_ORIGINS=https://your-vercel-domain.vercel.app
MAX_CALLS_PER_TASK=5
DEMO_MODE=false
ALLOW_CALL_RECORDING=false
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
GOOGLE_PLACES_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=...
```

`VITE_API_BASE_URL` can be omitted on Vercel because the frontend uses same-origin API routes by default.

## 9. GitHub And Redeploys

The current repository is connected to Vercel. Pushes or merges to `main` trigger production redeploys.

Recommended branch flow:

```bash
git checkout -b feature/my-change
git add -A
git commit -m "Describe change"
git push origin feature/my-change
```

Open a pull request. After merge to `main`, Vercel deploys production automatically.

## 10. Production Voice Worker Recommendation

Vercel is good for the web dashboard and API facade. Real phone calls are long-running realtime sessions, so production voice workers should run outside Vercel.

Recommended production split:

- Vercel: React frontend, FastAPI API routes, task facade.
- Worker platform: LiveKit Cloud, Fly.io, Render, Railway, ECS, or Kubernetes.
- Voice framework: LiveKit Agents for room/SIP based voice agents, or Pipecat for deeper custom media pipelines.
- Store: PostgreSQL for task and call state.
- Queue: Redis, Celery, BullMQ, Temporal, or another durable workflow runner.

## 11. Compliance Checklist

Before enabling real calls:

- Confirm the use case is not marketing, sales spam, emergency, or sensitive outreach.
- Keep `MAX_CALLS_PER_TASK` low.
- Require user approval before calling.
- Log AI disclosure.
- Respect business hours.
- Do not repeatedly call the same number.
- Disable recordings unless legal requirements and consent are handled.
- Encrypt production database storage.
- Define transcript retention and deletion policy.
- Provide task deletion in the UI.

## 12. Troubleshooting

### Backend cannot import dependencies

Activate the backend virtual environment:

```bash
cd backend
source .venv/bin/activate
pip install -e ".[dev]"
```

### Frontend cannot reach API

Check:

```bash
VITE_API_BASE_URL=http://localhost:8000
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Restart both servers after editing `.env`.

### Google Places returns no results

Check:

- Places API is enabled.
- API key restrictions allow your backend.
- Request has a location or manual fallback.
- `DEMO_MODE=false`.

### Twilio calls do not start

Check:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- Number format is E.164, for example `+14165550100`.
- `PUBLIC_BASE_URL` is public HTTPS.
- Twilio trial accounts can call only verified numbers.

### Vercel production still shows demo mode

Check Vercel environment variables and redeploy after changing them:

```bash
npx vercel env ls
npx vercel redeploy
```
