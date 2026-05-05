import { useCallback, useEffect, useMemo, useState } from "react";

import { BusinessPreview } from "./components/BusinessPreview";
import { HistoryPanel } from "./components/HistoryPanel";
import { ProgressTimeline } from "./components/ProgressTimeline";
import { RequestComposer } from "./components/RequestComposer";
import { ResultsView } from "./components/ResultsView";
import { Badge, Button } from "./components/ui";
import { api } from "./lib/api";
import { statusClass } from "./lib/format";
import type { LocationInput, Question, SearchFilters, TaskDetail, TaskListItem } from "./types/domain";

type Stage = "request" | "preview" | "progress" | "results";

const DEFAULT_REQUEST =
  "Call +1 416 555 0101, +1 416 555 0102, and +1 416 555 0103. Invite them for dinner tonight and track who says yes.";

const initialFilters: SearchFilters = {
  radius_meters: 3000,
  cuisine: null,
  price_level: null,
  min_rating: 4,
  open_now: true,
  max_calls: 5,
  preferred_call_time: "Now",
  dietary_preference: null
};

export default function App() {
  const [stage, setStage] = useState<Stage>("request");
  const [requestText, setRequestText] = useState(DEFAULT_REQUEST);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [location, setLocation] = useState<LocationInput>({ label: "Toronto, ON" });
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [history, setHistory] = useState<TaskListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [maxCalls, setMaxCalls] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeId = task?.task.id;

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await api.listTasks());
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!task || !["calling", "summarizing"].includes(task.task.status)) {
      return;
    }
    const interval = window.setInterval(async () => {
      try {
        const updated = await api.getTask(task.task.id);
        setTask(updated);
        if (updated.summary) {
          setStage("results");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Polling failed.");
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [task]);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    try {
      const preview = await api.previewTask({
        original_request: requestText,
        location,
        filters
      });
      setTask(preview);
      setQuestions(preview.editable_questions);
      setMaxCalls(filters.max_calls);
      setSelectedIds(preview.businesses.slice(0, filters.max_calls).map((business) => business.id));
      setStage("preview");
      refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.approveCalls(task.task.id, {
        business_ids: selectedIds,
        questions: questions.filter((question) => question.text.trim()),
        max_calls: maxCalls,
        preferred_call_time: filters.preferred_call_time,
        task_snapshot: task
      });
      setTask(updated);
      setStage(updated.summary ? "results" : "progress");
      refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Call approval failed.");
    } finally {
      setLoading(false);
    }
  }

  async function openTask(id: string) {
    setLoading(true);
    setError(null);
    try {
      const detail = await api.getTask(id);
      setTask(detail);
      setRequestText(detail.task.original_request);
      setQuestions(detail.editable_questions);
      setSelectedIds(detail.businesses.filter((business) => business.selected_for_call).map((business) => business.id));
      if (detail.summary) setStage("results");
      else if (detail.calls.length) setStage("progress");
      else setStage("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open task.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelTask() {
    if (!task) return;
    const updated = await api.cancelTask(task.task.id);
    setTask(updated);
    refreshHistory();
  }

  async function deleteTask(id: string) {
    await api.deleteTask(id);
    if (task?.task.id === id) {
      setTask(null);
      setStage("request");
    }
    refreshHistory();
  }

  function startNewTask() {
    setTask(null);
    setStage("request");
    setRequestText(DEFAULT_REQUEST);
    setQuestions([]);
    setSelectedIds([]);
    setError(null);
  }

  const stageItems = useMemo(
    () => [
      ["request", "Compose"],
      ["preview", "Preview"],
      ["progress", "Calls"],
      ["results", "Results"]
    ] as const,
    []
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_34%),linear-gradient(180deg,_#f8fafc,_#eef2f7)] p-3 sm:p-4">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <HistoryPanel tasks={history} activeId={activeId} onOpen={openTask} onDelete={deleteTask} />

        <div className="grid gap-4">
          <header className="grid gap-3 rounded-md border border-line bg-white/95 p-4 shadow-soft backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand">Production console</p>
                <h1 className="text-xl font-semibold text-ink">Voice Concierge Agent</h1>
              </div>
              <div className="flex items-center gap-2">
                {task ? (
                  <Badge className={statusClass(task.task.status)}>{task.task.status.replace("_", " ")}</Badge>
                ) : null}
                <Button type="button" variant="secondary" onClick={startNewTask}>
                  New task
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {stageItems.map(([value, label], index) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    if (value === "request" || task) setStage(value);
                  }}
                  disabled={value !== "request" && !task}
                  className={`flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    stage === value
                      ? "border-brand bg-brand text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      stage === value ? "bg-white text-brand" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </header>

          {stage === "request" ? (
            <RequestComposer
              requestText={requestText}
              setRequestText={setRequestText}
              filters={filters}
              setFilters={setFilters}
              location={location}
              setLocation={setLocation}
              onPreview={handlePreview}
              loading={loading}
              error={error}
            />
          ) : null}

          {stage === "preview" && task ? (
            <>
              {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
              <BusinessPreview
                task={task}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                questions={questions}
                setQuestions={setQuestions}
                maxCalls={maxCalls}
                setMaxCalls={setMaxCalls}
                onApprove={handleApprove}
                onBack={() => setStage("request")}
                loading={loading}
              />
            </>
          ) : null}

          {stage === "progress" && task ? (
            <ProgressTimeline task={task} onCancel={cancelTask} onResults={() => setStage("results")} />
          ) : null}

          {stage === "results" && task ? <ResultsView task={task} /> : null}
        </div>
      </div>
    </main>
  );
}
