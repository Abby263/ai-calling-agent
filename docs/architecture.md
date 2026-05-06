# Architecture

## Modules

```mermaid
flowchart LR
  UI["Web / Mobile UI"] --> Auth["Sign in with Vercel"]
  UI --> API["FastAPI API"]
  Auth --> API
  API --> Parser["RequestParserAgent"]
  Parser --> Kind{"Task kind"}
  Kind -->|"direct_calls"| Direct["User-provided numbers"]
  Kind -->|"nearby_search"| Search["SearchAgent"]
  Direct --> Preview["Human Approval Gate"]
  Search --> Places["Google Places Adapter"]
  Search --> Rank["RankingAgent"]
  Rank --> Preview["Human Approval Gate"]
  Preview --> Planner["CallPlannerAgent"]
  Planner --> Voice["VoiceCallAgent"]
  Voice --> Twilio["Twilio Programmable Voice"]
  Twilio --> Webhooks["Twilio Webhooks"]
  Webhooks --> Extract["TranscriptExtractionAgent"]
  Extract --> Summary["SummaryAgent"]
  Summary --> UI
  API --> Store["Task Store / Neon Postgres"]
```

## Agent Responsibilities

`RequestParserAgent`

Extracts task kind, phone numbers when present, business type for search tasks, search target, radius, user constraints, call objective, required questions, summary criteria, and whether calls are required.

`SearchAgent`

Creates direct-call targets from user-provided phone numbers or searches Google Places for nearby businesses and normalizes provider data into `BusinessCandidate`.

`RankingAgent`

Scores candidates using distance, rating, open status, phone availability, business status, reviews, and user filters.

`CallPlannerAgent`

Applies the approval list, call cap, and compliance eligibility before calls are placed.

`VoiceCallAgent`

Creates Twilio outbound calls or demo calls. Twilio calls use public webhook URLs and a transparent disclosure script.

`TranscriptExtractionAgent`

Converts transcript text into structured fields. Direct-call tasks track outcome, answer summary, follow-up need, confidence, and notes. Nearby restaurant tasks also track happy hour, vegan options, and reservations.

`SummaryAgent`

Generates either a direct-call outcome tracker or a business comparison. Direct trackers include accepted, declined, maybe/follow-up, no-answer, uncertainty, and table-ready rows.

## Data Model

The included PostgreSQL schema implements:

- `users`
- `search_tasks`
- `businesses`
- `calls`
- `summaries`
- `consent_disclosure_logs`

The API uses an in-memory store in demo mode and a Neon/PostgreSQL store when `DEMO_MODE=false` and `DATABASE_URL` is present. When `AUTH_REQUIRED=true`, task rows are scoped to the authenticated local user record created from the Vercel OAuth subject.

## Mobile Architecture

The `mobile/` app is a React Native/Expo shell mirroring web screens:

- Home request input
- Location and filter screen
- Contact or business preview
- Call progress
- Final results
- Saved searches

The shared package keeps request/result contracts portable across web, mobile, and backend client SDKs.
