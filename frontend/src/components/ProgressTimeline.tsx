import { Ban, CheckCircle2, Clock, MessageCircle, PhoneCall, Radio, Sparkles } from "lucide-react";

import { callStatusLabel, statusClass } from "../lib/format";
import type { TaskDetail } from "../types/domain";
import { Badge, Button } from "./ui";
import { CallDecisionPanel } from "./CallDecisionPanel";
import { CallTranscript } from "./CallTranscript";

export function ProgressTimeline({
  task,
  onCancel,
  onResults,
  onFinalize,
  finalizing = false
}: {
  task: TaskDetail;
  onCancel: () => void;
  onResults: () => void;
  onFinalize: () => void;
  finalizing?: boolean;
}) {
  const isDirectCallTask = task.task.parsed_intent_json.task_kind === "direct_calls";
  const isAppointmentTask =
    task.task.parsed_intent_json.output_format === "appointment_availability_tracker" ||
    task.task.parsed_intent_json.business_type === "clinic";
  const terminalStatuses = new Set(["completed", "failed", "no_answer", "voicemail"]);
  const completed = task.calls.filter((call) => call.status === "completed").length;
  const noAnswer = task.calls.filter(
    (call) => call.status === "no_answer" || call.status === "voicemail"
  ).length;
  const inProgress = task.calls.filter(
    (call) => call.status === "calling" || call.status === "answered" || call.status === "pending"
  ).length;
  const totalCalls = task.calls.length || 1;
  const terminal = task.calls.filter((call) => terminalStatuses.has(call.status)).length;
  const allCallsTerminal = task.calls.length > 0 && terminal === task.calls.length;
  const progressPct = Math.min(100, Math.round((terminal / totalCalls) * 100));

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
              {allCallsTerminal && !task.summary
                ? "Preparing results"
                : `Calling approved ${isDirectCallTask ? "contacts" : "businesses"}`}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-600 dark:text-slate-400">
              {allCallsTerminal && !task.summary
                ? "All calls have ended. Building the structured summary from captured answers and call status."
                : "Streaming status, transcripts, and structured extraction for each approved target."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {task.summary ? (
              <Button type="button" onClick={onResults}>
                <CheckCircle2 size={15} />
                View results
              </Button>
            ) : allCallsTerminal ? (
              <Button type="button" onClick={onFinalize} disabled={finalizing}>
                <CheckCircle2 size={15} />
                {finalizing ? "Building results" : "Build results"}
              </Button>
            ) : (
              <Button type="button" variant="danger" onClick={onCancel}>
                <Ban size={15} />
                Cancel run
              </Button>
            )}
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
          const isLive = call.status === "calling" || call.status === "answered" || call.status === "pending";
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
              {!isLive ? (
                <div className="mt-4">
                  <CallDecisionPanel
                    call={call}
                    isDirectCallTask={isDirectCallTask}
                    isAppointmentTask={isAppointmentTask}
                  />
                </div>
              ) : null}
              {call.transcript ? (
                <div className="mt-4">
                  <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    <MessageCircle size={12} />
                    Conversation
                  </p>
                  <CallTranscript
                    transcript={call.transcript}
                    calleeLabel={call.business_name}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
