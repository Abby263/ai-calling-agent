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
| LiveKit Cloud | Add when you replace scripted Twilio calls with realtime voice agents | `VOICE_RUNTIME`, `LIVEKIT_*` |

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
FREE_REQUEST_LIMIT=1
DEMO_MODE=false
ALLOW_CALL_RECORDING=false
AUTH_REQUIRED=true
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_JWKS_URL=https://your-clerk-frontend-api.clerk.accounts.dev/.well-known/jwks.json
CLERK_AUTHORIZED_PARTIES=https://ai-calling-agent-snowy.vercel.app
ADMIN_EMAILS=you@example.com
ADMIN_CLERK_SUBJECTS=
PAID_USER_EMAILS=

DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
GOOGLE_PLACES_API_KEY=...
VOICE_RUNTIME=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+14165550100
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_SIP_OUTBOUND_TRUNK_ID=
LIVEKIT_AGENT_NAME=voice-concierge-caller
LIVEKIT_WEBHOOK_SECRET=
LIVEKIT_WAIT_UNTIL_ANSWERED=false
```

Do not set `VITE_API_BASE_URL` on Vercel for the current deployment. The frontend and backend are served from the same Vercel origin, so the app uses `/api` automatically.

If `APP_ENV=production` and `DEMO_MODE=false`, the backend defaults to requiring auth even if `AUTH_REQUIRED` is omitted. Set the auth env vars before sharing the link so task APIs do not fail closed.

CLI option:

```bash
npx vercel env add APP_ENV production
npx vercel env add PUBLIC_BASE_URL production
npx vercel env add BACKEND_CORS_ORIGINS production
npx vercel env add MAX_CALLS_PER_TASK production
npx vercel env add FREE_REQUEST_LIMIT production
npx vercel env add DEMO_MODE production
npx vercel env add ALLOW_CALL_RECORDING production
npx vercel env add AUTH_REQUIRED production
npx vercel env add CLERK_SECRET_KEY production
npx vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
npx vercel env add CLERK_JWKS_URL production
npx vercel env add CLERK_AUTHORIZED_PARTIES production
npx vercel env add ADMIN_EMAILS production
npx vercel env add ADMIN_CLERK_SUBJECTS production
npx vercel env add PAID_USER_EMAILS production
npx vercel env add DATABASE_URL production
npx vercel env add OPENAI_API_KEY production
npx vercel env add OPENAI_MODEL production
npx vercel env add GOOGLE_PLACES_API_KEY production
npx vercel env add VOICE_RUNTIME production
npx vercel env add TWILIO_ACCOUNT_SID production
npx vercel env add TWILIO_AUTH_TOKEN production
npx vercel env add TWILIO_FROM_NUMBER production
npx vercel env add LIVEKIT_URL production
npx vercel env add LIVEKIT_API_KEY production
npx vercel env add LIVEKIT_API_SECRET production
npx vercel env add LIVEKIT_SIP_OUTBOUND_TRUNK_ID production
npx vercel env add LIVEKIT_AGENT_NAME production
npx vercel env add LIVEKIT_WEBHOOK_SECRET production
npx vercel env add LIVEKIT_WAIT_UNTIL_ANSWERED production
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

### Request limits, admin users, and paid allowlist

The app limits normal signed-in users to one request by default because real tasks can spend money
on OpenAI, Google Places, Twilio, and LiveKit.

Set:

```bash
FREE_REQUEST_LIMIT=1
```

Admin accounts bypass this limit:

```bash
ADMIN_EMAILS=founder@example.com,ops@example.com
```

If you prefer to identify an admin by the stable Clerk subject instead of email, open the Clerk user
profile, copy the `user_...` subject, and add:

```bash
ADMIN_CLERK_SUBJECTS=user_abc123,user_def456
```

Until Stripe billing is added, paid users can be allowlisted manually:

```bash
PAID_USER_EMAILS=customer@example.com
```

The pricing page explains the public packaging. The backend enforcement is intentionally simple for
the MVP: free users get `FREE_REQUEST_LIMIT`; admin and paid allowlists are unlimited.

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

### Twilio Programmable Voice fallback: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

Twilio has two roles in this app:

1. **Current fallback runtime**: the backend can place scripted calls directly through Twilio Programmable Voice.
2. **LiveKit PSTN carrier path**: when `VOICE_RUNTIME=livekit`, LiveKit can still use your Twilio phone number through Twilio Elastic SIP Trunking.

Keep the normal Twilio env vars even after you add LiveKit. They let the app fall back to the scripted Twilio flow if LiveKit is not enabled.

#### A. Get the normal Twilio values

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

Keep `ALLOW_CALL_RECORDING=false` for initial testing. In that mode the Twilio voice webhook asks the approved questions one at a time with speech gathering, captures each spoken answer, and then summarizes the result without enabling call recording. Turn recording on only after call recording consent, retention, and deletion requirements are handled.

#### B. Create a Twilio Elastic SIP Trunk for LiveKit outbound calls

Do this section only when you are ready to use LiveKit for realtime voice calls. For outbound calling, LiveKit sends a SIP call to Twilio; Twilio then sends the call to the public phone network.

