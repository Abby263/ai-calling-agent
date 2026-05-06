import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock4,
  FileSearch,
  FileText,
  Github,
  Headphones,
  ListChecks,
  LogIn,
  MapPin,
  Menu,
  Mic2,
  Minus,
  Moon,
  PhoneCall,
  Plus,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  Users,
  Workflow,
  X
} from "lucide-react";

import type { AppAuthClient } from "../App";
import { Badge, Button } from "./ui";

type LandingPageProps = {
  onOpenApp: () => void;
  onOpenPricing: () => void;
  authClient: AppAuthClient;
  darkMode: boolean;
  onToggleTheme: () => void;
  githubUrl: string;
};

export function LandingPage({
  onOpenApp,
  onOpenPricing,
  authClient,
  darkMode,
  onToggleTheme,
  githubUrl
}: LandingPageProps) {
  return (
    <main className="min-h-screen text-ink dark:text-slate-100">
      <SiteHeader
        onOpenApp={onOpenApp}
        onOpenPricing={onOpenPricing}
        authClient={authClient}
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        githubUrl={githubUrl}
      />
      <Hero
        onOpenApp={onOpenApp}
        onOpenPricing={onOpenPricing}
        authClient={authClient}
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        githubUrl={githubUrl}
      />
      <SocialProofStrip />
      <ProductPreview onOpenApp={onOpenApp} />
      <FeatureGrid />
      <UseCases />
      <HowItWorks />
      <Trust />
      <Faq />
      <ClosingCta
        onOpenApp={onOpenApp}
        onOpenPricing={onOpenPricing}
        authClient={authClient}
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        githubUrl={githubUrl}
      />
      <SiteFooter />
    </main>
  );
}

