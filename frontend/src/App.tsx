import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  LogIn,
  Moon,
  PhoneCall,
  Plus,
  ShieldCheck,
  Sun,
  Target,
  UserCircle
} from "lucide-react";

import { BusinessPreview } from "./components/BusinessPreview";
import { HistoryPanel } from "./components/HistoryPanel";
import { LandingPage } from "./components/LandingPage";
import { ProgressTimeline } from "./components/ProgressTimeline";
import { RequestComposer } from "./components/RequestComposer";
import { ResultsView } from "./components/ResultsView";
import { Badge, Button } from "./components/ui";
import { ApiError, api } from "./lib/api";
import { statusClass } from "./lib/format";
import type { AuthSession, LocationInput, Question, SearchFilters, TaskDetail, TaskListItem } from "./types/domain";

type Stage = "request" | "preview" | "progress" | "results";

const TERMINAL_CALL_STATUSES = new Set(["completed", "failed", "no_answer", "voicemail"]);

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

type RouteName = "landing" | "console";

export type AppAuthClient = {
  frontendConfigured: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
    picture?: string | null;
  } | null;
  accountControl?: ReactNode;
  signIn: () => void;
  signUp: () => void;
  signOut: () => void;
};

type ThemeControls = {
  darkMode: boolean;
  onToggleTheme: () => void;
};

type ConsolePageProps = ThemeControls & {
  onGoHome: () => void;
  authClient: AppAuthClient;
};

type AppProps = {
  authClient: AppAuthClient;
};

function routeFromPath(): RouteName {
  return window.location.pathname.startsWith("/app") ? "console" : "landing";
}

