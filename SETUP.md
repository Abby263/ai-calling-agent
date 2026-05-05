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

The current production app is deployed at:

```text
https://ai-calling-agent-snowy.vercel.app
```

Vercel runs the React frontend as a static build and the FastAPI backend through the Python function in `api/index.py`. Use Vercel for the web app, API facade, approvals, task history, and webhooks. Use a separate worker runtime for long-running realtime voice agents once you move beyond the scripted MVP.

### 8.1 Choose A Deployment Mode

Start with demo mode if you only want the deployed UI and API smoke-tested.

Demo mode does not require OpenAI, Google Places, Twilio, Postgres, or Redis:

```bash
APP_ENV=production
PUBLIC_BASE_URL=https://your-vercel-domain.vercel.app
BACKEND_CORS_ORIGINS=https://your-vercel-domain.vercel.app
MAX_CALLS_PER_TASK=5
DEMO_MODE=true
ALLOW_CALL_RECORDING=false
```

Real provider mode requires external services:

```bash
APP_ENV=production
PUBLIC_BASE_URL=https://your-vercel-domain.vercel.app
DATABASE_URL=postgresql://...
REDIS_URL=redis://... # recommended for queued workers
BACKEND_CORS_ORIGINS=https://your-vercel-domain.vercel.app
MAX_CALLS_PER_TASK=5
DEMO_MODE=false
ALLOW_CALL_RECORDING=false
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
GOOGLE_PLACES_API_KEY=...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+14165550100
```

`VITE_API_BASE_URL` can be omitted on Vercel because the frontend uses same-origin `/api` routes by default. Set it only if the frontend is deployed separately from the backend.

### 8.2 Link The Vercel Project

Install or run the Vercel CLI:

```bash
npx vercel login
npx vercel link
```

When linking:

- Select the account or team that owns the deployment.
- Link to the existing `ai-calling-agent` project, or create a new project.
- Keep the production branch set to `main`.
- Let Vercel use `vercel.json`; no custom framework preset is required.

If you are setting up from the Vercel dashboard instead:

1. Go to Vercel and import `https://github.com/Abby263/ai-calling-agent`.
2. Keep the root directory as the repository root.
3. Keep Git integration enabled.
4. Set production branch to `main`.
5. Add the environment variables below before enabling real providers.

### 8.3 Add Vercel Environment Variables

Add secrets in Vercel Project Settings, not in source control:

```text
Vercel project -> Settings -> Environment Variables
```

CLI alternative:

```bash
npx vercel env add APP_ENV production preview development
npx vercel env add PUBLIC_BASE_URL production preview development
npx vercel env add BACKEND_CORS_ORIGINS production preview development
npx vercel env add MAX_CALLS_PER_TASK production preview development
npx vercel env add DEMO_MODE production preview development
npx vercel env add ALLOW_CALL_RECORDING production preview development
```

For real provider mode, also add:

```bash
npx vercel env add DATABASE_URL production preview
npx vercel env add REDIS_URL production preview
npx vercel env add OPENAI_API_KEY production preview
npx vercel env add OPENAI_MODEL production preview
npx vercel env add GOOGLE_PLACES_API_KEY production preview
npx vercel env add TWILIO_ACCOUNT_SID production preview
npx vercel env add TWILIO_AUTH_TOKEN production preview
npx vercel env add TWILIO_FROM_NUMBER production preview
```

Pull Vercel envs locally when you need to reproduce the deployed configuration:

```bash
npx vercel env pull .env.local --environment=production --yes
```

Never commit `.env.local` or provider secrets.

### 8.4 Where To Get Each Production Value

| Variable | Required for demo | Required for real calls | Where to get it |
| --- | --- | --- | --- |
| `APP_ENV` | Yes | Yes | Set to `production` manually |
| `PUBLIC_BASE_URL` | Yes | Yes | Use the stable Vercel domain, for example `https://ai-calling-agent-snowy.vercel.app` |
| `BACKEND_CORS_ORIGINS` | Yes | Yes | Same Vercel origin as `PUBLIC_BASE_URL`; add comma-separated extra origins only if needed |
| `MAX_CALLS_PER_TASK` | Yes | Yes | Product policy value, normally `5` for MVP |
| `DEMO_MODE` | Yes | Yes | `true` for safe demos, `false` only after all real providers are ready |
| `ALLOW_CALL_RECORDING` | Yes | Yes | Keep `false` unless legal consent, retention, and disclosure requirements are handled |
| `DATABASE_URL` | No | Yes | Postgres provider connection string from Neon, Supabase, Railway, Render, RDS, or another Postgres host |
| `REDIS_URL` | No | Recommended | Redis provider connection string from Upstash, Railway, Render, Elasticache, or another Redis host |
| `OPENAI_API_KEY` | No | Yes | OpenAI Platform project API key |
| `OPENAI_MODEL` | No | Yes | Model name your OpenAI project can access; default is `gpt-4.1-mini` |
| `GOOGLE_PLACES_API_KEY` | No | Yes for nearby discovery | Google Cloud API key with Places API enabled |
| `TWILIO_ACCOUNT_SID` | No | Yes for calls | Twilio Console account dashboard |
| `TWILIO_AUTH_TOKEN` | No | Yes for calls | Twilio Console account dashboard |
| `TWILIO_FROM_NUMBER` | No | Yes for calls | Voice-capable Twilio number in E.164 format |
| `VITE_API_BASE_URL` | No | Usually no | Omit for same-origin Vercel deployment; set only for a separate backend origin |

