from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api.routes import _append_speech_turn, _append_turn
from app.core.config import Settings
from app.db.store import InMemoryTaskStore
from app.schemas import (
    ApproveCallsRequest,
    CallRecord,
    CallStatus,
    ParsedIntent,
    Question,
    SearchFilters,
    TaskPreviewRequest,
    TaskStatus,
)
from app.services import auth as auth_module
from app.services.agents.conversation import (
    CALL_CLOSING_LINE,
    DISCLOSURE_LINE,
    MAX_TURNS,
    ConversationAgent,
    _parse_transcript,
    _scripted_respond,
    _truncate_words,
    disclosure_for,
)
from app.services.auth import ClerkAuthService, ClerkUserProfile, _billing_payload
from app.services.compliance import build_turn_prompt
from app.services.orchestrator import TaskOrchestrator


def test_production_real_mode_requires_auth_by_default():
    settings = Settings(APP_ENV="production", DEMO_MODE=False)

    assert settings.auth_required is True
    assert settings.auth_configured is False


def test_auth_can_be_disabled_explicitly_for_non_public_environments():
    settings = Settings(APP_ENV="production", DEMO_MODE=False, AUTH_REQUIRED=False)

    assert settings.auth_required is False


def test_clerk_secret_configures_auth_gate():
    settings = Settings(APP_ENV="production", DEMO_MODE=False, CLERK_SECRET_KEY="sk_test_demo")

    assert settings.auth_required is True
    assert settings.auth_configured is True
    assert settings.clerk_jwks_endpoint == "https://api.clerk.com/v1/jwks"


def test_admin_email_can_be_resolved_from_clerk_profile(monkeypatch):
    settings = Settings(
        APP_ENV="production",
        DEMO_MODE=False,
        CLERK_SECRET_KEY="sk_test_demo",
        ADMIN_EMAILS="admin@example.com",
    )
    store = InMemoryTaskStore()
    request = SimpleNamespace(
        headers={"authorization": "Bearer test-token"},
        cookies={},
        app=SimpleNamespace(state=SimpleNamespace(settings=settings, store=store)),
    )
    service = ClerkAuthService(settings)
    monkeypatch.setattr(service, "_verify_token", lambda _token: {"sub": "user_admin"})
    monkeypatch.setattr(
        auth_module,
        "_clerk_user_profile",
        lambda _secret, _subject: ClerkUserProfile(
            email="Admin@Example.com",
            name="Admin User",
        ),
    )

    session = service.get_session(request, raise_errors=True)
    payload = _billing_payload(request, settings, session)

    assert session is not None
    assert session.email == "Admin@Example.com"
    assert payload["plan"] == "admin"
    assert payload["unlimited"] is True
    assert payload["remaining_requests"] is None


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


def test_scripted_twilio_prompt_asks_one_question_at_a_time():
    questions = [
        Question(id="q1", text="Can you come to dinner tonight?", required=True),
        Question(id="q2", text="Do you need the address?", required=True),
    ]

    first_prompt = build_turn_prompt(questions, 0)
    second_prompt = build_turn_prompt(questions, 1)

    assert "Question 1 of 2" in first_prompt
    assert "Can you come to dinner tonight?" in first_prompt
    assert "Do you need the address?" not in first_prompt
    assert "Question 2 of 2" in second_prompt
    assert "Do you need the address?" in second_prompt


def test_speech_turns_append_question_and_answer_separately():
    questions = [
        Question(id="q1", text="Can you come to dinner tonight?", required=True),
        Question(id="q2", text="Do you need the address?", required=True),
    ]

    transcript = _append_speech_turn(
        transcript=None,
        questions=questions,
        question_index=0,
        speech_result="Yes, I can come.",
        confidence="0.91",
    )
    transcript = _append_speech_turn(
        transcript=transcript,
        questions=questions,
        question_index=1,
        speech_result="Please text me the address.",
        confidence="0.88",
    )

    assert "AI: Can you come to dinner tonight?" in transcript
    assert "Callee: Yes, I can come. Speech confidence: 0.91." in transcript
    assert "AI: Do you need the address?" in transcript
    assert "Callee: Please text me the address. Speech confidence: 0.88." in transcript


