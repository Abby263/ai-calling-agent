import { CheckCircle2, Download, FileText, Mail, Printer, Sparkles, Table2 } from "lucide-react";

import { metersToDistance, outcomeLabel, statusClass, triStateLabel } from "../lib/format";
import type { TaskDetail } from "../types/domain";
import { Badge, Button } from "./ui";

export function ResultsView({ task }: { task: TaskDetail }) {
  const results = task.summary?.recommendation_json.results ?? [];
  const isDirectCallTask = task.task.parsed_intent_json.task_kind === "direct_calls";
  const isAppointmentTask =
    task.task.parsed_intent_json.output_format === "appointment_availability_tracker" ||
    task.task.parsed_intent_json.business_type === "clinic";
  const mailto = `mailto:?subject=${encodeURIComponent("Voice Concierge results")}&body=${encodeURIComponent(
    task.summary?.final_summary ?? ""
  )}`;
  const completedCalls = task.calls.filter((call) => call.status === "completed").length;
  const transcriptCount = task.calls.filter((call) => call.transcript).length;
  const recommendedCount = results.filter((result) => result.recommended).length;

  function exportJson() {
    const blob = new Blob([JSON.stringify(task, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `voice-concierge-${task.task.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="grid gap-5">
      <div className="surface-strong relative overflow-hidden p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-brand-gradient opacity-10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
              <Sparkles size={11} />
              Final summary
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[1.7rem]">
              {isDirectCallTask
                ? "Call outcome tracker"
                : isAppointmentTask
                  ? "Appointment availability"
                  : "Business comparison"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => window.print()}>
              <Printer size={15} />
              PDF
            </Button>
            <Button type="button" variant="secondary" onClick={exportJson}>
              <Download size={15} />
              JSON
            </Button>
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-900"
              href={mailto}
            >
              <Mail size={15} />
              Email
            </a>
          </div>
        </div>
        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Completed calls", completedCalls, CheckCircle2, "text-emerald-600 dark:text-emerald-400"],
            ["Recommended", recommendedCount, Table2, "text-brand-600 dark:text-brand-400"],
            ["Transcripts", transcriptCount, FileText, "text-sky-600 dark:text-sky-400"]
          ].map(([label, value, Icon, accent]) => {
            const MetricIcon = Icon as typeof CheckCircle2;
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

      <div className="surface-strong p-5 sm:p-6">
        <p className="max-w-4xl text-base leading-7 text-slate-800 dark:text-slate-200">
          {task.summary?.final_summary ?? "Summary is not available yet."}
        </p>
        {isDirectCallTask ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Recommendation label="Accepted" value={(task.summary?.recommendation_json.accepted ?? []).join(", ")} accent="emerald" />
            <Recommendation label="Needs follow-up" value={(task.summary?.recommendation_json.maybe ?? []).join(", ")} accent="amber" />
            <Recommendation label="Declined" value={(task.summary?.recommendation_json.declined ?? []).join(", ")} accent="rose" />
            <Recommendation
              label="No answer"
              value={(task.summary?.recommendation_json.did_not_answer ?? []).join(", ")}
              accent="slate"
            />
          </div>
        ) : isAppointmentTask ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Recommendation label="Best option" value={task.summary?.recommendation_json.best_overall} accent="brand" />
            <Recommendation
              label="Available"
              value={(task.summary?.recommendation_json.appointment_available as string[] | undefined)?.join(", ")}
              accent="emerald"
            />
            <Recommendation
              label="No answer"
              value={(task.summary?.recommendation_json.did_not_answer ?? []).join(", ")}
              accent="slate"
            />
            <Recommendation
              label="Uncertain"
              value={(task.summary?.recommendation_json.uncertainty ?? []).join(", ")}
              accent="amber"
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Recommendation label="Best overall" value={task.summary?.recommendation_json.best_overall} accent="brand" />
            <Recommendation label="Best happy hour" value={task.summary?.recommendation_json.best_happy_hour} accent="amber" />
            <Recommendation
              label="Best vegan-friendly"
              value={task.summary?.recommendation_json.best_vegan_friendly}
              accent="emerald"
            />
            <Recommendation label="Closest" value={task.summary?.recommendation_json.closest} accent="sky" />
          </div>
        )}
      </div>

      <div className="surface-strong overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200/70 px-5 py-3.5 dark:border-slate-800/70">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
            <Table2 size={16} />
          </span>
          <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
            Structured results
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-slate-50/60 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
              {isDirectCallTask ? (
                <tr>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Outcome</th>
                  <th className="px-5 py-3">Answer</th>
                  <th className="px-5 py-3">Follow-up</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              ) : isAppointmentTask ? (
                <tr>
                  <th className="px-5 py-3">Clinic</th>
                  <th className="px-5 py-3">Available</th>
                  <th className="px-5 py-3">Earliest time</th>
                  <th className="px-5 py-3">Booking requirements</th>
                  <th className="px-5 py-3">Follow-up</th>
                  <th className="px-5 py-3">Recommendation</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-5 py-3">Business</th>
                  <th className="px-5 py-3">Distance</th>
                  <th className="px-5 py-3">Happy hour</th>
                  <th className="px-5 py-3">Vegan options</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3">Recommendation</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {results.map((result) =>
                isDirectCallTask ? (
                  <tr key={`${result.target ?? result.restaurant}-${result.phone_number ?? ""}`} className="transition hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                      {result.target ?? result.restaurant}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{result.phone_number ?? "Unknown"}</td>
                    <td className="px-5 py-3.5">
                      <Badge className={statusClass(result.outcome ?? "unknown")}>
                        {outcomeLabel(result.outcome)}
                      </Badge>
                    </td>
                    <td className="max-w-lg px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {result.answer_summary ?? result.notes}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge className={statusClass(result.follow_up_required ?? "unknown")}>
                        {triStateLabel(result.follow_up_required)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge className={statusClass(result.call_status ?? "unknown")}>
                        {(result.call_status ?? "unknown").replace("_", " ")}
                      </Badge>
                    </td>
                  </tr>
                ) : isAppointmentTask ? (
                  <tr key={result.restaurant} className="transition hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                      {result.target ?? result.restaurant}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge className={statusClass(result.appointment_available ?? "unknown")}>
                        {triStateLabel(result.appointment_available)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{result.appointment_time ?? "Unknown"}</td>
                    <td className="max-w-lg px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {result.booking_requirements ?? result.appointment_details ?? result.notes}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge className={statusClass(result.follow_up_required ?? "unknown")}>
                        {triStateLabel(result.follow_up_required)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      {result.recommended ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Best next call
                        </Badge>
                      ) : (
                        <Badge className="border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                          Compare
                        </Badge>
                      )}
                    </td>
                  </tr>
                ) : (
                  <tr key={result.restaurant} className="transition hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">{result.restaurant}</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{metersToDistance(result.distance_meters)}</td>
                    <td className="px-5 py-3.5">
                      <Badge className={statusClass(result.happy_hour)}>
                        {triStateLabel(result.happy_hour)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge className={statusClass(result.vegan_options)}>
                        {triStateLabel(result.vegan_options)}
                      </Badge>
                    </td>
                    <td className="max-w-md px-5 py-3.5 text-slate-600 dark:text-slate-300">{result.notes}</td>
                    <td className="px-5 py-3.5">
                      {result.recommended ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Recommended
                        </Badge>
                      ) : (
                        <Badge className="border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                          Compare
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {task.calls.map((call) => (
          <article key={call.id} className="surface-strong p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-semibold tracking-tight text-slate-900 dark:text-white">
                {call.business_name}
              </h2>
              <Badge className={statusClass(call.status)}>{call.status.replace("_", " ")}</Badge>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/70 bg-slate-950 dark:border-slate-800/70">
              <pre className="max-h-52 whitespace-pre-wrap p-4 font-mono text-xs leading-5 text-slate-100 scrollbar-thin">
                {call.transcript ?? "Transcript not available."}
              </pre>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const ACCENT_CLASSES: Record<string, string> = {
  brand:
    "border-brand-200 bg-brand-50/70 text-brand-900 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-100",
  emerald:
    "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100",
  amber:
    "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100",
  rose:
    "border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100",
  sky:
    "border-sky-200 bg-sky-50/70 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100",
  slate:
    "border-slate-200 bg-slate-50/70 text-slate-800 dark:border-slate-800/70 dark:bg-slate-950/40 dark:text-slate-200"
};

function Recommendation({
  label,
  value,
  accent = "slate"
}: {
  label: string;
  value?: unknown;
  accent?: keyof typeof ACCENT_CLASSES | string;
}) {
  const accentClass = ACCENT_CLASSES[accent as string] ?? ACCENT_CLASSES.slate;
  return (
    <div className={`rounded-xl border p-3.5 ${accentClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-75">{label}</p>
      <p className="mt-1 min-h-6 text-sm font-semibold tracking-tight">
        {typeof value === "string" && value ? value : "Unknown"}
      </p>
    </div>
  );
}
