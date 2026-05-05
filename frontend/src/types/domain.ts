export type TaskStatus =
  | "draft"
  | "preview_ready"
  | "awaiting_approval"
  | "calling"
  | "summarizing"
  | "completed"
  | "cancelled"
  | "failed";

export type CallStatus =
  | "pending"
  | "calling"
  | "answered"
  | "no_answer"
  | "voicemail"
  | "failed"
  | "completed";

export type TriState = "yes" | "no" | "unknown";
export type TaskKind = "direct_calls" | "nearby_search";
export type CallOutcome =
  | "accepted"
  | "declined"
  | "maybe"
  | "no_answer"
  | "voicemail"
  | "unknown"
  | "not_applicable";

export interface LocationInput {
  lat?: number | null;
  lng?: number | null;
  label?: string | null;
}

export interface SearchFilters {
  radius_meters: number;
  cuisine?: string | null;
  price_level?: number | null;
  min_rating?: number | null;
  open_now: boolean;
  max_calls: number;
  preferred_call_time?: string | null;
  dietary_preference?: string | null;
}

export interface TaskPreviewRequest {
  original_request: string;
  location: LocationInput;
  filters: SearchFilters;
}

export interface Question {
  id: string;
  text: string;
  required: boolean;
}

export interface ParsedIntent {
  task_kind: TaskKind;
  business_type: string;
  search_target: string;
  call_objective: string;
  direct_phone_numbers: string[];
  location_text?: string | null;
  radius_meters: number;
  required_questions: Question[];
  constraints: Record<string, unknown>;
  output_format: string;
  calls_required: boolean;
  online_search_enough: boolean;
  summary_criteria: string[];
}

export interface BusinessCandidate {
  id: string;
  task_id?: string | null;
  place_id?: string | null;
  name: string;
  address: string;
  phone?: string | null;
  website?: string | null;
  rating?: number | null;
  review_count?: number | null;
  opening_hours_json?: Record<string, unknown> | null;
  price_level?: number | null;
  distance_meters?: number | null;
  google_maps_url?: string | null;
  business_status?: string | null;
  open_now?: boolean | null;
  relevance_score: number;
  selected_for_call: boolean;
  do_not_call: boolean;
  source: string;
}

export interface CallExtraction {
  restaurant_name: string;
  contact_name?: string | null;
  phone_number?: string | null;
  call_status: CallStatus;
  call_outcome: CallOutcome;
  answer_summary?: string | null;
  key_details: Record<string, unknown>;
  follow_up_required: TriState;
  appointment_available: TriState;
  appointment_time?: string | null;
  appointment_details?: string | null;
  booking_requirements?: string | null;
  happy_hour_available: TriState;
  happy_hour_time?: string | null;
  happy_hour_details?: string | null;
  vegan_options_available: TriState;
  vegan_options_details?: string | null;
  reservation_required: TriState;
  confidence_score: number;
  notes: string;
  recommended_for_user: boolean;
  source: string;
}

export interface CallRecord {
  id: string;
  task_id: string;
  business_id: string;
  business_name: string;
  phone_number?: string | null;
  call_sid?: string | null;
  status: CallStatus;
  started_at?: string | null;
  ended_at?: string | null;
  transcript?: string | null;
  recording_url?: string | null;
  extraction_json?: CallExtraction | null;
  questions: Question[];
  disclosure_log: string[];
}

export interface SummaryRecord {
  id: string;
  task_id: string;
  final_summary: string;
  recommendation_json: {
    best_overall?: string | null;
    task_kind?: TaskKind;
    accepted?: string[];
    declined?: string[];
    maybe?: string[];
    best_happy_hour?: string | null;
    best_vegan_friendly?: string | null;
    closest?: string | null;
    did_not_answer?: string[];
    uncertainty?: string[];
    results?: SummaryResult[];
    [key: string]: unknown;
  };
  created_at: string;
}

export interface SummaryResult {
  restaurant: string;
  target?: string;
  phone_number?: string | null;
  call_status?: CallStatus;
  outcome?: CallOutcome;
  answer_summary?: string | null;
  follow_up_required?: TriState;
  appointment_available?: TriState;
  appointment_time?: string | null;
  appointment_details?: string | null;
  booking_requirements?: string | null;
  distance_meters?: number | null;
  happy_hour: TriState;
  vegan_options: TriState;
  notes: string;
  recommended: boolean;
}

export interface SearchTask {
  id: string;
  user_id?: string | null;
  original_request: string;
  parsed_intent_json: ParsedIntent;
  location_lat?: number | null;
  location_lng?: number | null;
  location_label?: string | null;
  radius: number;
  status: TaskStatus;
  created_at: string;
  completed_at?: string | null;
}

export interface TaskDetail {
  task: SearchTask;
  businesses: BusinessCandidate[];
  calls: CallRecord[];
  summary?: SummaryRecord | null;
  editable_questions: Question[];
}

export interface TaskListItem {
  id: string;
  original_request: string;
  status: TaskStatus;
  created_at: string;
  completed_at?: string | null;
  business_count: number;
  call_count: number;
}

export interface ApproveCallsRequest {
  business_ids: string[];
  questions: Question[];
  max_calls: number;
  preferred_call_time?: string | null;
}
