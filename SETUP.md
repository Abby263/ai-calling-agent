# Setup Guide

This guide is focused on one practical goal: make the Vercel deployment work with real providers so you can test it and share the public link.

Live app:

- Landing page: `https://ai-calling-agent-snowy.vercel.app`
- App console: `https://ai-calling-agent-snowy.vercel.app/app`
- Health check: `https://ai-calling-agent-snowy.vercel.app/health`

In demo mode the app shows the full UI flow, but it does not call OpenAI, Google Places, or Twilio. For a real Vercel test, set the production env vars below and redeploy. When `DEMO_MODE=false` and `DATABASE_URL` is configured, the API automatically applies the idempotent Postgres schema on startup.

## 1. What You Need For A Real Vercel Test

Required:

| Service | Why it is needed | Value you will add to Vercel |
| --- | --- | --- |
| Vercel | Hosts the web app and FastAPI API route | Project linked to this GitHub repo |
| Neon Postgres | Stores users, tasks, businesses, calls, transcripts, and summaries | `DATABASE_URL` |
| OpenAI | Parses requests, extracts call answers, and writes summaries | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Google Places | Finds nearby businesses for discovery requests | `GOOGLE_PLACES_API_KEY` |
| Twilio Voice | Places outbound phone calls | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Clerk | Sign-in/sign-up and auth gate for paid task execution | `AUTH_REQUIRED`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `VITE_CLERK_PUBLISHABLE_KEY` |

Optional for this MVP:

| Service | When to add it | Value |
| --- | --- | --- |
| Redis | Add when you move calls to a durable queue or external worker | `REDIS_URL` |
| LiveKit or Pipecat worker | Add when you replace scripted Twilio calls with realtime voice agents | Worker-specific env vars |

## 2. Vercel Environment Variables

Add these in:

```text
Vercel project -> Settings -> Environment Variables
```

Use these values for production:

```bash
APP_ENV=production
PUBLIC_BASE_URL=https://ai-calling-agent-snowy.vercel.app
BACKEND_CORS_ORIGINS=https://ai-calling-agent-snowy.vercel.app
MAX_CALLS_PER_TASK=5
DEMO_MODE=false
ALLOW_CALL_RECORDING=false
AUTH_REQUIRED=true
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_JWKS_URL=https://your-clerk-frontend-api.clerk.accounts.dev/.well-known/jwks.json
CLERK_AUTHORIZED_PARTIES=https://ai-calling-agent-snowy.vercel.app

DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
GOOGLE_PLACES_API_KEY=...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+14165550100
```

Do not set `VITE_API_BASE_URL` on Vercel for the current deployment. The frontend and backend are served from the same Vercel origin, so the app uses `/api` automatically.

If `APP_ENV=production` and `DEMO_MODE=false`, the backend defaults to requiring auth even if `AUTH_REQUIRED` is omitted. Set the auth env vars before sharing the link so task APIs do not fail closed.

CLI option:

```bash
npx vercel env add APP_ENV production
npx vercel env add PUBLIC_BASE_URL production
npx vercel env add BACKEND_CORS_ORIGINS production
npx vercel env add MAX_CALLS_PER_TASK production
npx vercel env add DEMO_MODE production
npx vercel env add ALLOW_CALL_RECORDING production
npx vercel env add AUTH_REQUIRED production
npx vercel env add CLERK_SECRET_KEY production
npx vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
npx vercel env add CLERK_JWKS_URL production
npx vercel env add CLERK_AUTHORIZED_PARTIES production
npx vercel env add DATABASE_URL production
npx vercel env add OPENAI_API_KEY production
npx vercel env add OPENAI_MODEL production
npx vercel env add GOOGLE_PLACES_API_KEY production
npx vercel env add TWILIO_ACCOUNT_SID production
npx vercel env add TWILIO_AUTH_TOKEN production
npx vercel env add TWILIO_FROM_NUMBER production
```

After changing any Vercel env var, redeploy:

```bash
npx vercel redeploy
```

## 3. How To Get Each Value

### Neon Postgres: `DATABASE_URL`

Use Neon for the production database.

