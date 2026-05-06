"""Test suite for the LLM-only agent layer plus the surrounding plumbing.

The agents are 100% LLM-driven; there's no template/regex fallback. These
tests verify:

  * Configuration knobs (auth, voice runtime tuning) read from settings.
  * Each agent raises a clear domain error when OpenAI isn't reachable, so
    the API surfaces the reason instead of silently degrading.
  * Each agent's happy path with OpenAI mocked.
  * Pure data utilities (phone-number extraction, transcript parsing,
    `disclosure_line`).
"""

import json
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from app.api.routes import _append_turn
from app.core.config import Settings
from app.db.store import InMemoryTaskStore
from app.prompts.conversation import (
    CALL_CLOSING_LINE,
    DISCLOSURE_LINE_GENERIC,
    disclosure_line,
)
from app.schemas import (
    ApproveCallsRequest,
    CallExtraction,
    CallRecord,
    CallStatus,
    ParsedIntent,
    Question,
    SearchFilters,
    TaskPreviewRequest,
    TaskStatus,
)
from app.services.agents.conversation import (
    ConversationAgent,
    _is_personal_call,
    _parse_transcript,
    _truncate_words,
)
from app.services.agents.request_parser import (
    RequestParserAgent,
    _extract_phone_numbers,
    _normalize_phone_number,
)
from app.services.agents.summary import SummaryAgent
from app.services.agents.transcript_extraction import TranscriptExtractionAgent
from app.services.errors import ConfigurationError, LLMUnavailableError
from app.services.orchestrator import TaskOrchestrator


# ---------------------------------------------------------------------------
# Auth / config defaults
# ---------------------------------------------------------------------------


def test_production_real_mode_requires_auth_by_default():
    settings = Settings(APP_ENV="production", DEMO_MODE=False)

    assert settings.auth_required is True
    assert settings.auth_configured is False


def test_auth_can_be_disabled_explicitly_for_non_public_environments():
    settings = Settings(APP_ENV="production", DEMO_MODE=False, AUTH_REQUIRED=False)

    assert settings.auth_required is False


def test_clerk_secret_configures_auth_gate():
    settings = Settings(
        APP_ENV="production", DEMO_MODE=False, CLERK_SECRET_KEY="sk_test_demo"
    )

    assert settings.auth_required is True
    assert settings.auth_configured is True
    assert settings.clerk_jwks_endpoint == "https://api.clerk.com/v1/jwks"


def test_livekit_calling_requires_runtime_and_outbound_trunk():
    settings = Settings(
        DEMO_MODE=False,
        VOICE_RUNTIME="livekit",
        LIVEKIT_URL="wss://example.livekit.cloud",
        LIVEKIT_API_KEY="key",
        LIVEKIT_API_SECRET="secret",
    )

    assert settings.livekit_enabled is True
    assert settings.livekit_calling_enabled is False

    ready = Settings(
        DEMO_MODE=False,
        VOICE_RUNTIME="livekit",
        LIVEKIT_URL="wss://example.livekit.cloud",
        LIVEKIT_API_KEY="key",
        LIVEKIT_API_SECRET="secret",
        LIVEKIT_SIP_OUTBOUND_TRUNK_ID="ST_demo",
    )
    assert ready.livekit_calling_enabled is True


# ---------------------------------------------------------------------------
# Voice runtime config
# ---------------------------------------------------------------------------


def test_voice_runtime_config_defaults():
    settings = Settings()

    assert settings.voice_max_call_seconds == 75
    assert settings.voice_max_turns == 10
    assert settings.voice_max_reply_words == 35
    assert settings.voice_gather_initial_silence_seconds == 4
    assert settings.voice_speech_model == "phone_call"
    assert settings.voice_tts_voice == "Polly.Joanna"


def test_voice_runtime_config_can_be_overridden_via_env_aliases():
    settings = Settings(
        VOICE_MAX_CALL_SECONDS=45,
        VOICE_MAX_TURNS=6,
        VOICE_MAX_REPLY_WORDS=20,
        VOICE_GATHER_INITIAL_SILENCE_SECONDS=3,
        VOICE_SPEECH_MODEL="experimental_conversations",
        VOICE_TTS_VOICE="Polly.Matthew",
    )

    assert settings.voice_max_call_seconds == 45
    assert settings.voice_max_turns == 6
    assert settings.voice_max_reply_words == 20
    assert settings.voice_gather_initial_silence_seconds == 3
    assert settings.voice_speech_model == "experimental_conversations"
    assert settings.voice_tts_voice == "Polly.Matthew"


