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
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-100";
  }
  if (["calling", "answered", "pending", "unknown", "summarizing", "maybe"].includes(value)) {
    return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/60 dark:bg-amber-400/15 dark:text-amber-100";
  }
  if (["failed", "no", "no_answer", "voicemail", "cancelled", "declined"].includes(value)) {
    return "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-400/60 dark:bg-rose-500/15 dark:text-rose-100";
  }
  return "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-500/60 dark:bg-slate-700/40 dark:text-slate-100";
}