@pytest.mark.asyncio
async def test_demo_preview_and_calls_complete():
    settings = Settings(DEMO_MODE=True, MAX_CALLS_PER_TASK=5)
    orchestrator = TaskOrchestrator(settings, InMemoryTaskStore())
    preview = await orchestrator.preview(
        TaskPreviewRequest(
            original_request="Find happy hours near me and ask if they have vegan food.",
            filters=SearchFilters(radius_meters=3000, max_calls=3),
        )
    )

    assert preview.task.status == "awaiting_approval"
    assert preview.businesses

    approved = await orchestrator.approve_calls(
        preview.task.id,
        ApproveCallsRequest(
            business_ids=[business.id for business in preview.businesses[:3]],
            questions=preview.editable_questions,
            max_calls=3,
        ),
    )

    assert approved.task.status == "completed"
    assert approved.summary is not None
    assert len(approved.calls) == 3
    assert all(call.extraction_json is not None for call in approved.calls)


@pytest.mark.asyncio
async def test_direct_phone_number_task_tracks_general_answers():
    settings = Settings(DEMO_MODE=True, MAX_CALLS_PER_TASK=5)
    orchestrator = TaskOrchestrator(settings, InMemoryTaskStore())
    preview = await orchestrator.preview(
        TaskPreviewRequest(
            original_request=(
                "Call +1 416 555 0101, +1 416 555 0102, and +1 416 555 0103. "
                "Invite them for dinner tonight and track the answers."
            ),
            filters=SearchFilters(max_calls=3),
        )
    )

    assert preview.task.parsed_intent_json.task_kind == "direct_calls"
    assert preview.task.parsed_intent_json.direct_phone_numbers == [
        "+14165550101",
        "+14165550102",
        "+14165550103",
    ]
    assert [target.name for target in preview.businesses] == ["Contact 1", "Contact 2", "Contact 3"]
    # The non-LLM fallback embeds the user's request verbatim instead of
    # template-matching it. Any quick request should round-trip cleanly.
    first_question_text = preview.editable_questions[0].text
    assert "Invite them for dinner tonight" in first_question_text

    approved = await orchestrator.approve_calls(
        preview.task.id,
        ApproveCallsRequest(
            business_ids=[business.id for business in preview.businesses],
            questions=preview.editable_questions,
            max_calls=3,
        ),
    )

    assert approved.task.status == "completed"
    assert approved.summary is not None
    assert approved.summary.recommendation_json["task_kind"] == "direct_calls"
    outcomes = [
        call.extraction_json.call_outcome
        for call in approved.calls
        if call.extraction_json is not None
    ]
    follow_up = [
        call.extraction_json.follow_up_required
        for call in approved.calls
        if call.extraction_json is not None
    ]
    assert outcomes == ["accepted", "maybe", "declined"]
    assert follow_up == ["no", "yes", "no"]


@pytest.mark.asyncio
async def test_direct_call_fallback_embeds_user_request_verbatim():
    """Regression for the production "ask their plans for the weekend" failure.

    The non-LLM parser fallback must NOT use a generic "what answer should I
    pass back?" template. It should surface the user's actual request so the
    AI on the call has a concrete topic to ask about.
    """
    settings = Settings(DEMO_MODE=True, MAX_CALLS_PER_TASK=5)
    orchestrator = TaskOrchestrator(settings, InMemoryTaskStore())
    preview = await orchestrator.preview(
        TaskPreviewRequest(
            original_request="Call +1 437 220 1120 and ask their plans for the weekend",
            filters=SearchFilters(max_calls=1),
        )
    )

    intent = preview.task.parsed_intent_json
    assert intent.task_kind == "direct_calls"
    # Question must reference the actual goal, not a generic template.
    first = preview.editable_questions[0].text
    assert "what answer should i pass back" not in first.lower()
    assert "plans for the weekend" in first.lower()
    # Objective must also reflect the real ask.
    assert "plans for the weekend" in intent.call_objective.lower()


@pytest.mark.asyncio
async def test_direct_call_fallback_handles_arbitrary_quick_requests():
    """The fallback must be generic — any quick request should produce a
    question that quotes the user's goal, with no template-matching."""
    settings = Settings(DEMO_MODE=True, MAX_CALLS_PER_TASK=5)
    orchestrator = TaskOrchestrator(settings, InMemoryTaskStore())
    requests = [
        ("Call +1 555 010 0101 and check if they can attend Friday's demo", "friday"),
        ("Call +1 555 010 0102 and find out about the project status", "project status"),
        (
            "Call +1 555 010 0103 and ask them their thoughts on the new proposal",
            "proposal",
        ),
    ]
    for request_text, expected_keyword in requests:
        preview = await orchestrator.preview(
            TaskPreviewRequest(
                original_request=request_text,
                filters=SearchFilters(max_calls=1),
            )
        )
        first = preview.editable_questions[0].text.lower()
        assert "what answer should i pass back" not in first, request_text
        assert expected_keyword in first, request_text


