# Twilio Webhook Flow

## Outbound Call

`VoiceCallAgent` creates an outbound call when `DEMO_MODE=false` and these variables are present:

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

This MVP uses a fixed scripted TwiML flow. Phase 4 should upgrade this to a realtime voice session using OpenAI Realtime, Deepgram Voice Agent, or SIP media streams while preserving the same disclosure and question contract.

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

