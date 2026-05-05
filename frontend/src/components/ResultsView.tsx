import { CheckCircle2, Download, FileText, Mail, Printer, Table2 } from "lucide-react";

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
    <section className="grid gap-4">
      <div className="rounded-md border border-line bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Final summary</p>
            <h1 className="text-2xl font-semibold text-ink dark:text-white">
              {isDirectCallTask
                ? "Call outcome tracker"
                : isAppointmentTask
                  ? "Appointment availability"
                  : "Business comparison"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => window.print()}>
              <Printer size={16} />
              PDF
            </Button>
            <Button type="button" variant="secondary" onClick={exportJson}>
              <Download size={16} />
              JSON
            </Button>
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
              href={mailto}
            >
              <Mail size={16} />
              Email
            </a>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Completed calls", completedCalls, CheckCircle2],
            ["Recommended", recommendedCount, Table2],
            ["Transcripts", transcriptCount, FileText]
          ].map(([label, value, Icon]) => {
            const MetricIcon = Icon as typeof CheckCircle2;
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

      <div className="rounded-md border border-line bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <p className="max-w-4xl text-base leading-7 text-slate-800 dark:text-slate-200">
          {task.summary?.final_summary ?? "Summary is not available yet."}
        </p>
        {isDirectCallTask ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Recommendation label="Accepted" value={(task.summary?.recommendation_json.accepted ?? []).join(", ")} />
            <Recommendation label="Needs follow-up" value={(task.summary?.recommendation_json.maybe ?? []).join(", ")} />
            <Recommendation label="Declined" value={(task.summary?.recommendation_json.declined ?? []).join(", ")} />
            <Recommendation
              label="No answer"
              value={(task.summary?.recommendation_json.did_not_answer ?? []).join(", ")}
            />
          </div>
        ) : isAppointmentTask ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Recommendation label="Best option" value={task.summary?.recommendation_json.best_overall} />
            <Recommendation
              label="Available"
              value={(task.summary?.recommendation_json.appointment_available as string[] | undefined)?.join(", ")}
            />
            <Recommendation
              label="No answer"
              value={(task.summary?.recommendation_json.did_not_answer ?? []).join(", ")}
            />
            <Recommendation
              label="Uncertain"
              value={(task.summary?.recommendation_json.uncertainty ?? []).join(", ")}
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Recommendation label="Best overall" value={task.summary?.recommendation_json.best_overall} />
            <Recommendation label="Best happy hour" value={task.summary?.recommendation_json.best_happy_hour} />
            <Recommendation
              label="Best vegan-friendly"
              value={task.summary?.recommendation_json.best_vegan_friendly}
            />
            <Recommendation label="Closest" value={task.summary?.recommendation_json.closest} />
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-line bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 dark:border-slate-800">
          <Table2 size={17} className="text-brand" />
          <h2 className="font-semibold text-slate-950 dark:text-white">Structured results</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-panel text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              {isDirectCallTask ? (
                <tr>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-4 py-3">Answer</th>
                  <th className="px-4 py-3">Follow-up</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              ) : isAppointmentTask ? (
                <tr>
                  <th className="px-4 py-3">Clinic</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">Earliest time</th>
                  <th className="px-4 py-3">Booking requirements</th>
                  <th className="px-4 py-3">Follow-up</th>
                  <th className="px-4 py-3">Recommendation</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Happy hour</th>
                  <th className="px-4 py-3">Vegan options</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Recommendation</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-line dark:divide-slate-800">
              {results.map((result) =>
                isDirectCallTask ? (
                  <tr key={`${result.target ?? result.restaurant}-${result.phone_number ?? ""}`}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {result.target ?? result.restaurant}
                    </td>
                    <td className="px-4 py-3">{result.phone_number ?? "Unknown"}</td>
                    <td className="px-4 py-3">
                      <Badge className={statusClass(result.outcome ?? "unknown")}>
                        {outcomeLabel(result.outcome)}
                      </Badge>
                    </td>
                    <td className="max-w-lg px-4 py-3 text-slate-600 dark:text-slate-300">
                      {result.answer_summary ?? result.notes}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusClass(result.follow_up_required ?? "unknown")}>
                        {triStateLabel(result.follow_up_required)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusClass(result.call_status ?? "unknown")}>
                        {(result.call_status ?? "unknown").replace("_", " ")}
                      </Badge>
                    </td>
                  </tr>
                ) : isAppointmentTask ? (
                  <tr key={result.restaurant}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {result.target ?? result.restaurant}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusClass(result.appointment_available ?? "unknown")}>
                        {triStateLabel(result.appointment_available)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{result.appointment_time ?? "Unknown"}</td>
                    <td className="max-w-lg px-4 py-3 text-slate-600 dark:text-slate-300">
                      {result.booking_requirements ?? result.appointment_details ?? result.notes}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusClass(result.follow_up_required ?? "unknown")}>
                        {triStateLabel(result.follow_up_required)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {result.recommended ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Best next call</Badge>
                      ) : (
                        <Badge className="border-slate-200 bg-slate-100 text-slate-600">Compare</Badge>
                      )}
                    </td>
                  </tr>
                ) : (
                  <tr key={result.restaurant}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{result.restaurant}</td>
                    <td className="px-4 py-3">{metersToDistance(result.distance_meters)}</td>
                    <td className="px-4 py-3">
                      <Badge className={statusClass(result.happy_hour)}>
                        {triStateLabel(result.happy_hour)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusClass(result.vegan_options)}>
                        {triStateLabel(result.vegan_options)}
                      </Badge>
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-600 dark:text-slate-300">{result.notes}</td>
                    <td className="px-4 py-3">
                      {result.recommended ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Recommended</Badge>
                      ) : (
                        <Badge className="border-slate-200 bg-slate-100 text-slate-600">Compare</Badge>
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
          <article key={call.id} className="rounded-md border border-line bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900 dark:text-white">{call.business_name}</h2>
              <Badge className={statusClass(call.status)}>{call.status.replace("_", " ")}</Badge>
            </div>
            <div className="mt-3 rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              <pre className="max-h-52 whitespace-pre-wrap font-mono scrollbar-thin">
                {call.transcript ?? "Transcript not available."}
              </pre>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Recommendation({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 min-h-6 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {typeof value === "string" && value ? value : "Unknown"}
      </p>
    </div>
  );
}