@pytest.mark.asyncio
async def test_direct_call_request_without_numbers_asks_for_clarification():
    settings = Settings(DEMO_MODE=True, MAX_CALLS_PER_TASK=5)
    orchestrator = TaskOrchestrator(settings, InMemoryTaskStore())
    preview = await orchestrator.preview(
        TaskPreviewRequest(
            original_request="Call the below numbers and invite them for dinner tonight.",
            filters=SearchFilters(max_calls=3),
        )
    )

    intent = preview.task.parsed_intent_json
    assert intent.task_kind == "direct_calls"
    assert intent.direct_phone_numbers == []
    assert intent.constraints["needs_clarification"] is True
    assert "phone number" in intent.constraints["clarifying_questions"][0]
    assert preview.businesses == []
    assert preview.editable_questions


def test_disclosure_for_personal_call_uses_provided_name():
    line = disclosure_for("Vipra", personal=True)

    assert "Vipra" in line
    assert "AI assistant calling on behalf of Vipra" in line


def test_disclosure_for_business_call_omits_name():
    """Calling a restaurant or clinic should never share the user's name."""
    line = disclosure_for("Vipra", personal=False)

    assert "Vipra" not in line
    assert line == DISCLOSURE_LINE


def test_disclosure_for_no_name_falls_back_to_generic():
    line = disclosure_for(None, personal=True)
    assert line == DISCLOSURE_LINE


def test_conversation_opening_uses_caller_name_for_direct_calls():
    settings = Settings(DEMO_MODE=True)
    agent = ConversationAgent(settings)
    call = CallRecord(
        id="c1",
        task_id="t1",
        business_id="b1",
        business_name="Contact 1",
        questions=[Question(id="q1", text="Can you join dinner tonight?", required=True)],
    )
    intent = ParsedIntent(task_kind="direct_calls", required_questions=[])

    opening = agent.opening(call, intent=intent, caller_display_name="Vipra")

    assert "Vipra" in opening.reply
    assert "Can you join dinner tonight" in opening.reply


def test_conversation_opening_omits_caller_name_for_business_calls():
    """Restaurant/clinic calls don't get the user's name."""
    settings = Settings(DEMO_MODE=True)
    agent = ConversationAgent(settings)
    call = CallRecord(
        id="c1",
        task_id="t1",
        business_id="b1",
        business_name="Pizzeria Libretto",
        questions=[Question(id="q1", text="Are you open tonight?", required=True)],
    )
    intent = ParsedIntent(task_kind="nearby_search", required_questions=[])

    opening = agent.opening(call, intent=intent, caller_display_name="Vipra")

    assert "Vipra" not in opening.reply
    assert "behalf of a user" in opening.reply
    assert "Are you open tonight" in opening.reply


def test_scripted_responder_uses_name_when_callee_asks_who_is_calling():
    """A personal call should reveal the caller's name when asked."""
    questions = [
        Question(id="q1", text="Can you join dinner tonight?", required=True),
        Question(id="q2", text="What time works for you?", required=True),
    ]
    # Opening already asked q1; callee responded with a clarifying question.
    history = [
        {"speaker": "AI", "text": "Hi, this is an AI assistant. Can you join dinner tonight?"},
    ]

    turn = _scripted_respond(
        questions=questions,
        history=history,
        last_utterance="Who is this calling for?",
        turn_index=1,
        caller_display_name="Vipra",
        personal=True,
    )

    assert "on behalf of Vipra" in turn.reply
    assert turn.should_end is False


def test_scripted_responder_does_not_share_name_for_business_calls():
    """Even with a name on file, business calls should stay generic."""
    questions = [
        Question(id="q1", text="Are you open tonight?", required=True),
        Question(id="q2", text="Do you have vegan options?", required=True),
    ]
    history = [
        {"speaker": "AI", "text": "Hi, this is an AI assistant. Are you open tonight?"},
    ]

    turn = _scripted_respond(
        questions=questions,
        history=history,
        last_utterance="Who's calling?",
        turn_index=1,
        caller_display_name="Vipra",
        personal=False,
    )

    assert "Vipra" not in turn.reply
    assert "on behalf of a user" in turn.reply


