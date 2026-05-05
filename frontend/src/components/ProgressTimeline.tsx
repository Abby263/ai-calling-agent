import { Ban, Clock, PhoneCall } from "lucide-react";

import { callStatusLabel, outcomeLabel, statusClass } from "../lib/format";
import type { TaskDetail } from "../types/domain";
import { Badge, Button } from "./ui";

export function ProgressTimeline({
  task,
  onCancel,
  onResults
}: {
  task: TaskDetail;
  onCancel: () => void;
  onResults: () => void;
}) {
  const isDirectCallTask = task.task.parsed_intent_json.task_kind === "direct_calls";
  const isAppointmentTask =
    task.task.parsed_intent_json.output_format === "appointment_availability_tracker" ||
    task.task.parsed_intent_json.business_type === "clinic";
  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Call progress</p>
          <h1 className="text-2xl font-semibold text-ink">
            Calling approved {isDirectCallTask ? "contacts" : "businesses"}
          </h1>
        </div>
        <div className="flex gap-2">
          {task.summary ? (
            <Button type="button" onClick={onResults}>
              View results
            </Button>
          ) : null}
          <Button type="button" variant="danger" onClick={onCancel}>
            <Ban size={16} />
            Cancel
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {task.calls.map((call, index) => (
          <div key={call.id} className="rounded-md border border-line bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-brand">
                  {call.status === "calling" || call.status === "pending" ? (
                    <Clock size={18} />
                  ) : (
                    <PhoneCall size={18} />
                  )}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">
                    {index + 1}. {call.business_name}
                  </p>
                  <p className="text-sm text-slate-500">{call.phone_number ?? "No phone"}</p>
                </div>
              </div>
              <Badge className={statusClass(call.status)}>{callStatusLabel(call.status)}</Badge>
            </div>
            {call.extraction_json ? (
              <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                <span>
                  {isDirectCallTask
                    ? `Outcome: ${outcomeLabel(call.extraction_json.call_outcome)}`
                    : isAppointmentTask
                      ? `Appointment: ${call.extraction_json.appointment_available}`
                    : `Happy hour: ${call.extraction_json.happy_hour_available}`}
                </span>
                <span>
                  {isDirectCallTask
                    ? `Follow-up: ${call.extraction_json.follow_up_required}`
                    : isAppointmentTask
                      ? `Time: ${call.extraction_json.appointment_time ?? "Unknown"}`
                    : `Vegan: ${call.extraction_json.vegan_options_available}`}
                </span>
                <span>Confidence: {Math.round(call.extraction_json.confidence_score * 100)}%</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