# ---------------------------------------------------------------------------
# Pure data utilities
# ---------------------------------------------------------------------------


def test_phone_number_extraction_normalises_to_e164():
    extracted = _extract_phone_numbers(
        "Call +1 416 555 0101, +14165550102, and (416) 555-0103."
    )
    assert extracted == ["+14165550101", "+14165550102", "+14165550103"]


def test_phone_number_normaliser_handles_us_10_digit_default():
    assert _normalize_phone_number("4165550101") == "+14165550101"
    assert _normalize_phone_number("+44 20 7946 0958") == "+442079460958"
    assert _normalize_phone_number("12345") is None  # too short


def test_disclosure_line_uses_caller_name_only_for_personal_calls():
    assert disclosure_line("Vipra", personal=True).startswith(
        "Hi, this is an AI assistant calling on behalf of Vipra."
    )
    # Business calls stay anonymous regardless of the name.
    assert disclosure_line("Vipra", personal=False) == DISCLOSURE_LINE_GENERIC
    # Personal call without a name falls back to the generic line.
    assert disclosure_line(None, personal=True) == DISCLOSURE_LINE_GENERIC


def test_parse_transcript_handles_mixed_speakers_and_blank_lines():
    transcript = "AI: hi there\n\nCallee: hi back\nAI: question?\nSystem: log line"

    assert _parse_transcript(transcript) == [
        {"speaker": "AI", "text": "hi there"},
        {"speaker": "Callee", "text": "hi back"},
        {"speaker": "AI", "text": "question?"},
        {"speaker": "Callee", "text": "log line"},  # any non-AI speaker -> Callee
    ]


def test_truncate_words_caps_long_replies_with_a_period():
    truncated = _truncate_words(" ".join(str(i) for i in range(60)), max_words=5)
    assert truncated.split()[-1].rstrip(".") == "4"
    assert truncated.endswith(".")


def test_append_turn_skips_empty_text_and_preserves_history():
    transcript = _append_turn(None, "AI", "Hi there")
    transcript = _append_turn(transcript, "Callee", "Hi back")
    transcript = _append_turn(transcript, "AI", "")  # ignored

    assert transcript == "AI: Hi there\nCallee: Hi back"


def test_is_personal_call_keys_off_task_kind():
    direct = ParsedIntent(task_kind="direct_calls", required_questions=[])
    nearby = ParsedIntent(task_kind="nearby_search", required_questions=[])

    assert _is_personal_call(direct) is True
    assert _is_personal_call(nearby) is False
    assert _is_personal_call(None) is False


# ---------------------------------------------------------------------------
# LLM-only contract: each agent raises ConfigurationError when no API key
# ---------------------------------------------------------------------------


@pytest.fixture
def settings_without_openai() -> Settings:
    """Settings where openai_enabled is False — every agent must refuse."""
    return Settings(DEMO_MODE=True, MAX_CALLS_PER_TASK=5)


@pytest.mark.asyncio
async def test_request_parser_raises_when_openai_not_configured(settings_without_openai):
    agent = RequestParserAgent(settings_without_openai)
    with pytest.raises(ConfigurationError) as ctx:
        await agent.parse(
            TaskPreviewRequest(
                original_request="Call +1 416 555 0101 and ask their plans tonight."
            )
        )
    assert "OpenAI" in str(ctx.value)


def test_conversation_opening_raises_when_openai_not_configured(settings_without_openai):
    agent = ConversationAgent(settings_without_openai)
    call = CallRecord(
        id="c1",
        task_id="t1",
        business_id="b1",
        business_name="Contact 1",
        questions=[Question(id="q1", text="Anything?", required=True)],
    )
    with pytest.raises(ConfigurationError):
        agent.opening(call)


@pytest.mark.asyncio
async def test_conversation_respond_raises_when_openai_not_configured(
    settings_without_openai,
):
    agent = ConversationAgent(settings_without_openai)
    call = CallRecord(
        id="c1",
        task_id="t1",
        business_id="b1",
        business_name="Contact 1",
        questions=[Question(id="q1", text="Anything?", required=True)],
    )
    with pytest.raises(ConfigurationError):
        await agent.respond(call=call, last_utterance="hi", turn_index=1)


