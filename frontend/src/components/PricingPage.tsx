import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Github,
  Moon,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Sun,
  Zap
} from "lucide-react";

import type { AppAuthClient } from "../App";
import { Badge, Button } from "./ui";

type PricingPageProps = {
  darkMode: boolean;
  onToggleTheme: () => void;
  onGoHome: () => void;
  onOpenApp: () => void;
  authClient: AppAuthClient;
  githubUrl: string;
};

const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "for evaluation",
    description: "One concierge request for testing the approval, call, and result workflow.",
    cta: "Start free",
    highlighted: false,
    features: [
      "1 lifetime request per signed-in user",
      "Up to 5 approved call targets",
      "Task history and deletion",
      "Best for personal testing"
    ]
  },
  {
    name: "Personal",
    price: "$19",
    cadence: "per month",
    description: "For users who want the agent for regular errands and local discovery.",
    cta: "Upgrade path",
    highlighted: true,
    features: [
      "20 concierge requests per month",
      "Up to 5 calls per request",
      "Transcript and structured summary",
      "$1 per extra request"
    ]
  },
  {
    name: "Pro",
    price: "$49",
    cadence: "per month",
    description: "For frequent users and small teams that need better voice quality and scale.",
    cta: "Talk to admin",
    highlighted: false,
    features: [
      "75 concierge requests per month",
      "LiveKit realtime voice-agent runtime",
      "Priority request processing",
      "Team and retention controls planned"
    ]
  }
];

export function PricingPage({
  darkMode,
  onToggleTheme,
  onGoHome,
  onOpenApp,
  authClient,
  githubUrl
}: PricingPageProps) {
  return (
    <main className="min-h-screen text-ink dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={onGoHome} className="flex items-center gap-2 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-soft">
              <PhoneCall size={15} />
            </span>
            <span>
              <span className="block font-display text-sm font-semibold text-slate-950 dark:text-white">
                Voice Concierge
              </span>
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Pricing and quota
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
            >
              <Github size={14} />
              GitHub
            </a>
            <button
              type="button"
              aria-label={darkMode ? "Use light mode" : "Use dark mode"}
              title={darkMode ? "Use light mode" : "Use dark mode"}
              onClick={onToggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <Button type="button" className="h-9 px-3" onClick={onOpenApp}>
              Open app
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200/70 py-16 dark:border-slate-800/80 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <button
            type="button"
            onClick={onGoHome}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-700 dark:text-slate-300 dark:hover:text-brand-300"
          >
            <ArrowLeft size={15} />
            Back to product
          </button>
          <div className="max-w-3xl">
            <Badge className="border-brand-200 bg-white/90 text-brand-700 shadow-sm dark:border-brand-900/50 dark:bg-slate-950/80 dark:text-brand-300">
              <Sparkles size={12} />
              Usage-based AI calls
            </Badge>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              One free request, then paid usage for real calls.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
              The free tier is capped because every task can spend money on telephony, realtime
              audio, LLM planning, search, extraction, and summaries. Admin accounts are unlimited
              through environment configuration.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200/70 bg-white/70 py-14 dark:border-slate-800/80 dark:bg-slate-950/40">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative grid content-start gap-6 rounded-2xl border p-6 shadow-soft ${
                plan.highlighted
                  ? "border-brand-300 bg-white ring-2 ring-brand-200/60 dark:border-brand-500/60 dark:bg-slate-900 dark:ring-brand-500/20"
                  : "border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-900/70"
              }`}
            >
              {plan.highlighted ? (
                <Badge className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Recommended
                </Badge>
              ) : null}
              <div>
                <h2 className="font-display text-xl font-semibold text-slate-950 dark:text-white">
                  {plan.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {plan.description}
                </p>
              </div>
              <div>
                <span className="font-display text-4xl font-semibold text-slate-950 dark:text-white">
                  {plan.price}
                </span>
                <span className="ml-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {plan.cadence}
                </span>
              </div>
              <Button type="button" variant={plan.highlighted ? "primary" : "secondary"} onClick={onOpenApp}>
                {plan.cta}
                <ArrowRight size={15} />
              </Button>
              <ul className="grid gap-3 text-sm text-slate-700 dark:text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-b border-slate-200/70 py-14 dark:border-slate-800/80">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
              Pricing assumptions
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Designed around real request costs.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
              A typical task calls 3 to 5 numbers for 60 to 120 seconds each. The product price
              needs to cover carrier minutes, LiveKit agent/session minutes, realtime model audio
              tokens, planning and extraction tokens, Places lookups, failed calls, retries, and
              support.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Estimated internal cost", "$0.25-$0.60 typical request"],
              ["Heavy 5-call request", "$0.60-$1.20 before support"],
              ["Free quota", "1 request per signed-in user"],
              ["Admin override", "Unlimited by env allowlist"]
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-900/70"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {label}
                </p>
                <p className="mt-2 font-display text-xl font-semibold text-slate-950 dark:text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-3">
          <article className="surface-strong p-6 lg:col-span-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
              <Zap size={13} />
              Production voice runtime
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              LiveKit Agents is the preferred production path.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Twilio webhooks remain useful for the current MVP and fallback. For more natural
              conversations, LiveKit gives the app a realtime room model, SIP telephony bridge,
              explicit agent dispatch, observability, and a clean path to OpenAI Realtime
              speech-to-speech sessions.
            </p>
          </article>
          <article className="surface-strong p-6">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              <ShieldCheck size={13} />
              Safety gate
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Paid access does not remove approval, AI disclosure, call caps, or deletion. Those
              controls stay on for every plan.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
