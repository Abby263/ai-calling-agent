import { Ban, CheckCircle2, Clock, FileText, PhoneCall, Radio } from "lucide-react";

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
  const completed = task.calls.filter((call) => call.status === "completed").length;
  const noAnswer = task.calls.filter((call) => call.status === "no_answer" || call.status === "voicemail").length;
  const inProgress = task.calls.filter((call) => call.status === "calling" || call.status === "pending").length;

  return (
    <section className="grid gap-4">
      <div className="rounded-md border border-line bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Live call progress</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink dark:text-white">
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
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            ["Total calls", task.calls.length, PhoneCall],
            ["In progress", inProgress, Radio],
            ["Completed", completed, CheckCircle2],
            ["No answer", noAnswer, Clock]
          ].map(([label, value, Icon]) => {
            const MetricIcon = Icon as typeof PhoneCall;
            return (
              <div key={label as string} className="rounded-md border border-line bg-panel p-3 dark:border-slate-800 dark:bg-slate-950">
                <MetricIcon size={16} className="text-brand" />
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{label as string}</p>
                <p className="text-xl font-semibold text-slate-950 dark:text-white">{value as number}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3">
        {task.calls.map((call, index) => (
          <div key={call.id} className="rounded-md border border-line bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-brand dark:bg-blue-950/40">
                  {call.status === "calling" || call.status === "pending" ? (
                    <Clock size={18} />
                  ) : (
                    <PhoneCall size={18} />
                  )}
                </span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {index + 1}. {call.business_name}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{call.phone_number ?? "No phone"}</p>
                </div>
              </div>
              <Badge className={statusClass(call.status)}>{callStatusLabel(call.status)}</Badge>
            </div>
            {call.extraction_json ? (
              <div className="mt-4 grid gap-2 rounded-md border border-line bg-panel p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 sm:grid-cols-3">
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
            {call.transcript ? (
              <details className="mt-3 rounded-md border border-line bg-white dark:border-slate-800 dark:bg-slate-950">
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <FileText size={15} />
                  Transcript
                </summary>
                <pre className="max-h-44 overflow-auto border-t border-line bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 dark:border-slate-800">
                  {call.transcript}
                </pre>
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