export default function App({ authClient }: AppProps) {
  const [route, setRoute] = useState<RouteName>(() => routeFromPath());
  const [darkMode, setDarkMode] = useState(() => {
    const stored = window.localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const handlePopState = () => setRoute(routeFromPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    window.localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const navigate = useCallback((nextRoute: RouteName) => {
    const nextPath = nextRoute === "console" ? "/app" : "/";
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const toggleTheme = useCallback(() => setDarkMode((value) => !value), []);

  return route === "console" ? (
    <ConsolePage
      darkMode={darkMode}
      onToggleTheme={toggleTheme}
      onGoHome={() => navigate("landing")}
      authClient={authClient}
    />
  ) : (
    <LandingPage
      darkMode={darkMode}
      onToggleTheme={toggleTheme}
      onOpenApp={() => navigate("console")}
      authClient={authClient}
    />
  );
}

function DashboardHeader({
  darkMode,
  onToggleTheme,
  onGoHome,
  authClient,
  task,
  onNewTask
}: ThemeControls & {
  onGoHome: () => void;
  authClient: AppAuthClient;
  task: TaskDetail | null;
  onNewTask: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-[88rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onGoHome}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
          >
            <ArrowLeft size={13} />
            Home
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center gap-2 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-soft">
              <PhoneCall size={15} />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-sm font-semibold text-slate-950 dark:text-white">
                Voice Concierge
              </span>
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Operations console
              </span>
            </span>
          </button>
          {task ? (
            <Badge className={`${statusClass(task.task.status)} ml-1 hidden md:inline-flex`}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-current opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
              </span>
              {task.task.status.replace("_", " ")}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Badge className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 lg:inline-flex">
            <ShieldCheck size={12} />
            AI disclosure on
          </Badge>
          {authClient.frontendConfigured && authClient.isSignedIn ? (
            <>
              <Badge className="hidden border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:inline-flex">
                <UserCircle size={12} />
                {authClient.user?.name || authClient.user?.email || "Signed in"}
              </Badge>
              {authClient.accountControl}
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3"
              onClick={authClient.frontendConfigured ? authClient.signIn : undefined}
              disabled={!authClient.frontendConfigured || !authClient.isLoaded}
            >
              <LogIn size={14} />
              <span className="hidden sm:inline">Sign in</span>
            </Button>
          )}
          <button
            type="button"
            aria-label={darkMode ? "Use light mode" : "Use dark mode"}
            title={darkMode ? "Use light mode" : "Use dark mode"}
            onClick={onToggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Button type="button" className="h-9 px-3" onClick={onNewTask}>
            <Plus size={14} />
            <span className="hidden sm:inline">New task</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

function StagePill({
  active,
  done,
  disabled,
  index,
  label,
  hint,
  icon: Icon,
  onClick
}: {
  active: boolean;
  done: boolean;
  disabled: boolean;
  index: number;
  label: string;
  hint: string;
  icon: typeof PhoneCall;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "step" : undefined}
      className={`group relative flex min-h-14 items-center gap-3 overflow-hidden rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-65 ${
        active
          ? "border-transparent bg-brand-gradient text-white shadow-lifted"
          : done
            ? "border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-300 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-100"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-600"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
          active
            ? "bg-white/20 text-white"
            : done
              ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
        }`}
      >
        <Icon size={15} strokeWidth={2.2} />
      </span>
      <span className="grid leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
          Step {index + 1}
        </span>
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[11px] font-medium opacity-75">{hint}</span>
      </span>
    </button>
  );
}

function ConsolePage({ darkMode, onToggleTheme, onGoHome, authClient }: ConsolePageProps) {
  const [stage, setStage] = useState<Stage>("request");
  const [requestText, setRequestText] = useState(DEFAULT_REQUEST);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [location, setLocation] = useState<LocationInput>({ label: "Toronto, ON" });
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [history, setHistory] = useState<TaskListItem[]>([]);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [maxCalls, setMaxCalls] = useState(5);
  const [loading, setLoading] = useState(false);
  const [finalizingResults, setFinalizingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeId = task?.task.id;

  const refreshAuth = useCallback(async () => {
    try {
      setAuthSession(await api.getAuthSession());
    } catch {
      setAuthSession({
        provider: "clerk",
        auth_required: false,
        auth_configured: false,
        authenticated: false,
        user: null
      });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    if (
      authSession?.auth_required &&
      (!authClient.isSignedIn || !authSession.authenticated)
    ) {
      setHistory([]);
      return;
    }
    try {
      setHistory(await api.listTasks());
    } catch {
      setHistory([]);
    }
  }, [authClient.isSignedIn, authSession?.auth_required]);

  useEffect(() => {
    if (authClient.isLoaded) refreshAuth();
  }, [authClient.isLoaded, authClient.isSignedIn, refreshAuth]);

  useEffect(() => {
    if (!authLoading) refreshHistory();
  }, [authLoading, refreshHistory]);

  useEffect(() => {
    if (!task || !shouldPollTask(task)) {
      return;
    }
    const interval = window.setInterval(async () => {
      try {
        const updated = await api.getTask(task.task.id);
        setTask(updated);
        if (updated.summary || updated.task.status === "completed") {
          setStage("results");
          refreshHistory();
          return;
        }
        if (callsAreTerminal(updated)) {
          const summarized = await api.summarizeTask(updated.task.id);
          setTask(summarized);
          if (summarized.summary || summarized.task.status === "completed") {
            setStage("results");
            refreshHistory();
          }
        }
      } catch (err) {
        handleApiFailure(err, "Polling failed.");
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [refreshHistory, task]);

  function handleAuthGate(): boolean {
    if (!authSession?.auth_required) return false;
    if (!authSession.auth_configured || !authClient.frontendConfigured) {
      setError("Authentication is required, but Clerk is not configured yet.");
      return true;
    }
    if (!authClient.isLoaded) {
      return true;
    }
    if (!authClient.isSignedIn) {
      authClient.signIn();
      return true;
    }
    if (!authSession.authenticated) {
      setError(authSessionErrorMessage(authSession));
      return true;
    }
    return false;
  }

  function handleApiFailure(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.status === 401) {
      setError(
        `${apiErrorMessage(err)} If you are already signed in, refresh the page or sign out and sign in again.`
      );
      return;
    }
    setError(err instanceof ApiError ? apiErrorMessage(err) : err instanceof Error ? err.message : fallback);
  }

  async function handlePreview() {
    if (handleAuthGate()) return;
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
      window.scrollTo({ top: 0, behavior: "smooth" });
      refreshHistory();
    } catch (err) {
      handleApiFailure(err, "Preview failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!task) return;
    if (handleAuthGate()) return;
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
      handleApiFailure(err, "Call approval failed.");
    } finally {
      setLoading(false);
    }
  }

  async function openTask(id: string) {
    if (handleAuthGate()) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await api.getTask(id);
      setTask(detail);
      setRequestText(detail.task.original_request);
      setQuestions(detail.editable_questions);
      setSelectedIds(detail.businesses.filter((business) => business.selected_for_call).map((business) => business.id));
      if (detail.summary) setStage("results");
      else if (callsAreTerminal(detail)) {
        setStage("progress");
        finalizeTask(detail.task.id);
      } else if (detail.calls.length) setStage("progress");
      else setStage("preview");
    } catch (err) {
      handleApiFailure(err, "Could not open task.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelTask() {
    if (!task) return;
    if (handleAuthGate()) return;
    try {
      const updated = await api.cancelTask(task.task.id);
      setTask(updated);
      refreshHistory();
    } catch (err) {
      handleApiFailure(err, "Could not cancel task.");
    }
  }

  async function finalizeTask(taskId = task?.task.id) {
    if (!taskId) return;
    if (handleAuthGate()) return;
    setFinalizingResults(true);
    setError(null);
    try {
      const updated = await api.summarizeTask(taskId);
      setTask(updated);
      setStage("results");
      refreshHistory();
    } catch (err) {
      handleApiFailure(err, "Could not build results.");
    } finally {
      setFinalizingResults(false);
    }
  }

  async function deleteTask(id: string) {
    if (handleAuthGate()) return;
    try {
      await api.deleteTask(id);
      if (task?.task.id === id) {
        setTask(null);
        setStage("request");
      }
      refreshHistory();
    } catch (err) {
      handleApiFailure(err, "Could not delete task.");
    }
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
    const active = calls.filter((call) => call.status === "calling" || call.status === "answered" || call.status === "pending").length;
    const answered = calls.filter((call) => call.extraction_json?.call_status === "completed").length;
    return [
      { label: "Targets", value: task?.businesses.length ?? 0, icon: <Target size={13} /> },
      { label: "Approved", value: selectedIds.length, icon: <ClipboardCheck size={13} /> },
      { label: "Active", value: active, icon: <Activity size={13} /> },
      { label: "Completed", value: completed || answered, icon: <CheckCircle2 size={13} /> }
    ];
  }, [selectedIds.length, task]);

  const stageTitle = useMemo(() => {
    switch (stage) {
      case "request":
        return { eyebrow: "Step 1 · Intake", title: "Describe the task", subtitle: "Plain-language request — text or voice." };
      case "preview":
        return { eyebrow: "Step 2 · Approve", title: "Review the queue", subtitle: "Confirm who gets called and what gets asked." };
      case "progress":
        return { eyebrow: "Step 3 · Calls", title: "Calls in progress", subtitle: "Live status, transcripts, and structured extraction." };
      case "results":
        return { eyebrow: "Step 4 · Results", title: "Decision-ready summary", subtitle: "Compare outcomes and share the recommendation." };
    }
  }, [stage]);

  return (
    <main className="relative min-h-screen text-ink dark:text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid-light bg-[size:32px_32px] opacity-60 dark:bg-grid-dark"
      />
      <DashboardHeader
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        onGoHome={onGoHome}
        authClient={authClient}
        task={task}
        onNewTask={startNewTask}
      />
      <div className="mx-auto max-w-[88rem] px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <div className="order-1 grid gap-6 lg:order-2">
            <section className="surface-strong p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
                    {stageTitle.eyebrow}
                  </p>
                  <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-[1.7rem]">
                    {stageTitle.title}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                    {stageTitle.subtitle}
                  </p>
                </div>
                <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200/70 bg-panel-gradient dark:border-slate-700/80 dark:bg-panel-gradient-dark sm:grid-cols-4 sm:min-w-[28rem]">
                  {taskStats.map((stat, index) => (
                    <div
                      key={stat.label}
                      className={`px-3 py-2.5 ${
                        index < taskStats.length - 1 ? "sm:border-r sm:border-slate-200/70 sm:dark:border-slate-700/70" : ""
                      } ${index % 2 === 0 ? "border-r border-slate-200/70 dark:border-slate-700/70 sm:border-0" : ""} ${
                        index < 2 ? "border-b border-slate-200/70 dark:border-slate-700/70 sm:border-0" : ""
                      }`}
                    >
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-300">
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

              <nav aria-label="Task stages" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {stageItems.map((item, index) => (
                  <StagePill
                    key={item.value}
                    active={stage === item.value}
                    done={activeStageIndex > index}
                    disabled={item.value !== "request" && !task}
                    index={index}
                    label={item.label}
                    hint={item.hint}
                    icon={item.icon}
                    onClick={() => {
                      if (item.value === "request" || task) setStage(item.value);
                    }}
                  />
                ))}
              </nav>
            </section>

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
                <ProgressTimeline
                  task={task}
                  onCancel={cancelTask}
                  onResults={() => setStage("results")}
                  onFinalize={() => finalizeTask()}
                  finalizing={finalizingResults}
                />
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

function callsAreTerminal(task: TaskDetail): boolean {
  return task.calls.length > 0 && task.calls.every((call) => TERMINAL_CALL_STATUSES.has(call.status));
}

function shouldPollTask(task: TaskDetail): boolean {
  if (["calling", "summarizing"].includes(task.task.status)) {
    return true;
  }
  return callsAreTerminal(task) && !task.summary;
}

function authSessionErrorMessage(session: AuthSession): string {
  const detail = session.auth_error?.trim();
  if (detail === "Invalid Clerk authorized party.") {
    return "Your Clerk session was rejected by the API because the Clerk authorized origin does not match this deployment.";
  }
  if (detail === "Invalid Clerk session token.") {
    return "Your Clerk session token could not be verified by the API.";
  }
  return detail
    ? `Your Clerk session was rejected by the API: ${detail}`
    : "Your Clerk sign-in was not accepted by the API. Refresh the page or sign out and sign in again.";
}

function apiErrorMessage(error: ApiError): string {
  try {
    const parsed = JSON.parse(error.message) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail;
    }
    if (
      parsed.detail &&
      typeof parsed.detail === "object" &&
      "message" in parsed.detail &&
      typeof parsed.detail.message === "string"
    ) {
      return parsed.detail.message;
    }
  } catch {
    // Fall through to the plain response body.
  }
  return error.message;
}