function SiteHeader({ onOpenApp, onOpenPricing, authClient, darkMode, onToggleTheme, githubUrl }: LandingPageProps) {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Use cases", href: "#use-cases" },
    { label: "Pricing", href: "/pricing" },
    { label: "FAQ", href: "#faq" }
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a href="#top" className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-soft">
            <PhoneCall size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-semibold text-slate-950 dark:text-white">
              Voice Concierge
            </span>
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              AI calling agent
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 text-sm font-semibold lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => {
                if (link.href === "/pricing") {
                  event.preventDefault();
                  onOpenPricing();
                }
              }}
              className="rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 xl:inline-flex"
          >
            <Github size={16} />
            GitHub
          </a>
          <button
            type="button"
            aria-label={darkMode ? "Use light mode" : "Use dark mode"}
            title={darkMode ? "Use light mode" : "Use dark mode"}
            onClick={onToggleTheme}
            className="hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 sm:inline-flex"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {authClient.frontendConfigured && authClient.isSignedIn ? (
            <>
              {authClient.accountControl}
              <Button type="button" className="hidden h-10 px-4 sm:inline-flex" onClick={onOpenApp}>
                Open dashboard
                <ArrowRight size={14} />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                className="hidden h-10 px-4 sm:inline-flex"
                onClick={authClient.frontendConfigured ? authClient.signIn : undefined}
                disabled={!authClient.frontendConfigured || !authClient.isLoaded}
              >
                <LogIn size={15} />
                Sign in
              </Button>
              <Button type="button" className="hidden h-10 px-4 sm:inline-flex" onClick={onOpenApp}>
                Try free
                <ArrowRight size={14} />
              </Button>
            </>
          )}

          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-200/70 bg-white/95 lg:hidden dark:border-slate-800/80 dark:bg-slate-950/95">
          <div className="mx-auto grid max-w-7xl gap-2 px-4 py-3 sm:px-6">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(event) => {
                  if (link.href === "/pricing") {
                    event.preventDefault();
                    onOpenPricing();
                  }
                  setOpen(false);
                }}
                className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
              >
                {link.label}
              </a>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (authClient.frontendConfigured) authClient.signIn();
                  setOpen(false);
                }}
              >
                <LogIn size={15} />
                Sign in
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenApp();
                }}
              >
                Try free
                <ArrowRight size={14} />
              </Button>
            </div>
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Github size={15} />
              GitHub repo
            </a>
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              {darkMode ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Hero({ onOpenApp, onOpenPricing, authClient }: LandingPageProps) {
  return (
    <section className="relative isolate overflow-hidden border-b border-slate-200/70 dark:border-slate-800/80">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 18% 0%, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0) 60%), radial-gradient(45% 40% at 100% 30%, rgba(6,182,212,0.18) 0%, rgba(6,182,212,0) 65%), radial-gradient(35% 30% at 50% 100%, rgba(139,92,246,0.14) 0%, rgba(139,92,246,0) 60%)"
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:py-28">
        <div className="max-w-2xl">
          <Badge className="border-brand-200 bg-white/90 text-brand-700 shadow-sm dark:border-brand-900/50 dark:bg-slate-950/80 dark:text-brand-300">
            <Sparkles size={12} />
            AI calling agent · v0.1
          </Badge>
          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-[3.5rem]">
            Let an AI agent make
            <br className="hidden sm:block" /> the <span className="text-gradient">phone calls</span> you
            don&rsquo;t want to.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-700 dark:text-slate-300 sm:text-lg sm:leading-8">
            Voice Concierge turns one sentence into a queue of approved outbound calls,
            disclosed AI conversations, transcripts, and a clean comparison so you can decide
            in seconds.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button type="button" className="px-5" onClick={onOpenApp}>
              <Mic2 size={16} />
              Try it free
              <ArrowRight size={16} />
            </Button>
            <a
              href="#how-it-works"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600"
            >
              <Workflow size={16} />
              See how it works
            </a>
            <button
              type="button"
              onClick={onOpenPricing}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600"
            >
              Pricing
              <ArrowRight size={16} />
            </button>
            {authClient.frontendConfigured && !authClient.isSignedIn ? (
              <button
                type="button"
                onClick={authClient.signIn}
                className="inline-flex min-h-10 items-center gap-1.5 px-2 text-sm font-semibold text-slate-700 hover:text-brand-700 dark:text-slate-200 dark:hover:text-brand-300"
              >
                <LogIn size={15} />
                Sign in
              </button>
            ) : null}
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-slate-200/80 pt-6 dark:border-slate-800/70">
            <HeroStat value="< 30s" label="From request to approval queue" />
            <HeroStat value="100%" label="Calls open with AI disclosure" />
            <HeroStat value="JSON" label="Structured outcomes per call" />
          </dl>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-xl font-semibold text-slate-950 dark:text-white">{value}</dt>
      <dd className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{label}</dd>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-3xl bg-brand-gradient opacity-20 blur-3xl"
      />
      <div className="surface-strong relative overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200/70 px-5 py-3 dark:border-slate-800/70">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
            voiceconcierge.app/app
          </span>
        </div>
        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            Live concierge run
          </p>
          <p className="mt-1.5 font-display text-base font-semibold text-slate-950 dark:text-white">
            &ldquo;Call these three numbers and invite them to dinner tonight.&rdquo;
          </p>
          <div className="mt-4 grid gap-2.5">
            {[
              { name: "Priya R.", phone: "+1 416 555 0101", status: "Accepted", tone: "emerald" },
              { name: "Marcus T.", phone: "+1 416 555 0102", status: "Declined", tone: "rose" },
              { name: "Ana K.", phone: "+1 416 555 0103", status: "No answer", tone: "slate" }
            ].map((row) => (
              <div
                key={row.name}
                className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-3 dark:border-slate-800/70 dark:bg-slate-950/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                  <PhoneCall size={15} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{row.phone}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass(row.tone)}`}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[
              ["Approved", "3"],
              ["Completed", "2"],
              ["Confidence", "94%"]
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 text-center dark:border-slate-800/70 dark:bg-slate-950/40"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {label}
                </p>
                <p className="mt-1 font-display text-base font-semibold text-slate-950 dark:text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function toneClass(tone: string): string {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "rose":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300";
  }
}

function SocialProofStrip() {
  const items = [
    { icon: ShieldCheck, label: "Disclosure on every call" },
    { icon: ClipboardCheck, label: "Approval before dialing" },
    { icon: ScrollText, label: "Transcripts you can audit" },
    { icon: BarChart3, label: "Structured JSON outcomes" }
  ];
  return (
    <section className="border-b border-slate-200/70 bg-white/80 py-6 dark:border-slate-800/80 dark:bg-slate-950/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Built for trust
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {items.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              <Icon size={15} className="text-brand-600 dark:text-brand-400" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductPreview({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <section className="border-b border-slate-200/70 bg-slate-50/60 py-20 dark:border-slate-800/80 dark:bg-slate-950/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
              The product
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              One workspace, four clear stages.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400">
              Every concierge run moves through the same predictable flow &mdash; you stay in
              control at every step, and nothing dials out without your approval.
            </p>
            <div className="mt-6 grid gap-3">
              {[
                {
                  title: "Intake",
                  detail: "Plain-language request, voice or text",
                  icon: ListChecks
                },
                {
                  title: "Approve",
                  detail: "Review who gets called and what gets asked",
                  icon: ClipboardCheck
                },
                {
                  title: "Calls",
                  detail: "Live status, transcript, structured extraction",
                  icon: PhoneCall
                },
                {
                  title: "Results",
                  detail: "A side-by-side comparison and a recommendation",
                  icon: CheckCircle2
                }
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="grid grid-cols-[2.5rem_1fr] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                      <Icon size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {String(index + 1).padStart(2, "0")} &middot; {item.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-7">
              <Button type="button" onClick={onOpenApp}>
                Open the dashboard
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>

          <DashboardMock />
        </div>
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-2 -z-10 rounded-3xl bg-brand-gradient opacity-15 blur-2xl"
      />
      <div className="surface-strong overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3 dark:border-slate-800/70">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-white">
              <PhoneCall size={14} />
            </span>
            Voice Concierge Console
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            Live
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 p-4">
          {[
            { label: "Intake", state: "done" },
            { label: "Approve", state: "done" },
            { label: "Calls", state: "active" },
            { label: "Results", state: "pending" }
          ].map((step, index) => (
            <div
              key={step.label}
              className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${
                step.state === "active"
                  ? "border-transparent bg-brand-gradient text-white shadow-soft"
                  : step.state === "done"
                    ? "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-100"
                    : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400"
              }`}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] opacity-80">
                Step {index + 1}
              </p>
              <p>{step.label}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-2.5 px-4 pb-4">
          {[
            {
              name: "Pizzeria Libretto",
              meta: "0.3 km · 4.6 ★",
              status: "Completed",
              tone: "emerald"
            },
            {
              name: "Soma Loft Kitchen",
              meta: "0.7 km · 4.4 ★",
              status: "Calling",
              tone: "amber",
              live: true
            },
            {
              name: "Greenhouse Eats",
              meta: "1.2 km · 4.5 ★",
              status: "Queued",
              tone: "slate"
            }
          ].map((row) => (
            <div
              key={row.name}
              className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <Building2 size={15} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{row.meta}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass(
                  row.tone
                )}`}
              >
                {row.live ? (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-current opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                  </span>
                ) : null}
                {row.status}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200/70 bg-slate-50/70 px-4 py-3 text-xs text-slate-600 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-slate-100">Recommendation:</span>{" "}
          Pizzeria Libretto &mdash; vegan options confirmed, table available 7pm.
        </div>
      </div>
    </div>
  );
}

function FeatureGrid() {
  const features = [
    {
      title: "Plain-language requests",
      body: "Type or dictate the goal. The agent extracts contacts, places, and the question to ask.",
      icon: Mic2
    },
    {
      title: "Approval gate",
      body: "Review who gets called, edit the script, and cap the run before any number is dialed.",
      icon: ClipboardCheck
    },
    {
      title: "Disclosed AI calls",
      body: "Every call opens with an AI disclosure and a no-sales statement. Compliance baked in.",
      icon: ShieldCheck
    },
    {
      title: "Live transcripts",
      body: "Stream the conversation as it happens. Drill into any call to read the verbatim exchange.",
      icon: ScrollText
    },
    {
      title: "Structured extraction",
      body: "Each call returns clean JSON: outcome, follow-up status, and confidence score.",
      icon: FileSearch
    },
    {
      title: "Decision-ready summary",
      body: "Side-by-side table plus a one-line recommendation so you can act in seconds.",
      icon: BarChart3
    }
  ];
  return (
    <section id="features" className="border-b border-slate-200/70 bg-white/80 py-20 dark:border-slate-800/80 dark:bg-slate-950/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
            Features
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            The whole call workflow, in one place.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400">
            From the moment you describe the task to the final comparison, every stage is
            inspectable, controllable, and auditable.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="surface-strong p-6 transition hover:-translate-y-0.5 hover:shadow-lifted"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-soft">
                  <Icon size={18} />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {feature.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = [
    {
      title: "RSVPs and invites",
      body: "Send invites to a list of numbers and get a tally of yes / no / maybe.",
      icon: Users,
      tag: "Personal"
    },
    {
      title: "Find an appointment",
      body: "Ask clinics or salons about same-day availability and booking requirements.",
      icon: Stethoscope,
      tag: "Healthcare"
    },
    {
      title: "Compare local options",
      body: "Verify happy hour, dietary options, or pet policies at nearby venues.",
      icon: MapPin,
      tag: "Discovery"
    },
    {
      title: "Confirm availability",
      body: "Check stock, reservation rules, or service slots without manual phone tag.",
      icon: CalendarCheck,
      tag: "Errands"
    }
  ];
  return (
    <section id="use-cases" className="border-b border-slate-200/70 bg-slate-50/60 py-20 dark:border-slate-800/80 dark:bg-slate-950/55">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
            Use cases
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Calls people would rather not make manually.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400">
            Voice Concierge fits anywhere a list of phone calls produces a list of facts.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cases.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="surface-strong p-6 transition hover:-translate-y-0.5 hover:shadow-lifted"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                    <Icon size={18} />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {item.tag}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {item.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Describe the goal",
      body: "Type or speak the request. The agent extracts intent, contacts, and constraints.",
      icon: Mic2,
      example: "“Call these three numbers and invite them to dinner tonight.”"
    },
    {
      title: "Approve the queue",
      body: "Pick which numbers to dial, edit the questions, and cap the run.",
      icon: ClipboardCheck,
      example: "Selected 3 of 5 · 2 questions approved"
    },
    {
      title: "Calls run live",
      body: "Each call opens with disclosure. You see streaming status and transcript.",
      icon: PhoneCall,
      example: "2 in progress · 1 completed · 0 failed"
    },
    {
      title: "Decide in seconds",
      body: "A clean comparison table plus a one-line recommendation, ready to share.",
      icon: BarChart3,
      example: "Best option: Pizzeria Libretto — vegan confirmed, 7pm available"
    }
  ];
  return (
    <section id="how-it-works" className="border-b border-slate-200/70 bg-white/80 py-20 dark:border-slate-800/80 dark:bg-slate-950/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            From sentence to recommendation in four steps.
          </h2>
        </div>

        <ol className="mt-12 grid gap-6 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative">
                <div className="surface-strong h-full p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-soft">
                      <Icon size={18} />
                    </span>
                    <span className="font-display text-2xl font-semibold text-slate-300 dark:text-slate-600">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{step.body}</p>
                  <p className="mt-4 rounded-lg border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800/70 dark:bg-slate-950/40 dark:text-slate-300">
                    {step.example}
                  </p>
                </div>
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute right-[-1rem] top-12 hidden text-slate-300 dark:text-slate-700 lg:block"
                  >
                    <ArrowRight size={20} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Trust() {
  const pillars = [
    {
      icon: ShieldCheck,
      title: "Disclosed by default",
      body: "Every outbound call opens with an AI disclosure and an explicit no-sales statement."
    },
    {
      icon: ClipboardCheck,
      title: "You stay in control",
      body: "No call is dialed without your approval. Cap the run, edit the script, cancel any time."
    },
    {
      icon: FileText,
      title: "Auditable transcripts",
      body: "Read the verbatim exchange and structured extraction for every call you run."
    },
    {
      icon: Headphones,
      title: "Built for people",
      body: "Designed for personal errands, not mass outreach. No autodialer, no robocalls."
    }
  ];
  return (
    <section id="trust" className="border-b border-slate-200/70 bg-slate-950 py-20 text-slate-100 dark:border-slate-800/80">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0"
        style={{
          background:
            "radial-gradient(50% 80% at 50% 0%, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0) 60%)"
        }}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-300">
            Trust &amp; safety
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            A calling agent your callees won&rsquo;t mind.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Voice Concierge is built on a simple principle: people deserve to know they&rsquo;re
            talking to an AI, and you deserve to see exactly what was said.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-brand-300">
                  <Icon size={18} />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{pillar.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "Who is this for?",
    a: "Anyone who has a small list of phone calls to make and would rather not make them: dinner invites, doctor availability, comparing happy hours, checking stock. It’s a personal concierge, not an outbound sales tool."
  },
  {
    q: "Does the AI tell people it’s an AI?",
    a: "Yes. Every call opens with a clear disclosure that an AI assistant is calling on your behalf, plus a no-sales statement. We don’t support undisclosed calls."
  },
  {
    q: "Can I see what was said?",
    a: "Every approved call produces a transcript and a structured JSON extraction (outcome, follow-up, confidence). You can read, export, or share them."
  },
  {
    q: "How does approval work?",
    a: "After you describe the task, the agent shows the parsed contacts, the question it plans to ask, and a cap on how many calls it will run. Nothing dials out until you approve."
  },
  {
    q: "Is there a free tier?",
    a: "Yes. A signed-in user gets one concierge request for evaluation. More requests require a paid plan because live calls can spend money on carrier minutes, realtime voice, search, and LLM extraction."
  },
  {
    q: "Why use LiveKit for production voice?",
    a: "LiveKit Agents gives the product a realtime room model, SIP telephony bridge, explicit agent dispatch, and observability. Twilio webhooks remain a useful fallback, but LiveKit is the better path for natural multi-turn speech-to-speech calls."
  },
  {
    q: "Where is my data stored?",
    a: "Tasks, transcripts, and extractions are stored in your own Postgres (Neon by default). You own the data and can delete any task with one click."
  }
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-b border-slate-200/70 bg-white/80 py-20 dark:border-slate-800/80 dark:bg-slate-950/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
        <div className="max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
            FAQ
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Questions, answered.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400">
            Still have something to ask? Open an issue on the project repo and we&rsquo;ll add it
            here.
          </p>
        </div>

        <div className="grid gap-3">
          {FAQS.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div
                key={faq.q}
                className="surface-strong overflow-hidden"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    {faq.q}
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition dark:border-slate-700 dark:text-slate-400">
                    {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                  </span>
                </button>
                {isOpen ? (
                  <div className="border-t border-slate-200/70 px-5 py-4 text-sm leading-6 text-slate-600 dark:border-slate-800/70 dark:text-slate-300">
                    {faq.a}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ClosingCta({ onOpenApp, onOpenPricing, authClient }: LandingPageProps) {
  return (
    <section className="border-b border-slate-200/70 dark:border-slate-800/80">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-10 text-white shadow-lifted sm:p-14">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-90"
            style={{
              background:
                "radial-gradient(60% 80% at 0% 0%, rgba(99,102,241,0.55) 0%, rgba(99,102,241,0) 50%), radial-gradient(50% 70% at 100% 100%, rgba(6,182,212,0.45) 0%, rgba(6,182,212,0) 60%)"
            }}
          />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:items-center">
            <div>
              <Badge className="border-white/20 bg-white/10 text-white">
                <Sparkles size={12} />
                Ready when you are
              </Badge>
              <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Stop dreading the call. Start with a sentence.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                Open the dashboard, describe the task, and let an approved AI agent handle the
                phone tag. You decide who gets called, what gets asked, and what happens next.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <Button type="button" className="px-5" onClick={onOpenApp}>
                <Mic2 size={16} />
                Try it free
                <ArrowRight size={16} />
              </Button>
              <button
                type="button"
                onClick={onOpenPricing}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                View pricing
                <ArrowRight size={15} />
              </button>
              {authClient.frontendConfigured && !authClient.isSignedIn ? (
                <button
                  type="button"
                  onClick={authClient.signIn}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-200 hover:text-white"
                >
                  <LogIn size={15} />
                  Already have an account? Sign in
                </button>
              ) : (
                <p className="text-xs text-slate-400">No credit card required to try the demo.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-white/80 py-10 dark:bg-slate-950/80">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-soft">
              <PhoneCall size={16} />
            </span>
            <span className="font-display text-base font-semibold text-slate-950 dark:text-white">
              Voice Concierge Agent
            </span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
            Disclosed AI calls, approval-gated, with structured outcomes &mdash; built for the calls
            you&rsquo;d rather skip.
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            { label: "Features", href: "#features" },
            { label: "How it works", href: "#how-it-works" },
            { label: "Use cases", href: "#use-cases" },
            { label: "Pricing", href: "/pricing" },
            { label: "FAQ", href: "#faq" }
          ]}
        />
        <FooterColumn
          title="Project"
          links={[
            { label: "GitHub", href: "https://github.com/Abby263/ai-calling-agent", icon: Github },
            { label: "Setup guide", href: "https://github.com/Abby263/ai-calling-agent/blob/main/SETUP.md" },
            { label: "License", href: "https://github.com/Abby263/ai-calling-agent/blob/main/LICENSE" }
          ]}
        />
      </div>
      <div className="mx-auto mt-8 flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 px-4 pt-6 text-xs text-slate-500 dark:border-slate-800/70 dark:text-slate-400 sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <Clock4 size={13} /> Built for transparent, human-approved AI calls
        </span>
        <span>&copy; {new Date().getFullYear()} Voice Concierge Agent</span>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links
}: {
  title: string;
  links: { label: string; href: string; icon?: typeof PhoneCall }[];
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <ul className="mt-3 grid gap-2 text-sm">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.label}>
              <a
                href={link.href}
                className="inline-flex items-center gap-2 text-slate-700 transition hover:text-brand-700 dark:text-slate-300 dark:hover:text-brand-300"
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noreferrer" : undefined}
              >
                {Icon ? <Icon size={14} /> : null}
                {link.label}
                {link.href.startsWith("http") ? (
                  <ChevronDown size={12} className="-rotate-90 opacity-70" aria-hidden />
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
