import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2
} from "lucide-react";

import { metersToDistance, priceLabel, statusClass } from "../lib/format";
import type { Question, TaskDetail } from "../types/domain";
import { Badge, Button, Field, Input, Textarea } from "./ui";

export function BusinessPreview({
  task,
  selectedIds,
  setSelectedIds,
  questions,
  setQuestions,
  maxCalls,
  setMaxCalls,
  onApprove,
  onBack,
  loading
}: {
  task: TaskDetail;
  selectedIds: string[];
  setSelectedIds: (value: string[]) => void;
  questions: Question[];
  setQuestions: (value: Question[]) => void;
  maxCalls: number;
  setMaxCalls: (value: number) => void;
  onApprove: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const selectedSet = new Set(selectedIds);
  const isDirectCallTask = task.task.parsed_intent_json.task_kind === "direct_calls";
  const targetLabel = isDirectCallTask ? "contact" : "business";
  const targetLabelPlural = isDirectCallTask ? "contacts" : "businesses";
  const approvedQuestions = questions.filter((question) => question.text.trim()).length;
  const callLimit = Math.min(maxCalls, task.businesses.length || maxCalls);
  const hasQuestions = approvedQuestions > 0;
  const clarificationQuestions = task.task.parsed_intent_json.constraints.clarifying_questions;
  const clarificationMessage = Array.isArray(clarificationQuestions)
    ? clarificationQuestions.filter((item): item is string => typeof item === "string").join(" ")
    : "";
  const disabledReason =
    selectedIds.length === 0
      ? `Select at least one ${targetLabel} to call.`
      : !hasQuestions
        ? "Add at least one approved question before starting calls."
        : null;
  const approveDisabled = loading || disabledReason !== null;
  const approveLabel =
    selectedIds.length === 1
      ? `Approve 1 ${targetLabel} and start call`
      : `Approve ${selectedIds.length} ${targetLabelPlural} and start calls`;
  const recommendedSelection = task.businesses.slice(0, maxCalls).map((business) => business.id);

  function toggleBusiness(id: string) {
    if (selectedSet.has(id)) {
      setSelectedIds(selectedIds.filter((selected) => selected !== id));
      return;
    }
    if (selectedIds.length >= maxCalls) {
      setSelectedIds([...selectedIds.slice(1), id]);
      return;
    }
    setSelectedIds([...selectedIds, id]);
  }

  function updateQuestion(id: string, text: string) {
    setQuestions(questions.map((question) => (question.id === id ? { ...question, text } : question)));
  }

  function removeQuestion(id: string) {
    setQuestions(questions.filter((question) => question.id !== id));
  }

  function updateMaxCalls(value: number) {
    const nextMax = Math.min(5, Math.max(1, value || 1));
    setMaxCalls(nextMax);
    setSelectedIds(selectedIds.slice(0, nextMax));
  }

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
              Approval queue
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[1.7rem]">
              Approve {targetLabelPlural} and questions
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-600 dark:text-slate-400">
              Select targets, review the questions, then press the approval button. The agent will
              only call selected targets.
            </p>
            {clarificationMessage ? (
              <p className="mt-3 inline-flex max-w-xl items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {clarificationMessage}
              </p>
            ) : null}
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:min-w-[24rem]">
            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200/70 bg-panel-gradient dark:border-slate-700/80 dark:bg-panel-gradient-dark">
              {[
                ["Selected", selectedIds.length],
                ["Limit", maxCalls],
                ["Questions", approvedQuestions]
              ].map(([label, value], index, arr) => (
                <div
                  key={label}
                  className={`px-4 py-3 ${index < arr.length - 1 ? "border-r border-slate-200/70 dark:border-slate-700/70" : ""}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                    {label}
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <Button
              type="button"
              onClick={onApprove}
              disabled={approveDisabled}
              title={disabledReason ?? "Approve selected targets and start calls"}
              className="w-full justify-center px-5"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Starting approved calls
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  {approveLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="surface sticky top-[5.25rem] z-20 flex flex-wrap items-center justify-between gap-3 p-3 shadow-lifted">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">
            Ready to approve?
          </p>
          <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
            {disabledReason ??
              `${selectedIds.length} selected, ${approvedQuestions} question${
                approvedQuestions === 1 ? "" : "s"
              } prepared. Calls begin only after this approval.`}
          </p>
        </div>
        <Button
          type="button"
          onClick={onApprove}
          disabled={approveDisabled}
          title={disabledReason ?? "Approve selected targets and start calls"}
          className="min-w-[14rem] px-5"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Starting calls
            </>
          ) : (
            <>
              <CheckCircle2 size={16} />
              Approve and start
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="surface-strong overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-3.5 dark:border-slate-700/70">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                <ClipboardList size={16} />
              </span>
              <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
                {task.businesses.length} {targetLabelPlural}
              </h2>
            </div>
            <Badge className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
              {selectedIds.length}/{maxCalls} queued
            </Badge>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-9 min-h-9 px-3 text-xs"
                disabled={task.businesses.length === 0}
                onClick={() => setSelectedIds(recommendedSelection)}
              >
                Select top {callLimit}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 min-h-9 px-3 text-xs"
                disabled={selectedIds.length === 0}
                onClick={() => setSelectedIds([])}
              >
                Clear selection
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-[2.5rem_minmax(12rem,1.4fr)_8rem_6rem_6rem] gap-3 border-b border-slate-200/70 bg-slate-50/70 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-300 max-lg:hidden">
            <span />
            <span>{isDirectCallTask ? "Contact" : "Business"}</span>
            <span>{isDirectCallTask ? "Phone" : "Distance"}</span>
            <span>{isDirectCallTask ? "Source" : "Rating"}</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
            {task.businesses.length === 0 ? (
              <div className="grid gap-2 px-5 py-8 text-sm text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white">No callable targets found.</p>
                <p>
                  Add phone numbers or clarify the request, then go back to intake and build a new
                  approval queue.
                </p>
              </div>
            ) : null}
            {task.businesses.map((business) => {
              const selected = selectedSet.has(business.id);
              return (
                <button
                  key={business.id}
                  type="button"
                  onClick={() => toggleBusiness(business.id)}
                  className={`group grid w-full gap-3 px-5 py-4 text-left transition lg:grid-cols-[2.5rem_minmax(12rem,1.4fr)_8rem_6rem_6rem] ${
                    selected
                      ? "bg-brand-50/70 hover:bg-brand-50 dark:bg-brand-500/15 dark:hover:bg-brand-500/20"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/70"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 transition ${
                      selected
                        ? "border-transparent bg-brand-gradient text-white shadow-soft"
                        : "border-slate-300 bg-white text-transparent group-hover:border-brand-400 dark:border-slate-600 dark:bg-slate-800"
                    }`}
                  >
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <span className="grid gap-1">
                    <span className="font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      {business.name}
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {isDirectCallTask ? "User-provided number" : business.address}
                    </span>
                    <span className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {business.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} />
                          {business.phone}
                        </span>
                      ) : (
                        <span>No phone</span>
                      )}
                      {business.website ? (
                        <span className="inline-flex items-center gap-1">
                          <ExternalLink size={12} />
                          Website
                        </span>
                      ) : null}
                      {!isDirectCallTask && business.rating ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Star size={12} fill="currentColor" />
                          {business.rating}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {isDirectCallTask
                      ? business.phone ?? "No phone"
                      : metersToDistance(business.distance_meters)}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {isDirectCallTask
                      ? "Direct"
                      : `${business.rating ?? "—"} · ${priceLabel(business.price_level)}`}
                  </span>
                  <span>
                    <Badge className={statusClass(selected ? "completed" : "unknown")}>
                      {selected ? "Selected" : "Tap to select"}
                    </Badge>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="surface-strong grid content-start gap-4 p-5 xl:sticky xl:top-6">
          <div className="rounded-xl border border-brand-100 bg-brand-50/70 p-3 dark:border-brand-500/50 dark:bg-brand-500/15">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
              <Sparkles size={11} />
              Detected objective
            </p>
            <p className="mt-1.5 text-sm leading-6 text-slate-700 dark:text-slate-200">
              {task.task.parsed_intent_json.call_objective}
            </p>
          </div>

          <Field label="Max calls">
            <Input
              type="number"
              min={1}
              max={5}
              value={maxCalls}
              onChange={(event) => updateMaxCalls(Number(event.target.value))}
            />
          </Field>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
                Approved call questions
              </h2>
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-9 px-0"
                aria-label="Add question"
                title="Add question"
                onClick={() =>
                  setQuestions([
                    ...questions,
                    { id: `q_${crypto.randomUUID()}`, text: "", required: true }
                  ])
                }
              >
                <Plus size={16} />
              </Button>
            </div>
            {questions.map((question, index) => (
              <div key={question.id} className="grid grid-cols-[1fr_2.5rem] gap-2">
                <Textarea
                  value={question.text}
                  onChange={(event) => updateQuestion(question.id, event.target.value)}
                  rows={2}
                  aria-label={`Question ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-10 px-0"
                  aria-label={`Remove question ${index + 1}`}
                  title="Remove question"
                  onClick={() => removeQuestion(question.id)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            {!hasQuestions ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100">
                Add at least one concise question. The approval button turns on after a target and
                question are selected.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button
              type="button"
              onClick={onApprove}
              disabled={approveDisabled}
              title={disabledReason ?? "Approve selected targets and start calls"}
              className="flex-1 px-5"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Starting calls
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  Approve and start
                </>
              )}
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs leading-5 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            <span>
              The call opens with AI disclosure and a no-sales statement. Do not approve numbers
              that should not be contacted.
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}
