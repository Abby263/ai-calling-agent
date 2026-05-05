from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    DRAFT = "draft"
    PREVIEW_READY = "preview_ready"
    AWAITING_APPROVAL = "awaiting_approval"
    CALLING = "calling"
    SUMMARIZING = "summarizing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class CallStatus(str, Enum):
    PENDING = "pending"
    CALLING = "calling"
    ANSWERED = "answered"
    NO_ANSWER = "no_answer"
    VOICEMAIL = "voicemail"
    FAILED = "failed"
    COMPLETED = "completed"


TriState = Literal["yes", "no", "unknown"]
TaskKind = Literal["direct_calls", "nearby_search"]
CallOutcome = Literal["accepted", "declined", "maybe", "no_answer", "voicemail", "unknown", "not_applicable"]


class LocationInput(BaseModel):
    lat: float | None = None
    lng: float | None = None
    label: str | None = None


class SearchFilters(BaseModel):
    radius_meters: int = Field(default=3000, ge=250, le=25000)
    cuisine: str | None = None
    price_level: int | None = Field(default=None, ge=1, le=4)
    min_rating: float | None = Field(default=4.0, ge=0, le=5)
    open_now: bool = True
    max_calls: int = Field(default=5, ge=1, le=5)
    preferred_call_time: str | None = None
    dietary_preference: str | None = "vegan"


class TaskPreviewRequest(BaseModel):
    original_request: str = Field(min_length=4, max_length=1000)
    location: LocationInput = Field(default_factory=LocationInput)
    filters: SearchFilters = Field(default_factory=SearchFilters)


class Question(BaseModel):
    id: str
    text: str
    required: bool = True


class ParsedIntent(BaseModel):
    task_kind: TaskKind = "nearby_search"
    business_type: str = "restaurant"
    search_target: str = "nearby restaurants and bars"
    call_objective: str = "Find out the answer to the user's request."
    direct_phone_numbers: list[str] = Field(default_factory=list)
    location_text: str | None = None
    radius_meters: int = 3000
    required_questions: list[Question]
    constraints: dict[str, Any] = Field(default_factory=dict)
    output_format: str = "comparison_table_with_recommendations"
    calls_required: bool = True
    online_search_enough: bool = False
    summary_criteria: list[str] = Field(default_factory=list)


class BusinessCandidate(BaseModel):
    id: str
    task_id: str | None = None
    place_id: str | None = None
    name: str
    address: str
    phone: str | None = None
    website: str | None = None
    rating: float | None = None
    review_count: int | None = None
    opening_hours_json: dict[str, Any] | None = None
    price_level: int | None = None
    distance_meters: int | None = None
    google_maps_url: str | None = None
    business_status: str | None = None
    open_now: bool | None = None
    relevance_score: float = 0
    selected_for_call: bool = True
    do_not_call: bool = False
    source: str = "google_places"


class CallExtraction(BaseModel):
    restaurant_name: str
    contact_name: str | None = None
    phone_number: str | None = None
    call_status: CallStatus
    call_outcome: CallOutcome = "unknown"
    answer_summary: str | None = None
    key_details: dict[str, Any] = Field(default_factory=dict)
    follow_up_required: TriState = "unknown"
    appointment_available: TriState = "unknown"
    appointment_time: str | None = None
    appointment_details: str | None = None
    booking_requirements: str | None = None
    happy_hour_available: TriState = "unknown"
    happy_hour_time: str | None = None
    happy_hour_details: str | None = None
    vegan_options_available: TriState = "unknown"
    vegan_options_details: str | None = None
    reservation_required: TriState = "unknown"
    confidence_score: float = Field(default=0, ge=0, le=1)
    notes: str = ""
    recommended_for_user: bool = False
    source: str = "phone_call"


class CallRecord(BaseModel):
    id: str
    task_id: str
    business_id: str
    business_name: str
    phone_number: str | None = None
    call_sid: str | None = None
    status: CallStatus = CallStatus.PENDING
    started_at: datetime | None = None
    ended_at: datetime | None = None
    transcript: str | None = None
    recording_url: str | None = None
    extraction_json: CallExtraction | None = None
    questions: list[Question] = Field(default_factory=list)
    disclosure_log: list[str] = Field(default_factory=list)


class SummaryRecord(BaseModel):
    id: str
    task_id: str
    final_summary: str
    recommendation_json: dict[str, Any]
    created_at: datetime


class SearchTask(BaseModel):
    id: str
    user_id: str | None = None
    original_request: str
    parsed_intent_json: ParsedIntent
    location_lat: float | None = None
    location_lng: float | None = None
    location_label: str | None = None
    radius: int
    status: TaskStatus = TaskStatus.DRAFT
    created_at: datetime
    completed_at: datetime | None = None


class TaskDetail(BaseModel):
    task: SearchTask
    businesses: list[BusinessCandidate]
    calls: list[CallRecord] = Field(default_factory=list)
    summary: SummaryRecord | None = None
    editable_questions: list[Question] = Field(default_factory=list)


class ApproveCallsRequest(BaseModel):
    business_ids: list[str]
    questions: list[Question]
    max_calls: int = Field(default=5, ge=1, le=5)
    preferred_call_time: str | None = None


class TaskListItem(BaseModel):
    id: str
    original_request: str
    status: TaskStatus
    created_at: datetime
    completed_at: datetime | None = None
    business_count: int
    call_count: int


class TwilioStatusPayload(BaseModel):
    call_sid: str | None = None
    call_status: str | None = None
    answered_by: str | None = None