def test_conversation_opening_includes_disclosure_and_first_question():
    settings = Settings(DEMO_MODE=True)
    agent = ConversationAgent(settings)
    call = CallRecord(
        id="c1",
        task_id="t1",
        business_id="b1",
        business_name="Contact 1",
        questions=[
            Question(id="q1", text="Can you join dinner tonight?", required=True),
            Question(id="q2", text="What time works for you?", required=True),
        ],
    )

    opening = agent.opening(call)

    assert "AI assistant" in opening.reply
    assert "Can you join dinner tonight" in opening.reply
    assert opening.should_end is False
    # Numbered prompts ("Question 1 of 2") would feel robotic — make sure we don't ship them.
    assert "Question 1 of" not in opening.reply


def test_scripted_responder_steers_back_after_callee_question():
    questions = [
        Question(id="q1", text="Can you join dinner tonight?", required=True),
        Question(id="q2", text="What time works for you?", required=True),
    ]
    history = [
        {"speaker": "AI", "text": "Hi, this is an AI assistant. Can you join dinner tonight?"},
    ]

    turn = _scripted_respond(
        questions=questions,
        history=history,
        last_utterance="Who is this calling for?",
        turn_index=1,
    )

    assert turn.should_end is False
    assert "What time works for you" in turn.reply
    assert turn.reply.lower().startswith("i'm just calling on behalf")


def test_scripted_responder_wraps_up_after_all_questions_answered():
    questions = [
        Question(id="q1", text="Can you join dinner tonight?", required=True),
    ]
    history = [
        {"speaker": "AI", "text": "Can you join dinner tonight?"},
        {"speaker": "Callee", "text": "Yes, count me in."},
    ]

    turn = _scripted_respond(
        questions=questions,
        history=history,
        last_utterance="Yes, count me in.",
        turn_index=2,
    )

    assert turn.should_end is True
    assert turn.reply == CALL_CLOSING_LINE


@pytest.mark.asyncio
async def test_conversation_respond_hard_caps_at_max_turns():
    settings = Settings(DEMO_MODE=True)
    agent = ConversationAgent(settings)
    call = CallRecord(
        id="c1",
        task_id="t1",
        business_id="b1",
        business_name="Contact 1",
        transcript="AI: hi.\nCallee: hi.",
        questions=[Question(id="q1", text="Quick check?", required=True)],
    )

    turn = await agent.respond(
        call=call,
        last_utterance="still talking",
        turn_index=MAX_TURNS,
    )

    assert turn.should_end is True
    assert turn.reply == CALL_CLOSING_LINE


def test_truncate_words_caps_long_replies():
    long_text = " ".join([str(i) for i in range(60)])
    truncated = _truncate_words(long_text, 5)
    assert truncated.split()[-1].rstrip(".") == "4"
    assert truncated.endswith(".")


def test_parse_transcript_handles_multiple_turns_and_blank_lines():
    transcript = "AI: hi there\n\nCallee: hi back\nAI: question?\nCallee:"

    parsed = _parse_transcript(transcript)

    assert parsed == [
        {"speaker": "AI", "text": "hi there"},
        {"speaker": "Callee", "text": "hi back"},
        {"speaker": "AI", "text": "question?"},
    ]


def test_append_turn_preserves_history_and_skips_blanks():
    transcript = _append_turn(None, "AI", "Hi there")
    transcript = _append_turn(transcript, "Callee", "Hi back")
    transcript = _append_turn(transcript, "AI", "")  # ignored

    assert transcript == "AI: Hi there\nCallee: Hi back"
    assert "Speech confidence" not in transcript
    assert DISCLOSURE_LINE  # imported sentinel — keeps the import live


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


@pytest.mark.asyncio
async def test_sequential_direct_call_transcript_keeps_all_answers():
    settings = Settings(DEMO_MODE=True, MAX_CALLS_PER_TASK=5)
    store = InMemoryTaskStore()
    orchestrator = TaskOrchestrator(settings, store)
    preview = await orchestrator.preview(
        TaskPreviewRequest(
            original_request=(
                "Call +1 416 555 0101. Invite them for dinner tonight and track the answer."
            ),
            filters=SearchFilters(max_calls=1),
        )
    )
    call = CallRecord(
        id=str(uuid4()),
        task_id=preview.task.id,
        business_id=preview.businesses[0].id,
        business_name=preview.businesses[0].name,
        phone_number=preview.businesses[0].phone,
        status=CallStatus.COMPLETED,
        questions=preview.editable_questions,
        transcript=(
            "AI: Would you like to join dinner tonight?\n"
            "Callee: Yes, I can join.\n"
            "AI: Are you available at the proposed time?\n"
            "Callee: The proposed time works.\n"
            "AI: Is there anything else the user should know?\n"
            "Callee: No follow-up needed."
        ),
    )
    preview.calls = [call]
    preview.task.status = TaskStatus.CALLING
    store.save_task(preview)

    finalized = await orchestrator.finalize_if_ready(preview.task.id)

    extraction = finalized.calls[0].extraction_json
    assert extraction is not None
    assert extraction.call_outcome == "accepted"
    assert extraction.follow_up_required == "no"
    assert "Yes, I can join." in (extraction.answer_summary or "")
    assert "No follow-up needed." in (extraction.answer_summary or "")