1. Create or open a Neon project.
2. Click **Connect** in the Neon dashboard.
3. Select the production branch, database, and role.
4. Turn on the pooled connection option for Vercel/serverless deployments if Neon offers it. The hostname usually contains `-pooler`.
5. Copy the connection string and keep `sslmode=require` if it is included.
6. Add the full string to Vercel as `DATABASE_URL`.

The API applies the idempotent schema automatically on startup. To verify or apply it manually from your machine, run:

```bash
psql "$DATABASE_URL" -f backend/app/db/schema.sql
```

You can also paste the contents of `backend/app/db/schema.sql` into the Neon SQL Editor and run it there.

The app only uses Neon when `DEMO_MODE=false` and `DATABASE_URL` exists. Without Neon, deployed task history is not reliable. If you see `relation "users" does not exist` in Vercel logs, the database schema has not been applied to the Neon database connected by `DATABASE_URL`; redeploy the latest version or run the schema command above.

### Clerk: `CLERK_*` and Publishable Key

This MVP uses Clerk for sign-in/sign-up. The landing page and console UI stay public, but creating tasks, approving calls, reading stored task history, reading transcripts, canceling tasks, and deleting tasks require login when `AUTH_REQUIRED=true`.

1. Create a Clerk application.
2. In Clerk Dashboard, open **Configure -> API keys**.
3. Copy the publishable key and add it to Vercel as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. The app also supports `VITE_CLERK_PUBLISHABLE_KEY`.
4. Copy the secret key and add it to Vercel as `CLERK_SECRET_KEY`.
5. Copy the **Frontend API URL** from the same API keys page. It looks similar to:

```text
https://dear-pangolin-76.clerk.accounts.dev
```

6. Build the JWKS URL by adding `/.well-known/jwks.json` to that Frontend API URL:

```text
https://dear-pangolin-76.clerk.accounts.dev/.well-known/jwks.json
```

7. Add that full URL to Vercel as `CLERK_JWKS_URL`.
8. In Clerk Dashboard, confirm these URLs are allowed for the production instance:

```text
https://ai-calling-agent-snowy.vercel.app
https://ai-calling-agent-snowy.vercel.app/app
```

9. Add `CLERK_AUTHORIZED_PARTIES=https://ai-calling-agent-snowy.vercel.app` to Vercel. This makes the backend reject Clerk tokens minted for another origin.
10. Set `AUTH_REQUIRED=true`.

Important: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `CLERK_JWKS_URL` must all come from the same Clerk application and same environment. Do not mix a `pk_test_...` publishable key with an unrelated `sk_live_...` secret key. If the keys are from different Clerk instances, the browser can show you as signed in but the API will reject task creation with `Your Clerk session token could not be verified by the API.`

For the current production deployment, the frontend key belongs to this Clerk Frontend API URL:

```bash
CLERK_JWKS_URL=https://dear-pangolin-76.clerk.accounts.dev/.well-known/jwks.json
```

Add it with the Vercel CLI:

```bash
npx vercel env add CLERK_JWKS_URL production --value https://dear-pangolin-76.clerk.accounts.dev/.well-known/jwks.json --yes
npx vercel deploy --prod --yes
```

Optional advanced values:

- `CLERK_JWT_ISSUER`: verify a specific Clerk issuer URL.

### OpenAI: `OPENAI_API_KEY`

1. Go to the OpenAI Platform dashboard.
2. Create or select a project.
3. Enable billing.
4. Create a project API key.
5. Add it to Vercel as `OPENAI_API_KEY`.
6. Keep `OPENAI_MODEL=gpt-4.1-mini` unless you intentionally change the model.

### Google Places: `GOOGLE_PLACES_API_KEY`

1. Open Google Cloud Console.
2. Create or select a project.
3. Enable billing.
4. Enable Places API.
5. Create an API key.
6. Restrict the key to Places API.
7. Add it to Vercel as `GOOGLE_PLACES_API_KEY`.

Avoid IP restrictions unless your Vercel plan gives you stable outbound networking. API restriction to Places API is the safer default for this deployment.

### Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

1. Create or open a Twilio account.
2. Buy a voice-capable Twilio number.
3. Copy the Account SID and Auth Token from the Twilio Console.
4. Add the caller number in E.164 format, for example `+14165550100`.
5. Add all three values to Vercel.

This app sends Twilio the webhook URLs when it creates each outbound call:

