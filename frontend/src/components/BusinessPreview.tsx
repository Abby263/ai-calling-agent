import { Check, ExternalLink, Phone, Plus, ShieldCheck, Trash2 } from "lucide-react";

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

  return (
    <section className="grid gap-5">
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Review before calls</p>
        <h1 className="text-2xl font-semibold text-ink">
          Approve the {targetLabelPlural} and call script
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Calls are capped at {maxCalls}. The agent will disclose it is an AI assistant calling on
          behalf of the user and will only ask the approved questions.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
          <div className="grid grid-cols-[2.5rem_minmax(12rem,1.4fr)_8rem_6rem_6rem] gap-3 border-b border-line bg-panel px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-lg:hidden">
            <span />
            <span>{isDirectCallTask ? "Contact" : "Business"}</span>
            <span>{isDirectCallTask ? "Phone" : "Distance"}</span>
            <span>{isDirectCallTask ? "Source" : "Rating"}</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-line">
            {task.businesses.map((business) => {
              const selected = selectedSet.has(business.id);
              return (
                <button
                  key={business.id}
                  type="button"
                  onClick={() => toggleBusiness(business.id)}
                  className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-slate-50 lg:grid-cols-[2.5rem_minmax(12rem,1.4fr)_8rem_6rem_6rem]"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-md border ${
                      selected
                        ? "border-brand bg-brand text-white"
                        : "border-slate-300 bg-white text-transparent"
                    }`}
                  >
                    <Check size={16} />
                  </span>
                  <span className="grid gap-1">
                    <span className="font-semibold text-slate-900">{business.name}</span>
                    <span className="text-sm text-slate-600">
                      {isDirectCallTask ? "User-provided number" : business.address}
                    </span>
                    <span className="flex flex-wrap gap-2 text-xs text-slate-500">
                      {business.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={13} />
                          {business.phone}
                        </span>
                      ) : (
                        <span>No phone</span>
                      )}
                      {business.website ? (
                        <span className="inline-flex items-center gap-1">
                          <ExternalLink size={13} />
                          Website
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="text-sm text-slate-700">
                    {isDirectCallTask ? business.phone ?? "No phone" : metersToDistance(business.distance_meters)}
                  </span>
                  <span className="text-sm text-slate-700">
                    {isDirectCallTask ? "Direct" : `${business.rating ?? "N/A"} · ${priceLabel(business.price_level)}`}
                  </span>
                  <span>
                    <Badge className={statusClass(business.open_now ? "completed" : "unknown")}>
                      {business.open_now ? "Open" : "Check"}
                    </Badge>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="grid content-start gap-4 rounded-md border border-line bg-white p-4 shadow-soft">
          <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Detected objective</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {task.task.parsed_intent_json.call_objective}
            </p>
          </div>

          <Field label="Max calls">
            <Input
              type="number"
              min={1}
              max={5}
              value={maxCalls}
              onChange={(event) => setMaxCalls(Math.min(5, Math.max(1, Number(event.target.value))))}
            />
          </Field>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Approved call questions</h2>
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
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button
              type="button"
              onClick={onApprove}
              disabled={loading || selectedIds.length === 0 || questions.every((question) => !question.text.trim())}
            >
              <Phone size={16} />
              {loading ? "Starting calls" : `Call ${selectedIds.length} ${selectedIds.length === 1 ? targetLabel : targetLabelPlural}`}
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs leading-5 text-slate-600">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-700" />
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
