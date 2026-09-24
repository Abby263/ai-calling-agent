import type { SummaryResult } from "../types/domain";

// Quote all cells and neutralize spreadsheet formulas in phone numbers and external text.
function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function resultsCsv(results: SummaryResult[]): string {
  const headers = ["Contact / business", "Phone", "Call status", "Outcome", "Answer", "Follow-up required", "Appointment available", "Appointment time", "Booking requirements", "Distance (m)", "Happy hour", "Vegan options", "Notes", "Recommended"];
  const rows = results.map((result) => [
    result.target ?? result.restaurant, result.phone_number, result.call_status, result.outcome,
    result.answer_summary, result.follow_up_required, result.appointment_available,
    result.appointment_time, result.booking_requirements, result.distance_meters,
    result.happy_hour, result.vegan_options, result.notes, result.recommended ? "Yes" : "No"
  ]);
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadFile(content: string, mimeType: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
