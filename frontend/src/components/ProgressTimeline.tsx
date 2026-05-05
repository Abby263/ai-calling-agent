import { Ban, CheckCircle2, Clock, FileText, PhoneCall, Radio, Sparkles } from "lucide-react";

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
  const noAnswer = task.calls.filter(
    (call) => call.status === "no_answer" || call.status === "voicemail"
  ).length;
  const inProgress = task.calls.filter(
    (call) => call.status === "calling" || call.status === "pending"
  ).length;
  const totalCalls = task.calls.length || 1;
  const progressPct = Math.min(100, Math.round((completed / totalCalls) * 100));

  return (
    <section className="grid gap-5">
      <div className="surface-strong relative overflow-hidden p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-brand-gradient opacity-10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
              <Sparkles size={11} />
              Live call progress
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[1.7rem]">
              Calling approved {isDirectCallTask ? "contacts" : "businesses"}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-600 dark:text-slate-400">
              Streaming status, transcripts, and structured extraction for each approved target.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {task.summary ? (
              <Button type="button" onClick={onResults}>
                <CheckCircle2 size={15} />
                View results
              </Button>
            ) : null}
            <Button type="button" variant="danger" onClick={onCancel}>
              <Ban size={15} />
              Cancel run
            </Button>
          </div>
        </div>

        <div className="relative mt-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Run progress</span>
            <span>{progressPct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ["Total calls", task.calls.length, PhoneCall, "text-slate-700 dark:text-slate-200"],
            ["In progress", inProgress, Radio, "text-amber-600 dark:text-amber-400"],
            ["Completed", completed, CheckCircle2, "text-emerald-600 dark:text-emerald-400"],
            ["No answer", noAnswer, Clock, "text-rose-600 dark:text-rose-400"]
          ].map(([label, value, Icon, accent]) => {
            const MetricIcon = Icon as typeof PhoneCall;
            return (
              <div
                key={label as string}
                className="rounded-xl border border-slate-200/70 bg-panel-gradient p-3.5 dark:border-slate-800/70 dark:bg-panel-gradient-dark"
              >
                <div className="flex items-center gap-2">
                  <MetricIcon size={14} className={accent as string} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {label as string}
                  </p>
                </div>
                <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {value as number}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3">
        {task.calls.map((call, index) => {
          const isLive = call.status === "calling" || call.status === "pending";
          return (
            <div
              key={call.id}
              className="surface-strong p-4 transition hover:shadow-lifted"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`relative flex h-11 w-11 items-center justify-center rounded-xl ${
                      isLive
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        : call.status === "completed"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
                    }`}
                  >
                    {isLive ? (
                      <>
                        <span
                          aria-hidden
                          className="absolute inset-0 animate-ping-slow rounded-xl bg-current opacity-20"
                        />
                        <Radio size={18} />
                      </>
                    ) : call.status === "completed" ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <PhoneCall size={18} />
                    )}
                  </span>
                  <div>
                    <p className="font-display font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      <span className="text-slate-400 dark:text-slate-500">{String(index + 1).padStart(2, "0")}</span>
                      {"  "}
                      {call.business_name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {call.phone_number ?? "No phone"}
                    </p>
                  </div>
                </div>
                <Badge className={statusClass(call.status)}>
                  {isLive ? (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-current opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                    </span>
                  ) : null}
                  {callStatusLabel(call.status)}
                </Badge>
              </div>
              {call.extraction_json ? (
                <div className="mt-4 grid gap-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 text-sm text-slate-700 dark:border-slate-800/70 dark:bg-slate-950/40 dark:text-slate-300 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      {isDirectCallTask ? "Outcome" : isAppointmentTask ? "Appointment" : "Happy hour"}
                    </p>
                    <p className="mt-0.5 font-medium">
                      {isDirectCallTask
                        ? outcomeLabel(call.extraction_json.call_outcome)
                        : isAppointmentTask
                          ? call.extraction_json.appointment_available
                          : call.extraction_json.happy_hour_available}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      {isDirectCallTask ? "Follow-up" : isAppointmentTask ? "Time" : "Vegan"}
                    </p>
                    <p className="mt-0.5 font-medium">
                      {isDirectCallTask
                        ? call.extraction_json.follow_up_required
                        : isAppointmentTask
                          ? call.extraction_json.appointment_time ?? "Unknown"
                          : call.extraction_json.vegan_options_available}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      Confidence
                    </p>
                    <p className="mt-0.5 font-medium">
                      {Math.round(call.extraction_json.confidence_score * 100)}%
                    </p>
                  </div>
                </div>
              ) : null}
              {call.transcript ? (
                <details className="mt-3 overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-slate-800/70 dark:bg-slate-950/60">
                  <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900">
                    <FileText size={14} />
                    Transcript
                  </summary>
                  <pre className="max-h-44 overflow-auto border-t border-slate-200/70 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 scrollbar-thin dark:border-slate-800/70">
                    {call.transcript}
                  </pre>
                </details>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