@pytest.mark.asyncio
async def test_doctor_appointment_request_targets_clinic_and_extracts_availability():
    settings = Settings(DEMO_MODE=True, MAX_CALLS_PER_TASK=5)
    orchestrator = TaskOrchestrator(settings, InMemoryTaskStore())
    preview = await orchestrator.preview(
        TaskPreviewRequest(
            original_request=(
                "Book an appointment with a doctor from Apple Tree at Harbour Street near me."
            ),
            filters=SearchFilters(max_calls=2, radius_meters=3000, min_rating=4),
        )
    )

    assert preview.task.parsed_intent_json.task_kind == "nearby_search"
    assert preview.task.parsed_intent_json.business_type == "clinic"
    assert preview.task.parsed_intent_json.output_format == "appointment_availability_tracker"
    assert "Apple Tree" in preview.task.parsed_intent_json.constraints["named_provider"]
    assert preview.businesses[0].name == "Appletree Medical Centre - Harbourfront"

    approved = await orchestrator.approve_calls(
        preview.task.id,
        ApproveCallsRequest(
            business_ids=[business.id for business in preview.businesses[:2]],
            questions=preview.editable_questions,
            max_calls=2,
        ),
    )

    assert approved.task.status == "completed"
    assert approved.summary is not None
    assert approved.summary.recommendation_json["use_case"] == "appointment_booking"
    first = approved.calls[0].extraction_json
    assert first is not None
    assert first.appointment_available == "yes"
    assert first.appointment_time is not None
    assert "health card" in (first.booking_requirements or "").lower()


@pytest.mark.asyncio
async def test_approval_can_use_task_snapshot_for_serverless_demo_invocation():
    settings = Settings(DEMO_MODE=True, MAX_CALLS_PER_TASK=5)
    preview_orchestrator = TaskOrchestrator(settings, InMemoryTaskStore())
    preview = await preview_orchestrator.preview(
        TaskPreviewRequest(
            original_request="Find happy hours near me and ask if they have vegan food.",
            filters=SearchFilters(max_calls=1),
        )
    )

    fresh_orchestrator = TaskOrchestrator(settings, InMemoryTaskStore())
    approved = await fresh_orchestrator.approve_calls(
        preview.task.id,
        ApproveCallsRequest(
            business_ids=[preview.businesses[0].id],
            questions=preview.editable_questions,
            max_calls=1,
            task_snapshot=preview,
        ),
    )

    assert approved.task.status == "completed"
    assert approved.summary is not None


@pytest.mark.asyncio
async def test_terminal_call_without_transcript_finalizes_with_uncertainty():
    settings = Settings(DEMO_MODE=True, MAX_CALLS_PER_TASK=5)
    store = InMemoryTaskStore()
    orchestrator = TaskOrchestrator(settings, store)
    preview = await orchestrator.preview(
        TaskPreviewRequest(
            original_request=(
                "Call +1 416 555 0101. Invite them for dinner tonight and track the answer."
            ),
            filters=SearchFilters(max_calls=1),
        )
    )
    call = CallRecord(
        id=str(uuid4()),
        task_id=preview.task.id,
        business_id=preview.businesses[0].id,
        business_name=preview.businesses[0].name,
        phone_number=preview.businesses[0].phone,
        status=CallStatus.COMPLETED,
        questions=preview.editable_questions,
    )
    preview.calls = [call]
    preview.task.status = TaskStatus.CALLING
    store.save_task(preview)

    finalized = await orchestrator.finalize_if_ready(preview.task.id)

    assert finalized.task.status == TaskStatus.COMPLETED
    assert finalized.summary is not None
    assert finalized.calls[0].extraction_json is not None
    assert finalized.calls[0].extraction_json.call_outcome == "unknown"
    assert finalized.summary.recommendation_json["uncertainty"] == ["Contact 1"]
