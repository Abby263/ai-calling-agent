import {
  CalendarCheck,
  CheckCircle2,
  CircleDashed,
  PhoneMissed,
  Sparkles,
  Voicemail,
  XCircle
} from "lucide-react";

import { outcomeLabel, statusClass, triStateLabel } from "../lib/format";
import type { CallExtraction, CallRecord } from "../types/domain";
import { Badge } from "./ui";

type DecisionView = {
  /** Big colored badge classes */
  badgeClass: string;
  /** Label for the big status pill */
  label: string;
  /** Short prose summarising what happened */
  summary: string;
  /** Optional secondary facts (key/value) */
  details: { label: string; value: string }[];
  /** Icon for the big status pill */
  icon: typeof CheckCircle2;
};

function buildDecision({
  extraction,
  call,
  isDirectCallTask,
  isAppointmentTask
}: {
  extraction: CallExtraction | null | undefined;
  call: CallRecord;
  isDirectCallTask: boolean;
  isAppointmentTask: boolean;
}): DecisionView {
  const summaryFromCall = extraction?.answer_summary?.trim() || extraction?.notes?.trim() || "";

  if (!extraction) {
    if (call.status === "no_answer") {
      return {
        badgeClass: statusClass("no_answer"),
        label: "No answer",
        summary: "The line did not pick up before the call ended.",
        details: [],
        icon: PhoneMissed
      };
    }
    if (call.status === "voicemail") {
      return {
        badgeClass: statusClass("voicemail"),
        label: "Voicemail",
        summary: "The call reached voicemail.",
        details: [],
        icon: Voicemail
      };
    }
    if (call.status === "failed") {
      return {
        badgeClass: statusClass("failed"),
        label: "Call failed",
        summary: "The call did not complete successfully.",
        details: [],
        icon: XCircle
      };
    }
    return {
      badgeClass: statusClass("pending"),
      label: "Decision pending",
      summary: "The call has ended; building the decision summary.",
      details: [],
      icon: CircleDashed
    };
  }

  if (isDirectCallTask) {
    const outcome = extraction.call_outcome ?? "unknown";
    const followUp = extraction.follow_up_required;
    return {
      badgeClass: statusClass(outcome),
      label: outcomeLabel(outcome),
      summary:
        summaryFromCall ||
        `The contact responded ${outcomeLabel(outcome).toLowerCase()}.`,
      details: [
        { label: "Follow-up", value: triStateLabel(followUp) },
        {
          label: "Confidence",
          value: `${Math.round((extraction.confidence_score ?? 0) * 100)}%`
        }
      ],
      icon:
        outcome === "accepted"
          ? CheckCircle2
          : outcome === "declined"
            ? XCircle
            : outcome === "no_answer"
              ? PhoneMissed
              : outcome === "voicemail"
                ? Voicemail
                : Sparkles
    };
  }

  if (isAppointmentTask) {
    const available = extraction.appointment_available ?? "unknown";
    return {
      badgeClass: statusClass(available),
      label: available === "yes" ? "Appointment available" : triStateLabel(available),
      summary:
        summaryFromCall ||
        (extraction.appointment_details?.trim() ?? "Captured the clinic's response."),
      details: [
        ...(extraction.appointment_time
          ? [{ label: "Earliest time", value: extraction.appointment_time }]
          : []),
        ...(extraction.booking_requirements
          ? [{ label: "Booking", value: extraction.booking_requirements }]
          : []),
        {
          label: "Confidence",
          value: `${Math.round((extraction.confidence_score ?? 0) * 100)}%`
        }
      ],
      icon: available === "yes" ? CalendarCheck : CircleDashed
    };
  }

  // Nearby business / restaurant
  const happy = extraction.happy_hour_available ?? "unknown";
  const vegan = extraction.vegan_options_available ?? "unknown";
  return {
    badgeClass: statusClass(happy),
    label:
      happy === "yes"
        ? "Happy hour confirmed"
        : happy === "no"
          ? "No happy hour"
          : "Details captured",
    summary:
      summaryFromCall ||
      `${extraction.happy_hour_details?.trim() ?? "Captured the venue's response."}`,
    details: [
      ...(extraction.happy_hour_time
        ? [{ label: "Happy hour", value: extraction.happy_hour_time }]
        : []),
      { label: "Vegan options", value: triStateLabel(vegan) },
      {
        label: "Confidence",
        value: `${Math.round((extraction.confidence_score ?? 0) * 100)}%`
      }
    ],
    icon: happy === "yes" ? CheckCircle2 : Sparkles
  };
}

export function CallDecisionPanel({
  call,
  isDirectCallTask,
  isAppointmentTask
}: {
  call: CallRecord;
  isDirectCallTask: boolean;
  isAppointmentTask: boolean;
}) {
  const decision = buildDecision({
    extraction: call.extraction_json,
    call,
    isDirectCallTask,
    isAppointmentTask
  });
  const Icon = decision.icon;

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-700/70 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-soft dark:bg-slate-900">
            <Icon size={18} className="text-brand-600 dark:text-brand-300" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Decision
            </p>
            <Badge className={`${decision.badgeClass} mt-1 text-sm`}>{decision.label}</Badge>
          </div>
        </div>
        {call.extraction_json ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-right text-xs sm:grid-cols-2">
            {decision.details.map((detail) => (
              <div key={detail.label} className="flex justify-between gap-3 sm:flex-col sm:items-end">
                <span className="font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {detail.label}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {decision.summary ? (
        <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{decision.summary}</p>
      ) : null}
    </div>
  );
}
