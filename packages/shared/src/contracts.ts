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

export interface VoiceConciergeRequest {
  original_request: string;
  location: {
    lat?: number | null;
    lng?: number | null;
    label?: string | null;
  };
  filters: {
    radius_meters: number;
    cuisine?: string | null;
    price_level?: number | null;
    min_rating?: number | null;
    open_now: boolean;
    max_calls: number;
    preferred_call_time?: string | null;
    dietary_preference?: string | null;
  };
}

export interface VoiceConciergeQuestion {
  id: string;
  text: string;
  required: boolean;
}

export interface VoiceConciergeResultRow {
  restaurant: string;
  target?: string;
  phone_number?: string | null;
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