@pytest.mark.asyncio
async def test_transcript_extraction_raises_when_openai_not_configured(
    settings_without_openai,
):
    agent = TranscriptExtractionAgent(settings_without_openai)
    call = CallRecord(
        id="c1",
        task_id="t1",
        business_id="b1",
        business_name="Contact 1",
        status=CallStatus.COMPLETED,
        transcript="AI: hi\nCallee: yes",
    )
    with pytest.raises(ConfigurationError):
        await agent.extract(call)


@pytest.mark.asyncio
async def test_summary_agent_raises_when_openai_not_configured(settings_without_openai):
    agent = SummaryAgent(settings_without_openai)
    intent = ParsedIntent(task_kind="direct_calls", required_questions=[])
    detail = SimpleNamespace(
        task=SimpleNamespace(
            id="t1", parsed_intent_json=intent, status="completed"
        ),
        businesses=[],
        calls=[],
        summary=None,
        editable_questions=[],
    )

    class FakeDetail:
        def model_dump(self, mode: str | None = None) -> dict[str, Any]:
            return {}

    # Use the real schema-shaped detail — easier than mocking model_dump.
    with pytest.raises(ConfigurationError):
        await agent.summarize(_make_empty_task_detail())


def _make_empty_task_detail():
    """Build a minimally-valid TaskDetail for tests that just need to invoke
    summarize() with something that has model_dump()."""
    from app.db.store import utc_now
    from app.schemas import SearchTask, TaskDetail

    return TaskDetail(
        task=SearchTask(
            id="t1",
            original_request="x",
            parsed_intent_json=ParsedIntent(task_kind="direct_calls", required_questions=[]),
            radius=3000,
            status=TaskStatus.COMPLETED,
            created_at=utc_now(),
        ),
        businesses=[],
        calls=[],
    )


# ---------------------------------------------------------------------------
# LLM happy path (with OpenAI mocked) — covers the orchestrator end-to-end.
# ---------------------------------------------------------------------------


class _StubOpenAIResponse:
    def __init__(self, output_text: str) -> None:
        self.output_text = output_text


class _StubAsyncResponses:
    def __init__(self, payloads: list[str]) -> None:
        self._payloads = list(payloads)

    async def create(self, **kwargs: Any) -> _StubOpenAIResponse:
        return _StubOpenAIResponse(self._payloads.pop(0))


class _StubAsyncOpenAI:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        # Drain into a class-level queue so each instantiation reuses the same script.
        self.responses = _StubAsyncResponses(_StubAsyncOpenAI._queued_payloads)