In Twilio Console:

1. Open **Elastic SIP Trunking -> Manage -> Trunks**.
2. Click **Create new trunk**.
3. Use a clear name, for example:

```text
voice-concierge-livekit
```

4. Open the trunk and go to **Termination**.
5. Create a **Termination SIP URI**. It must end with `.pstn.twilio.com`, for example:

```text
voice-concierge-livekit.pstn.twilio.com
```

Copy this value. You will use it as the LiveKit outbound trunk `address`.

6. In Twilio, create a credential list:

```text
Elastic SIP Trunking -> Manage -> Credential Lists
```

Use a generated username and password. Example:

```text
username: livekit_voice_concierge
password: use-a-long-generated-password
```

7. Attach the credential list to the trunk:

```text
Elastic SIP Trunking -> Manage -> Trunks -> your trunk -> Termination -> Authentication -> Credential Lists
```

8. Save the trunk.
9. Open the trunk's **Numbers** tab.
10. Associate your Twilio caller number, for example:

```text
+16473628073
```

For this app's outbound LiveKit calls, you do not need to configure Twilio **Origination** unless you also want incoming PSTN calls to route into LiveKit. Origination is for inbound calls to your Twilio number.

Important Twilio details:

- Phone numbers must use E.164 format, for example `+16473628073`.
- Trial Twilio accounts can usually call only verified destination numbers.
- The SIP URI value used by LiveKit should be the Twilio Termination SIP URI host, for example `voice-concierge-livekit.pstn.twilio.com`.
- Do not include `sip:` or `;transport=tcp` in the LiveKit outbound trunk `address`.
- Official references: [Twilio Elastic SIP Trunking](https://www.twilio.com/docs/sip-trunking) and [LiveKit Twilio trunk setup](https://docs.livekit.io/telephony/start/providers/twilio/).

### LiveKit: realtime voice agent runtime

Use LiveKit when you want natural realtime conversations instead of Twilio's scripted
`<Gather>` flow.

Vercel still hosts the web app and API. LiveKit runs the realtime media session and dispatches the
voice worker. Twilio can still provide the purchased caller number and PSTN carrier path through
Elastic SIP Trunking.

Production call flow:

```text
Vercel API -> LiveKit room -> LiveKit agent worker -> OpenAI Realtime
           -> LiveKit SIP participant -> Twilio SIP trunk -> recipient phone
```

#### A. Create or open a LiveKit Cloud project

1. Go to `https://cloud.livekit.io`.
2. Create a project, or open the project you want to use.
3. Open the project settings page.

#### B. Get `LIVEKIT_URL`

In the LiveKit Cloud project settings, find the **Project URL** or **WebSocket URL**. It starts with `wss://` and usually looks like:

```text
wss://your-project-name.livekit.cloud
```

Add that exact value to Vercel:

```bash
LIVEKIT_URL=wss://your-project-name.livekit.cloud
```

Common mistakes:

- Do not use the LiveKit dashboard URL.
- Do not use `https://...` for this app.
- Do not remove the `wss://` prefix.
- Use the URL from the same LiveKit project as your API key and secret.

CLI option after installing the LiveKit CLI:

```bash
brew install livekit-cli
lk cloud auth
lk project list
```

The linked project details include the LiveKit project URL. Use the `wss://...livekit.cloud` value as `LIVEKIT_URL`.

#### C. Get `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`

In LiveKit Cloud:

1. Open your project.
2. Open **Settings -> API keys** or the project **Keys** page.
3. Create a new API key for production.
4. Copy the key and secret.
5. Add them to Vercel:

```bash
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=...
```

Treat the LiveKit API secret like a password. Do not commit it to Git.

#### D. Create the LiveKit outbound SIP trunk

This step connects LiveKit to the Twilio Elastic SIP Trunk you created above.

In LiveKit Cloud:

1. Open your project.
2. Go to **Telephony -> SIP trunks**.
3. Click **Create new trunk**.
4. Select **Outbound**.
5. Open the JSON editor.
6. Paste this JSON and replace the values:

```json
{
  "name": "voice-concierge-twilio-outbound",
  "address": "voice-concierge-livekit.pstn.twilio.com",
  "numbers": ["+16473628073"],
  "authUsername": "livekit_voice_concierge",
  "authPassword": "same-password-from-twilio-credential-list"
}
```

Value mapping:

| LiveKit field | Value source |
| --- | --- |
| `address` | Twilio trunk **Termination SIP URI**, without `sip:` |
| `numbers` | Your Twilio caller number in E.164 format |
| `authUsername` | Username from the Twilio SIP credential list |
| `authPassword` | Password from the Twilio SIP credential list |

7. Click **Create**.
8. Copy the returned trunk ID. It usually looks like `ST_...`.
9. Add it to Vercel:

```bash
LIVEKIT_SIP_OUTBOUND_TRUNK_ID=ST_...
```

LiveKit CLI option:

Create `outbound-trunk.json`:

```json
{
  "trunk": {
    "name": "voice-concierge-twilio-outbound",
    "address": "voice-concierge-livekit.pstn.twilio.com",
    "numbers": ["+16473628073"],
    "authUsername": "livekit_voice_concierge",
    "authPassword": "same-password-from-twilio-credential-list"
  }
}
```

Then run:

```bash
lk sip outbound create outbound-trunk.json
```

The command returns:

```text
SIPTrunkID: ST_...
```

Use that ID as `LIVEKIT_SIP_OUTBOUND_TRUNK_ID`.

Official references: [LiveKit outbound SIP trunk](https://docs.livekit.io/telephony/making-calls/outbound-trunk/) and [LiveKit CLI setup](https://docs.livekit.io/reference/developer-tools/livekit-cli/).

#### E. Set a shared webhook secret

The LiveKit worker posts call completion, transcript, and extraction data back to the Vercel API. Use a shared secret so random callers cannot spoof worker callbacks.

Generate one locally:

```bash
LIVEKIT_WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "$LIVEKIT_WEBHOOK_SECRET"
```

Add the same value in two places:

1. Vercel env var: `LIVEKIT_WEBHOOK_SECRET`
2. LiveKit worker secret/env var: `LIVEKIT_WEBHOOK_SECRET`

#### F. Add the LiveKit env vars to Vercel

When the LiveKit project, Twilio SIP trunk, and LiveKit outbound SIP trunk are ready, set:

```bash
VOICE_RUNTIME=livekit
LIVEKIT_URL=wss://your-project-name.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_SIP_OUTBOUND_TRUNK_ID=ST_...
LIVEKIT_AGENT_NAME=voice-concierge-caller
LIVEKIT_WEBHOOK_SECRET=...
LIVEKIT_WAIT_UNTIL_ANSWERED=false
TWILIO_FROM_NUMBER=+16473628073
```

Then redeploy the Vercel app:

```bash
npx vercel redeploy
```

Check:

```bash
curl -sS https://ai-calling-agent-snowy.vercel.app/health
```

Expected LiveKit-ready values:

```json
{
  "voice_runtime": "livekit",
  "livekit_enabled": true,
  "livekit_calling_enabled": true
}
```

If `livekit_enabled` is `false`, check `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `DEMO_MODE=false`.

If `livekit_calling_enabled` is `false`, check `VOICE_RUNTIME=livekit` and `LIVEKIT_SIP_OUTBOUND_TRUNK_ID`.

#### G. Deploy the LiveKit worker

The Vercel API creates tasks and dispatches LiveKit calls, but the realtime voice conversation must run in a long-running worker. Do not run the LiveKit worker as a normal Vercel serverless function.

Worker location:

```text
workers/livekit_voice_agent
```

Set these worker env vars or secrets:

```bash
LIVEKIT_URL=wss://your-project-name.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
AGENT_NAME=voice-concierge-caller
BACKEND_BASE_URL=https://ai-calling-agent-snowy.vercel.app
LIVEKIT_WEBHOOK_SECRET=...
```

`AGENT_NAME` on the worker must match `LIVEKIT_AGENT_NAME` on Vercel. If they do not match, the backend can create a LiveKit room but the correct worker may not pick up the job.

Worker local test:

```bash
cd workers/livekit_voice_agent
uv sync
uv run agent.py dev
```

Worker production command:

```bash
uv run agent.py start
```

If `VOICE_RUNTIME=livekit` but `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` is missing, the backend will not use
LiveKit and `/health` will show `livekit_calling_enabled: false`. Keep `VOICE_RUNTIME=twilio` until
the worker and trunk are ready.

#### H. Minimal end-to-end LiveKit test

Start with your own verified phone number and one call.

1. Set `MAX_CALLS_PER_TASK=1`.
2. Set `ALLOW_CALL_RECORDING=false`.
3. Set `VOICE_RUNTIME=livekit`.
4. Confirm `/health` shows `livekit_calling_enabled: true`.
5. Open the app and submit:

```text
Call +1 YOUR VERIFIED TEST NUMBER. Say this is an AI assistant calling on behalf of a user and ask whether they are available for a test dinner invitation. Track the answer.
```

6. Approve the one call.
7. Confirm the phone rings from your Twilio number.
8. Confirm the UI moves from calling to completed and shows the transcript/extracted answer.

If the phone does not ring:

- Confirm the LiveKit worker is running.
- Confirm the Twilio trunk Termination SIP URI matches the LiveKit outbound trunk `address`.
- Confirm the Twilio credential list username/password match LiveKit `authUsername` and `authPassword`.
- Confirm the Twilio caller number is associated with the trunk.
- Confirm the destination number is verified if the Twilio account is still in trial mode.

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
  "voice_runtime": "twilio",
  "livekit_enabled": false,
  "livekit_calling_enabled": false,
  "openai_enabled": true,
  "auth_required": true,
  "auth_configured": true,
  "free_request_limit": 1
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
- `livekit_enabled`: needs `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `DEMO_MODE=false`
- `livekit_calling_enabled`: also needs `VOICE_RUNTIME=livekit` and `LIVEKIT_SIP_OUTBOUND_TRUNK_ID`

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
