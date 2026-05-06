# Voice Runtime Flow

## Twilio Outbound Call

`VoiceCallAgent` creates a Twilio Programmable Voice call when `VOICE_RUNTIME=twilio`,
`DEMO_MODE=false`, and these variables are present:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `PUBLIC_BASE_URL`

The call uses:

- `url`: `{PUBLIC_BASE_URL}/api/webhooks/twilio/voice/{call_id}`
- `status_callback`: `{PUBLIC_BASE_URL}/api/webhooks/twilio/status/{call_id}`
- `record`: `ALLOW_CALL_RECORDING`

## TwiML

The voice webhook returns:

1. AI disclosure.
2. Approved questions.
3. Optional recording/transcription callback.
4. Polite close.

This path is the simple fallback. It asks approved questions one at a time with Twilio speech
gathering and can produce results without a long-running voice worker.

## LiveKit Realtime Call

`VoiceCallAgent` creates a LiveKit room and SIP participant when `VOICE_RUNTIME=livekit`,
`DEMO_MODE=false`, and these variables are present:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_SIP_OUTBOUND_TRUNK_ID`
- `LIVEKIT_AGENT_NAME`
- `TWILIO_FROM_NUMBER`

The backend:

1. Dispatches the named LiveKit agent to a room.
2. Passes task metadata, approved questions, and callback URL to the agent.
3. Creates a LiveKit SIP participant using the configured outbound trunk.
4. Marks the call `calling`.

The LiveKit worker:

1. Joins the room.
2. Uses OpenAI Realtime to conduct the conversation.
3. Captures conversation turns.
4. Posts transcript and final status to `{PUBLIC_BASE_URL}/api/webhooks/livekit/calls/{call_id}`.

Use `LIVEKIT_WEBHOOK_SECRET` on both Vercel and the worker so callback requests include
`x-livekit-webhook-secret`.

## Status Handling

Twilio statuses map to app statuses:

| Twilio | App |
| --- | --- |
| `queued`, `initiated`, `ringing`, `in-progress` | `calling` |
| `busy`, `no-answer`, `canceled` | `no_answer` |
| `failed` | `failed` |
| `completed` | `completed` |
| `AnsweredBy=machine` | `voicemail` |

## Transcript Handling

When transcription arrives:

1. Store transcript and recording URL.
2. Mark call completed.
3. Run `TranscriptExtractionAgent`.
4. If all calls are complete, run `SummaryAgent`.

## Legal and Safety Notes

Recording is disabled by default. Only enable `ALLOW_CALL_RECORDING=true` after validating consent, call recording, and data retention obligations for the jurisdictions where calls may occur.
