import type { CallOutcome, CallStatus, TriState } from "../types/domain";

export function metersToDistance(value?: number | null): string {
  if (value === null || value === undefined) {
    return "Unknown";
  }
  if (value < 1000) {
    return `${Math.round(value)} m`;
  }
  return `${(value / 1000).toFixed(1)} km`;
}

export function priceLabel(value?: number | null): string {
  if (!value) {
    return "N/A";
  }
  return "$".repeat(value);
}

export function triStateLabel(value?: TriState): string {
  if (value === "yes") return "Confirmed";
  if (value === "no") return "No";
  return "Unknown";
}

export function outcomeLabel(value?: CallOutcome): string {
  if (value === "accepted") return "Accepted";
  if (value === "declined") return "Declined";
  if (value === "maybe") return "Needs follow-up";
  if (value === "no_answer") return "No answer";
  if (value === "voicemail") return "Voicemail";
  if (value === "not_applicable") return "N/A";
  return "Unknown";
}

export function callStatusLabel(status: CallStatus): string {
  return status.replace("_", " ");
}

export function statusClass(value: string): string {
  if (["completed", "yes", "accepted"].includes(value)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["calling", "pending", "unknown", "summarizing", "maybe"].includes(value)) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (["failed", "no", "no_answer", "voicemail", "cancelled", "declined"].includes(value)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}