@pytest.mark.asyncio
async def test_orchestrator_round_trip_with_mocked_openai(monkeypatch):
    """End-to-end happy path: parser -> approve_calls -> summary, with the
    LLM stubbed.

    Verifies:
      * parser produces a ParsedIntent with the LLM's questions and objective,
      * the summary agent produces a SummaryRecord that lands on the task,
      * the orchestrator threads everything end to end.
    """

    parser_payload = json.dumps(
        {
            "task_kind": "direct_calls",
            "business_type": "contact",
            "search_target": "user-provided phone numbers",
            "call_objective": "Find out their plans for the weekend.",
            "direct_phone_numbers": ["+14372201120"],
            "location_text": None,
            "radius_meters": 3000,
            "required_questions": [
                {"id": "q1", "text": "What are your plans for the weekend?", "required": True}
            ],
            "constraints": {},
            "calls_required": True,
            "online_search_enough": False,
            "summary_criteria": ["Plans captured"],
            "output_format": "call_outcome_tracker",
        }
    )

    summary_payload = json.dumps(
        {
            "final_summary": "Spoke to Contact 1 and captured their weekend plans.",
            "recommendation_json": {
                "task_kind": "direct_calls",
                "best_overall": "Contact 1",
                "accepted": ["Contact 1"],
                "declined": [],
                "maybe": [],
                "did_not_answer": [],
                "uncertainty": [],
                "results": [
                    {
                        "target": "Contact 1",
                        "restaurant": "Contact 1",
                        "phone_number": "+14372201120",
                        "call_status": "completed",
                        "outcome": "accepted",
                        "answer_summary": "Hiking on Saturday.",
                        "follow_up_required": "no",
                        "happy_hour": "unknown",
                        "vegan_options": "unknown",
                        "notes": "Plans confirmed.",
                        "recommended": True,
                    }
                ],
            },
        }
    )

    extraction_payload = json.dumps(
        {
            "restaurant_name": "Contact 1",
            "contact_name": "Contact 1",
            "phone_number": "+14372201120",
            "call_status": "completed",
            "call_outcome": "accepted",
            "answer_summary": "Hiking on Saturday.",
            "key_details": {},
            "follow_up_required": "no",
            "appointment_available": "unknown",
            "appointment_time": None,
            "appointment_details": None,
            "booking_requirements": None,
            "happy_hour_available": "unknown",
            "happy_hour_time": None,
            "happy_hour_details": None,
            "vegan_options_available": "unknown",
            "vegan_options_details": None,
            "reservation_required": "unknown",
            "confidence_score": 0.9,
            "notes": "Plans captured.",
            "recommended_for_user": True,
            "source": "phone_call",
        }
    )

    # Each agent makes one call. We queue payloads in invocation order:
    #   parser -> extraction -> summary
    _StubAsyncOpenAI._queued_payloads = [
        parser_payload,
        extraction_payload,
        summary_payload,
    ]

    import openai

    monkeypatch.setattr(openai, "AsyncOpenAI", _StubAsyncOpenAI)

    settings = Settings(
        DEMO_MODE=False,
        APP_ENV="test",
        AUTH_REQUIRED=False,
        OPENAI_API_KEY="sk-stub",
        MAX_CALLS_PER_TASK=5,
    )
    store = InMemoryTaskStore()
    orchestrator = TaskOrchestrator(settings, store)

    preview = await orchestrator.preview(
        TaskPreviewRequest(
            original_request="Call +1 437 220 1120 and ask their plans for the weekend",
            filters=SearchFilters(max_calls=1),
        )
    )

    assert preview.task.parsed_intent_json.task_kind == "direct_calls"
    assert preview.task.parsed_intent_json.direct_phone_numbers == ["+14372201120"]
    assert "plans for the weekend" in preview.editable_questions[0].text.lower()


@pytest.mark.asyncio
async def test_request_parser_raises_llm_unavailable_on_invalid_json(monkeypatch):
    _StubAsyncOpenAI._queued_payloads = ["not valid json"]
    import openai

    monkeypatch.setattr(openai, "AsyncOpenAI", _StubAsyncOpenAI)
    agent = RequestParserAgent(
        Settings(DEMO_MODE=False, OPENAI_API_KEY="sk-stub", AUTH_REQUIRED=False)
    )
    with pytest.raises(LLMUnavailableError):
        await agent.parse(
            TaskPreviewRequest(original_request="Call +1 416 555 0101 and ask anything.")
        )


@pytest.mark.asyncio
async def test_request_parser_raises_llm_unavailable_on_no_questions(monkeypatch):
    payload = json.dumps(
        {
            "task_kind": "direct_calls",
            "business_type": "contact",
            "search_target": "user-provided phone numbers",
            "call_objective": "do nothing",
            "direct_phone_numbers": ["+14165550101"],
            "radius_meters": 3000,
            "required_questions": [],
            "constraints": {},
            "calls_required": True,
            "online_search_enough": False,
            "summary_criteria": [],
            "output_format": "call_outcome_tracker",
        }
    )
    _StubAsyncOpenAI._queued_payloads = [payload]
    import openai

    monkeypatch.setattr(openai, "AsyncOpenAI", _StubAsyncOpenAI)
    agent = RequestParserAgent(
        Settings(DEMO_MODE=False, OPENAI_API_KEY="sk-stub", AUTH_REQUIRED=False)
    )
    with pytest.raises(LLMUnavailableError) as ctx:
        await agent.parse(
            TaskPreviewRequest(original_request="Call +1 416 555 0101 and ask anything.")
        )
    assert "did not produce any questions" in str(ctx.value)


# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------


def test_in_memory_store_tracks_usage_and_clears_history():
    store = InMemoryTaskStore()
    user_id = store.ensure_user(
        external_subject="clerk:user_123",
        email="user@example.com",
        name="Demo User",
    )

    assert store.get_request_count(user_id) == 0
    assert store.increment_request_count(user_id) == 1
    assert store.get_request_count(user_id) == 1
    assert store.delete_tasks(user_id=user_id) == 0
