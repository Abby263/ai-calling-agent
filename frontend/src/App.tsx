import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Bot,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Globe2,
  ListChecks,
  LockKeyhole,
  LogIn,
  LogOut,
  MapPin,
  Mic2,
  Moon,
  PhoneCall,
  Plus,
  Server,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  UserCircle,
  Users,
  Workflow
} from "lucide-react";

import { BusinessPreview } from "./components/BusinessPreview";
import { HistoryPanel } from "./components/HistoryPanel";
import { ProgressTimeline } from "./components/ProgressTimeline";
import { RequestComposer } from "./components/RequestComposer";
import { ResultsView } from "./components/ResultsView";
import { Badge, Button } from "./components/ui";
import { ApiError, api } from "./lib/api";
import { statusClass } from "./lib/format";
import type { AuthSession, LocationInput, Question, SearchFilters, TaskDetail, TaskListItem } from "./types/domain";

type Stage = "request" | "preview" | "progress" | "results";

const DEFAULT_REQUEST =
  "Call +1 416 555 0101, +1 416 555 0102, and +1 416 555 0103. Invite them for dinner tonight and track who says yes.";

const DEMO_SCREENSHOT_URL =
  "https://raw.githubusercontent.com/Abby263/ai-calling-agent/main/docs/assets/ui-results.png";

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

type LandingPageProps = ThemeControls & {
  onOpenApp: () => void;
  authClient: AppAuthClient;
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

function ThemeButton({
  darkMode,
  onToggleTheme,
  showLabel = false
}: ThemeControls & { showLabel?: boolean }) {
  return (
    <Button
      type="button"
      variant="secondary"
      className={showLabel ? "h-11 px-4" : "h-10 w-10 px-0"}
      aria-label={darkMode ? "Use light mode" : "Use dark mode"}
      aria-pressed={darkMode}
      title={darkMode ? "Use light mode" : "Use dark mode"}
      onClick={onToggleTheme}
    >
      {darkMode ? <Sun size={showLabel ? 18 : 16} /> : <Moon size={showLabel ? 18 : 16} />}
      {showLabel ? <span>{darkMode ? "Light mode" : "Dark mode"}</span> : null}
    </Button>
  );
}

function ProductHeader({
  darkMode,
  onToggleTheme,
  onOpenApp,
  onGoHome,
  authClient,
  current
}: ThemeControls & {
  onOpenApp: () => void;
  onGoHome?: () => void;
  authClient: AppAuthClient;
  current: "landing" | "dashboard";
}) {
  const navItems = [
    { label: "Overview", href: "/", action: onGoHome },
    { label: "Use cases", href: "/#use-cases" },
    { label: "Workflow", href: "/#how-it-works" },
    { label: "Architecture", href: "/#architecture" },
    { label: "Dashboard", href: "/app", action: onOpenApp }
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/88 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/86">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 text-left"
          onClick={onGoHome ?? (() => window.scrollTo({ top: 0, behavior: "smooth" }))}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lifted">
            <PhoneCall size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-semibold text-slate-950 dark:text-white">
              Voice Concierge Agent
            </span>
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              Approved AI calling workspace
            </span>
          </span>
        </button>

        <nav className="hidden items-center rounded-xl border border-slate-200 bg-white/70 p-1 shadow-soft dark:border-slate-800 dark:bg-slate-900/60 lg:flex">
          {navItems.map((item) => {
            const active =
              (current === "landing" && item.label === "Overview") ||
              (current === "dashboard" && item.label === "Dashboard");
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={(event) => {
                  if (item.action) {
                    event.preventDefault();
                    item.action();
                  }
                }}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {authClient.frontendConfigured && authClient.isSignedIn ? (
            authClient.accountControl
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="hidden h-10 px-4 sm:inline-flex"
              onClick={authClient.frontendConfigured ? authClient.signIn : undefined}
              disabled={!authClient.frontendConfigured || !authClient.isLoaded}
            >
              <LogIn size={16} />
              Sign in
            </Button>
          )}
          <ThemeButton darkMode={darkMode} onToggleTheme={onToggleTheme} showLabel />
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6 lg:hidden">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            onClick={(event) => {
              if (item.action) {
                event.preventDefault();
                item.action();
              }
            }}
            className="whitespace-nowrap rounded-lg border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
          >
            {item.label}
          </a>
        ))}
      </div>
    </header>
  );
}

