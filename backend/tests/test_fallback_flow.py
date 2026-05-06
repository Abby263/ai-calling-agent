from uuid import uuid4

import pytest

from app.api.routes import _append_speech_turn
from app.core.config import Settings
from app.db.store import InMemoryTaskStore
from app.schemas import (
    ApproveCallsRequest,
    CallRecord,
    CallStatus,
    Question,
    SearchFilters,
    TaskPreviewRequest,
    TaskStatus,
)
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
    assert "dinner tonight" in preview.editable_questions[0].text

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
