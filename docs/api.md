# Backend API Design

Base URL: `http://localhost:8000`

## Health

`GET /health`

Returns provider enablement flags, demo-mode status, and auth status.

## Auth

`GET /api/auth/session`

Returns whether auth is required/configured and the current signed-in user if a valid session exists.

`GET /api/auth/login`

Starts Sign in with Vercel. Optional query: `next=/app`.

`GET /api/auth/callback`

Completes the Vercel OAuth callback, creates or updates the local user record, and sets a signed session cookie.

`POST /api/auth/logout`

Clears the signed session cookie.

When `AUTH_REQUIRED=true`, task APIs require a signed-in session. The landing page and console route still render publicly.

## Tasks

`POST /api/tasks/preview`

Creates a task preview. It parses the request, searches/ranks businesses, and returns editable questions. No calls are placed.

```json
{
  "original_request": "Find happy hours near me and ask if they have vegan food.",
  "location": { "lat": 43.6532, "lng": -79.3832, "label": "Toronto, ON" },
  "filters": {
    "radius_meters": 3000,
    "cuisine": null,
    "price_level": null,
    "min_rating": 4,
    "open_now": true,
    "max_calls": 5,
    "preferred_call_time": "Now",
    "dietary_preference": "vegan"
  }
}
```

`GET /api/tasks`

Returns saved task summaries for the dashboard history.

`GET /api/tasks/{task_id}`

Returns task detail, businesses, calls, extraction data, and summary.

`POST /api/tasks/{task_id}/approve-calls`

Places or simulates calls after human approval.

```json
{
  "business_ids": ["demo_abc"],
  "questions": [
    { "id": "q1", "text": "Do you have happy hour today?", "required": true }
  ],
  "max_calls": 5,
  "preferred_call_time": "Now"
}
```

`POST /api/tasks/{task_id}/cancel`

Cancels a running or pending task.

`POST /api/tasks/{task_id}/summarize`

Regenerates the final summary from current call data.

`DELETE /api/tasks/{task_id}`

Deletes task history from the active store.

## Twilio Webhooks

`POST /api/webhooks/twilio/voice/{call_id}`

Returns TwiML with the transparent AI disclosure and approved questions.

`POST /api/webhooks/twilio/status/{call_id}`

Consumes Twilio call status callbacks and updates call state.

`POST /api/webhooks/twilio/transcript/{call_id}`

Consumes transcription data, runs extraction, and triggers summary generation when all calls are complete.

## Error Handling

- `400`: invalid request, blocked category, or no eligible businesses to call.
- `401`: login is required for task APIs when auth is enabled.
- `404`: task or call not found.
- `409`: task is already completed or cancelled.
- `503`: auth is required but Vercel OAuth env vars are not configured.
- Provider errors are isolated behind agents; demo fallback is used for planning/search/extraction/summary where configured.