function LandingPage({ darkMode, onToggleTheme, onOpenApp, authClient }: LandingPageProps) {
  const useCases = [
    {
      title: "Restaurant discovery",
      body: "Find nearby options, confirm happy hour, ask dietary questions, and compare confirmed answers.",
      icon: MapPin
    },
    {
      title: "Direct call lists",
      body: "Call provided phone numbers, ask a custom question, and track every response in one structured view.",
      icon: Users
    },
    {
      title: "Appointments",
      body: "Ask clinics, salons, or service providers about availability, constraints, and next steps.",
      icon: CalendarCheck
    },
    {
      title: "Business availability",
      body: "Check product availability, reservation rules, pet policies, event slots, or consultation windows.",
      icon: Building2
    }
  ];

  const flow = [
    ["1", "Describe the mission", "Speak or type a natural request instead of filling a rigid form."],
    ["2", "Review the plan", "Approve targets, edit questions, set call limits, and exclude numbers."],
    ["3", "Calls run transparently", "The voice agent discloses it is AI and calls only approved targets."],
    ["4", "Compare outcomes", "Review answers, transcripts, confidence, and recommendations."]
  ];

  const platform = [
    { label: "Planner", value: "LLM intent extraction", icon: Bot },
    { label: "Search", value: "Google Places ready", icon: Globe2 },
    { label: "Calling", value: "Twilio webhooks", icon: PhoneCall },
    { label: "Storage", value: "Postgres schema", icon: Database },
    { label: "Workers", value: "LiveKit or Pipecat path", icon: Server },
    { label: "Safety", value: "Approval and disclosure logs", icon: LockKeyhole }
  ];

  return (
    <main className="min-h-screen text-ink dark:text-slate-100">
      <ProductHeader
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        onOpenApp={onOpenApp}
        authClient={authClient}
        current="landing"
      />

      <section className="relative isolate min-h-[78svh] overflow-hidden border-b border-slate-200/70 dark:border-slate-800/80">
        <img
          src={DEMO_SCREENSHOT_URL}
          alt="Voice Concierge dashboard showing structured call results"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-top opacity-[0.12] dark:opacity-10 sm:opacity-55 sm:dark:opacity-35"
        />
        <div className="absolute inset-0 -z-10 bg-white/90 dark:bg-slate-950/90 sm:bg-white/76 sm:dark:bg-slate-950/78" />
        <div className="mx-auto grid min-h-[78svh] max-w-7xl content-center gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.75fr)] lg:py-20">
          <div className="max-w-3xl">
            <Badge className="border-brand-200 bg-white/90 text-brand-700 shadow-sm dark:border-brand-900/50 dark:bg-slate-950/80 dark:text-brand-300">
              <Sparkles size={12} />
              Human-approved outbound AI calls
            </Badge>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
              Voice Concierge Agent
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300 sm:text-lg sm:leading-8">
              Turn a plain-language request into researched call targets, approved AI phone calls, transcripts,
              extracted answers, and a decision-ready summary.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button type="button" className="px-5" onClick={onOpenApp}>
                <Mic2 size={16} />
                Start a request
              </Button>
              <a
                href="#how-it-works"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600"
              >
                <Workflow size={16} />
                See workflow
              </a>
            </div>
          </div>

          <div className="self-end rounded-2xl border border-slate-200/80 bg-white/92 p-4 shadow-lifted backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/88">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Example mission
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-slate-950 dark:text-white">
                  Find dinner options and call to verify vegan meals.
                </p>
              </div>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                Live flow
              </Badge>
            </div>
            <div className="mt-4 grid gap-2">
              {["Search nearby candidates", "Ask approved questions", "Extract answers to JSON", "Recommend best option"].map(
                (item, index) => (
                  <div
                    key={item}
                    className="grid grid-cols-[2rem_1fr] items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm text-slate-700 dark:border-slate-800/80 dark:bg-slate-950/50 dark:text-slate-300"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                      {index + 1}
                    </span>
                    <span className="font-medium">{item}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="use-cases" className="bg-white/70 py-12 dark:bg-slate-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-4 md:grid-cols-4">
            {useCases.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                    <Icon size={18} />
                  </span>
                  <h2 className="mt-4 font-display text-lg font-semibold text-slate-950 dark:text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-200/70 bg-slate-50/80 py-14 dark:border-slate-800/80 dark:bg-slate-950/65">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.75fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-700 dark:text-brand-300">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950 dark:text-white">
              A controlled workflow for real-world phone work.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400">
              The app is designed for broad natural requests: nearby restaurant research, provided call lists,
              appointment booking, store availability, and policy checks.
            </p>
          </div>
          <div className="grid gap-3">
            {flow.map(([step, title, body]) => (
              <article
                key={step}
                className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900/70 sm:grid-cols-[3rem_1fr]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
                  {step}
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="architecture" className="py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-700 dark:text-brand-300">
                Production architecture
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-slate-950 dark:text-white">
                Built for approvals, calls, evidence, and summaries.
              </h2>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {platform.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.label}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Icon size={18} />
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-950 dark:text-white">{item.label}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{item.value}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/70 bg-white/80 py-8 dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-slate-500 dark:text-slate-400 sm:px-6">
          <span>Voice Concierge Agent</span>
          <span>Disclosed AI calls, user approval, structured outcomes.</span>
        </div>
      </footer>
    </main>
  );
}

function AuthNotice({
  session,
  loading,
  authClient,
  onSignIn
}: {
  session: AuthSession | null;
  loading: boolean;
  authClient: AppAuthClient;
  onSignIn: () => void;
}) {
  if (loading || !session?.auth_required || authClient.isSignedIn) return null;

  const configured = session.auth_configured && authClient.frontendConfigured;
  return (
    <section
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-soft ${
        configured
          ? "border-brand-200 bg-brand-50/90 text-brand-900 dark:border-brand-900/60 dark:bg-brand-950/35 dark:text-brand-100"
          : "border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            configured
              ? "bg-white text-brand-700 dark:bg-slate-950 dark:text-brand-300"
              : "bg-white text-amber-700 dark:bg-slate-950 dark:text-amber-300"
          }`}
        >
          <LockKeyhole size={17} />
        </span>
        <div>
          <p className="font-semibold">
            {configured ? "Sign in to run paid tasks" : "Authentication setup is incomplete"}
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-6 opacity-80">
            {configured
              ? "The website is public, but creating tasks, viewing stored task data, and approving calls requires a signed-in session."
              : "Set CLERK_SECRET_KEY and VITE_CLERK_PUBLISHABLE_KEY in Vercel before real users test the paid flow."}
          </p>
        </div>
      </div>
      {configured ? (
        <Button type="button" onClick={onSignIn}>
          <LogIn size={16} />
          Sign in with Clerk
        </Button>
      ) : null}
    </section>
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
    if (authSession?.auth_required && !authClient.isSignedIn) {
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
        handleApiFailure(err, "Polling failed.");
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [task]);

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
    return false;
  }

  function handleApiFailure(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.status === 401) {
      authClient.signIn();
      return;
    }
    setError(err instanceof Error ? err.message : fallback);
  }

  async function handleLogout() {
    setLoading(true);
    setError(null);
    try {
      authClient.signOut();
      setTask(null);
      setStage("request");
      setHistory([]);
    } catch (err) {
      handleApiFailure(err, "Sign out failed.");
    } finally {
      setLoading(false);
    }
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
      else if (detail.calls.length) setStage("progress");
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
      <ProductHeader
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        onOpenApp={() => window.history.replaceState({}, "", "/app")}
        onGoHome={onGoHome}
        authClient={authClient}
        current="dashboard"
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
                  <div className="flex flex-wrap items-center justify-end gap-2">
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
                    {authSession?.auth_required ? (
                      authClient.isSignedIn ? (
                        <>
                          <Badge className="border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            <UserCircle size={12} />
                            {authClient.user?.name || authClient.user?.email || "Signed in"}
                          </Badge>
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-10 w-10 px-0 sm:w-auto sm:px-4"
                            aria-label="Sign out"
                            title="Sign out"
                            onClick={handleLogout}
                            disabled={loading}
                          >
                            <LogOut size={16} />
                            <span className="hidden sm:inline">Sign out</span>
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-10 px-4"
                          onClick={authClient.signIn}
                          disabled={
                            authLoading ||
                            !authSession.auth_configured ||
                            !authClient.frontendConfigured
                          }
                        >
                          <LogIn size={16} />
                          Sign in
                        </Button>
                      )
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-10 w-10 px-0 sm:w-auto sm:px-4"
                      aria-label="Open overview"
                      title="Open overview"
                      onClick={onGoHome}
                    >
                      <Globe2 size={16} />
                      <span className="hidden sm:inline">Overview</span>
                    </Button>
                    <ThemeButton darkMode={darkMode} onToggleTheme={onToggleTheme} />
                    <Button
                      type="button"
                      className="h-10 w-10 px-0 sm:w-auto sm:px-4"
                      aria-label="Start a new task"
                      title="Start a new task"
                      onClick={startNewTask}
                    >
                      <Plus size={16} />
                      <span className="hidden sm:inline">New task</span>
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

                <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200/70 bg-panel-gradient dark:border-slate-800/80 dark:bg-panel-gradient-dark sm:grid-cols-4">
                  {taskStats.map((stat, index) => (
                    <div
                      key={stat.label}
                      className={`border-slate-200/70 px-3 py-2.5 dark:border-slate-800/70 ${
                        index % 2 === 0 ? "border-r sm:border-r" : ""
                      } ${index < 2 ? "border-b sm:border-b-0" : ""} ${
                        index < taskStats.length - 1 ? "sm:border-r" : ""
                      }`}
                    >
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
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

            <AuthNotice
              session={authSession}
              loading={authLoading}
              authClient={authClient}
              onSignIn={authClient.signIn}
            />

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
