import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  PhoneCall,
  ShieldCheck
} from "lucide-react";

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
      { value: "request", label: "Intake", icon: ListChecks },
      { value: "preview", label: "Approval", icon: ClipboardCheck },
      { value: "progress", label: "Calls", icon: PhoneCall },
      { value: "results", label: "Results", icon: CheckCircle2 }
    ] as const,
    []
  );

  const taskStats = useMemo(() => {
    const calls = task?.calls ?? [];
    const completed = calls.filter((call) => call.status === "completed").length;
    const active = calls.filter((call) => call.status === "calling" || call.status === "pending").length;
    const answered = calls.filter((call) => call.extraction_json?.call_status === "completed").length;
    return [
      { label: "Targets", value: task?.businesses.length ?? 0 },
      { label: "Approved", value: selectedIds.length },
      { label: "Active", value: active },
      { label: "Completed", value: completed || answered }
    ];
  }, [selectedIds.length, task]);

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-ink sm:p-4">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[18.5rem_minmax(0,1fr)]">
        <div className="order-1 grid gap-4 lg:order-2">
          <header className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">
                  VC
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand">Voice operations console</p>
                  <h1 className="text-xl font-semibold text-ink">Voice Concierge Agent</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {task ? (
                  <Badge className={statusClass(task.task.status)}>{task.task.status.replace("_", " ")}</Badge>
                ) : null}
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  <ShieldCheck size={13} />
                  AI disclosure
                </Badge>
                <Button type="button" variant="secondary" onClick={startNewTask}>
                  New task
                </Button>
              </div>
            </div>
            <div className="grid gap-3 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Task stages">
                {stageItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        if (item.value === "request" || task) setStage(item.value);
                      }}
                      disabled={item.value !== "request" && !task}
                      aria-current={stage === item.value ? "step" : undefined}
                      className={`flex min-h-12 items-center gap-2 rounded-md border px-3 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        stage === item.value
                          ? "border-brand bg-brand text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-md ${
                          stage === item.value ? "bg-white text-brand" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="grid">
                        <span>{item.label}</span>
                        <span className={stage === item.value ? "text-xs text-blue-100" : "text-xs text-slate-400"}>
                          Step {index + 1}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>
              <div className="grid grid-cols-4 overflow-hidden rounded-md border border-line bg-panel">
                {taskStats.map((stat) => (
                  <div key={stat.label} className="border-r border-line px-3 py-2 last:border-r-0">
                    <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{stat.value}</p>
                  </div>
                ))}
              </div>
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

        <HistoryPanel tasks={history} activeId={activeId} onOpen={openTask} onDelete={deleteTask} />
      </div>
    </main>
  );
}
