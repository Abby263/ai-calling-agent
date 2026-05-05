import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  Moon,
  PhoneCall,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  Target
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
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem("theme") === "dark");

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
    document.documentElement.classList.toggle("dark", darkMode);
    window.localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

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
      { value: "request", label: "Intake", icon: ListChecks, hint: "Describe the task" },
      { value: "preview", label: "Approve", icon: ClipboardCheck, hint: "Review queue" },
      { value: "progress", label: "Calls", icon: PhoneCall, hint: "Live status" },
      { value: "results", label: "Results", icon: CheckCircle2, hint: "Decisions" }
    ] as const,
    []
  );

  const activeStageIndex = stageItems.findIndex((item) => item.value === stage);

  const taskStats = useMemo(() => {
    const calls = task?.calls ?? [];
    const completed = calls.filter((call) => call.status === "completed").length;
    const active = calls.filter((call) => call.status === "calling" || call.status === "pending").length;
    const answered = calls.filter((call) => call.extraction_json?.call_status === "completed").length;
    return [
      { label: "Targets", value: task?.businesses.length ?? 0, icon: <Target size={13} /> },
      { label: "Approved", value: selectedIds.length, icon: <ClipboardCheck size={13} /> },
      { label: "Active", value: active, icon: <Activity size={13} /> },
      { label: "Completed", value: completed || answered, icon: <CheckCircle2 size={13} /> }
    ];
  }, [selectedIds.length, task]);

  return (
    <main className="relative min-h-screen text-ink dark:text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid-light bg-[size:32px_32px] opacity-60 dark:bg-grid-dark"
      />
      <div className="mx-auto max-w-[88rem] px-3 py-4 sm:px-5 sm:py-6">
        <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <div className="order-1 grid gap-5 lg:order-2">
            <header className="surface-strong overflow-hidden">
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute inset-0 bg-brand-gradient-soft"
                />
                <div className="relative flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      <span
                        aria-hidden
                        className="absolute -inset-1 rounded-2xl bg-brand-gradient opacity-50 blur-md"
                      />
                      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lifted">
                        <PhoneCall size={20} strokeWidth={2.4} />
                      </span>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
                        <Sparkles size={11} />
                        Voice Operations Console
                      </p>
                      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[1.6rem]">
                        Voice Concierge <span className="text-gradient">Agent</span>
                      </h1>
                      <p className="mt-0.5 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                        Natural-language requests become approved outbound calls, transcripts, and structured decisions.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {task ? (
                      <Badge className={statusClass(task.task.status)}>
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-current opacity-60" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                        </span>
                        {task.task.status.replace("_", " ")}
                      </Badge>
                    ) : null}
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <ShieldCheck size={12} />
                      AI disclosure
                    </Badge>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-10 w-10 px-0"
                      aria-label={darkMode ? "Use light mode" : "Use dark mode"}
                      aria-pressed={darkMode}
                      title={darkMode ? "Use light mode" : "Use dark mode"}
                      onClick={() => setDarkMode((value) => !value)}
                    >
                      {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                    </Button>
                    <Button type="button" onClick={startNewTask}>
                      <Plus size={16} />
                      New task
                    </Button>
                  </div>
                </div>
              </div>

              <div className="divider" />

              <div className="grid gap-4 px-5 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <nav aria-label="Task stages" className="grid gap-2">
                  <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {stageItems.map((item, index) => {
                      const Icon = item.icon;
                      const isActive = stage === item.value;
                      const isPast = activeStageIndex > index;
                      const disabled = item.value !== "request" && !task;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            if (item.value === "request" || task) setStage(item.value);
                          }}
                          disabled={disabled}
                          aria-current={isActive ? "step" : undefined}
                          className={`group relative flex min-h-14 items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            isActive
                              ? "border-transparent bg-brand-gradient text-white shadow-lifted"
                              : isPast
                                ? "border-brand-200 bg-brand-50/60 text-brand-700 hover:border-brand-300 dark:border-brand-800/60 dark:bg-brand-950/30 dark:text-brand-300"
                                : "border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                              isActive
                                ? "bg-white/20 text-white"
                                : isPast
                                  ? "bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300"
                                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            <Icon size={15} strokeWidth={2.2} />
                          </span>
                          <span className="grid leading-tight">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
                              Step {index + 1}
                            </span>
                            <span className="text-sm font-semibold">{item.label}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </nav>

                <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-slate-200/70 bg-panel-gradient dark:border-slate-800/80 dark:bg-panel-gradient-dark">
                  {taskStats.map((stat, index) => (
                    <div
                      key={stat.label}
                      className={`px-3 py-2.5 ${index < taskStats.length - 1 ? "border-r border-slate-200/70 dark:border-slate-800/70" : ""}`}
                    >
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        <span className="text-brand-600 dark:text-brand-400">{stat.icon}</span>
                        {stat.label}
                      </p>
                      <p className="mt-1 font-display text-xl font-bold tracking-tight text-slate-950 dark:text-white">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </header>

            <div className="animate-fade-in">
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
                  {error ? (
                    <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                      {error}
                    </p>
                  ) : null}
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

          <HistoryPanel tasks={history} activeId={activeId} onOpen={openTask} onDelete={deleteTask} />
        </div>
      </div>
    </main>
  );
}