### 8.5 Database Setup For Vercel

Use a managed Postgres database for production. Neon and Supabase work well with serverless deployments; any Postgres provider is acceptable if it exposes a standard connection string.

Steps:

1. Create a Postgres project/database with your provider.
2. Copy the provider's application connection string.
3. Prefer a pooled connection string when the provider offers one for serverless workloads.
4. Keep any required SSL parameters from the provider, for example `sslmode=require`.
5. Add the value as `DATABASE_URL` in Vercel.
6. Apply the schema from your machine:

```bash
psql "$DATABASE_URL" -f backend/app/db/schema.sql
```

The deployed API uses Postgres only when `DEMO_MODE=false` and `DATABASE_URL` is present. Without `DATABASE_URL`, task data is stored in memory and will not survive function restarts.

### 8.6 Redis And Worker Setup

`REDIS_URL` is recommended for production orchestration and required once call execution moves to a durable queue or separate voice worker. The current Vercel MVP can run the basic synchronous flow without Redis, but real outbound call workflows should not rely on a single serverless request lifetime.

Steps:

1. Create a Redis database with Upstash, Railway, Render, Elasticache, or another provider.
2. Copy the Redis protocol URL, usually `redis://...` or `rediss://...`.
3. Add it as `REDIS_URL` in Vercel.
4. Use the same value in the worker runtime if you deploy LiveKit Agents, Pipecat, Celery, BullMQ, or Temporal workers separately.

### 8.7 OpenAI Setup

Steps:

1. Create or select an OpenAI Platform project.
2. Add billing for the project.
3. Create a project API key.
4. Add the key as `OPENAI_API_KEY` in Vercel.
5. Set `OPENAI_MODEL` to the model used for request parsing, extraction, and summaries.

The `/health` endpoint reports `openai_enabled: true` only when `OPENAI_API_KEY` is set and `DEMO_MODE=false`.

### 8.8 Google Places Setup

Steps:

1. Create or select a Google Cloud project.
2. Enable billing.
3. Enable Places API for the project.
4. Create an API key.
5. Restrict the key to the Places API.
6. Add the key as `GOOGLE_PLACES_API_KEY` in Vercel.

The backend calls Google Places server-side. If you add key restrictions, use API restrictions at minimum. IP restrictions can be difficult on normal Vercel serverless deployments unless your plan provides stable outbound networking.

The `/health` endpoint reports `google_places_enabled: true` only when `GOOGLE_PLACES_API_KEY` is set and `DEMO_MODE=false`.

### 8.9 Twilio Setup

Steps:

1. Create or select a Twilio account.
2. Buy a voice-capable phone number, or verify a caller ID for trial testing.
3. Copy `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` from the Twilio Console.
4. Add the caller number as `TWILIO_FROM_NUMBER` in E.164 format, for example `+14165550100`.
5. Add all three Twilio values in Vercel.
6. Confirm `PUBLIC_BASE_URL` is a public HTTPS Vercel URL.

This MVP passes per-call webhook URLs when it creates outbound Twilio calls:

```text
{PUBLIC_BASE_URL}/api/webhooks/twilio/voice/{call_id}
{PUBLIC_BASE_URL}/api/webhooks/twilio/status/{call_id}
{PUBLIC_BASE_URL}/api/webhooks/twilio/transcript/{call_id}
```

You do not need a TwiML App for the included outbound-call flow. Twilio must be able to POST to the public Vercel URLs. Trial Twilio accounts can usually call only verified recipient numbers.

Keep `ALLOW_CALL_RECORDING=false` until call recording laws, consent language, disclosure logs, transcript retention, and deletion policies are configured for every jurisdiction where calls may occur.

The `/health` endpoint reports `twilio_enabled: true` only when all Twilio variables are set and `DEMO_MODE=false`.

### 8.10 Deploy And Verify

Deploy manually:

```bash
npx vercel deploy --prod
```

With Git integration enabled, merges to `main` also create a production deployment automatically.

After deployment, inspect the latest production build:

```bash
npx vercel ls ai-calling-agent
npx vercel inspect https://your-latest-deployment-url.vercel.app
```

Verify the stable URL:

```bash
curl -sS https://your-vercel-domain.vercel.app/
curl -sS https://your-vercel-domain.vercel.app/health
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

Expected real-provider response after all required envs are set:

```json
{
  "status": "ok",
  "demo_mode": false,
  "google_places_enabled": true,
  "twilio_enabled": true,
  "openai_enabled": true
}
```

If you change any Vercel env variable, redeploy before testing again:

```bash
npx vercel redeploy
```

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