```text
{PUBLIC_BASE_URL}/api/webhooks/twilio/voice/{call_id}
{PUBLIC_BASE_URL}/api/webhooks/twilio/status/{call_id}
{PUBLIC_BASE_URL}/api/webhooks/twilio/transcript/{call_id}
```

You do not need to create a TwiML App for the current MVP. Twilio trial accounts can usually call only verified recipient numbers, so use a verified personal test number first.

Keep `ALLOW_CALL_RECORDING=false` for initial testing. Turn it on only after call recording consent, retention, and deletion requirements are handled.

## 4. Real Test Checklist

Use this checklist before sharing the app with users.

1. Add all required Vercel env vars from section 2.
2. Confirm the latest deployment started cleanly, or apply the database schema manually if Vercel logs show missing tables.
3. Confirm Clerk has the production origin configured.
4. Redeploy production.
5. Open `https://ai-calling-agent-snowy.vercel.app/health`.
6. Confirm this response shape:

```json
{
  "status": "ok",
  "demo_mode": false,
  "google_places_enabled": true,
  "twilio_enabled": true,
  "openai_enabled": true,
  "auth_required": true,
  "auth_configured": true
}
```

7. Open `https://ai-calling-agent-snowy.vercel.app/app`.
8. Click **Sign in** and complete Clerk login or sign-up.
9. Run a low-risk test request with one verified number:

```text
Call +1 YOUR VERIFIED TEST NUMBER. Say this is an AI assistant calling on behalf of a user and ask whether they are available for a test dinner invitation. Track the answer.
```

10. Approve only one call.
11. Confirm the call status, transcript, extracted answer, and final summary.
12. Only then test nearby business discovery.

For the first public user test, keep:

```bash
MAX_CALLS_PER_TASK=1
ALLOW_CALL_RECORDING=false
```

Raise `MAX_CALLS_PER_TASK` after you have confirmed Twilio behavior, summaries, deletion, and abuse controls.

## 5. Deployment And PR Flow

The repo is connected to Vercel through GitHub.

Normal flow:

```bash
git checkout -b feature/my-change
git add README.md SETUP.md frontend/src/App.tsx
git commit -m "Describe change"
git push origin feature/my-change
```

Open a PR. When the PR is merged into `main`, Vercel creates a production deployment automatically.

Check deployments:

```bash
npx vercel ls ai-calling-agent
npx vercel inspect https://deployment-url.vercel.app
```

## 6. Local Development

Install dependencies:

```bash
npm ci --prefix frontend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cd ..
```

Start local infrastructure:

```bash
docker compose up -d
```

Copy env defaults:

```bash
cp .env.example .env
```

Run backend:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Run frontend in another terminal:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
http://localhost:5173/app
```

Local demo health check:

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

## 7. Common Problems

### `/health` still says `demo_mode: true`

`DEMO_MODE=false` is not set in Vercel production, or production was not redeployed after the env change.

Fix:

```bash
npx vercel env ls
npx vercel redeploy
```

### `/health` says `auth_configured: false`

Check the Clerk auth env vars in Vercel production:

- `AUTH_REQUIRED=true`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_AUTHORIZED_PARTIES=https://ai-calling-agent-snowy.vercel.app`

Then redeploy production.

### `/health` says a provider is disabled

Check the matching env var:

- `openai_enabled`: needs `OPENAI_API_KEY` and `DEMO_MODE=false`
- `google_places_enabled`: needs `GOOGLE_PLACES_API_KEY` and `DEMO_MODE=false`
- `twilio_enabled`: needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, and `DEMO_MODE=false`

### Twilio call does not start

Check:

- `TWILIO_FROM_NUMBER` is voice-capable.
- Phone numbers use E.164 format.
- Trial accounts are calling verified recipient numbers.
- `PUBLIC_BASE_URL` is the public HTTPS Vercel URL.
- Vercel production was redeployed after setting Twilio env vars.

### Nearby search returns empty results

Check:

- Google Places API is enabled.
- Billing is enabled.
- API key is restricted to Places API, not to an incompatible IP or referrer rule.
- The request has a location or manual location fallback.

### Database errors after disabling demo mode

Check:

- `DATABASE_URL` is set in Vercel production.
- The schema was applied with `backend/app/db/schema.sql`.
- The connection string includes required SSL parameters.
- Your database allows Vercel serverless connections.
