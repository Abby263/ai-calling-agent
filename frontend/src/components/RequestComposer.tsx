import {
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  LocateFixed,
  MapPin,
  Mic,
  PhoneCall,
  PhoneOutgoing,
  Route,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Stethoscope,
  Utensils,
  Users
} from "lucide-react";
import { useState } from "react";

import { getBrowserLocation } from "../lib/location";
import { useSpeechInput } from "../lib/speech";
import type { LocationInput, SearchFilters } from "../types/domain";
import { Badge, Button, Field, Input, Select, Textarea } from "./ui";

const EXAMPLES = [
  {
    label: "Dinner RSVP",
    detail: "Invite friends and track who says yes",
    icon: Users,
    accent: "from-rose-500/15 to-orange-500/10 text-rose-600 dark:text-rose-300",
    text: "Call +1 416 555 0101, +1 416 555 0102, and +1 416 555 0103. Invite them for dinner tonight and track who says yes."
  },
  {
    label: "Doctor appointment",
    detail: "Find a clinic with same-day availability",
    icon: Stethoscope,
    accent: "from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:text-emerald-300",
    text: "Book an appointment with a doctor from Apple Tree at Harbour Street near me."
  },
  {
    label: "Restaurant research",
    detail: "Compare happy hours and dietary options",
    icon: Utensils,
    accent: "from-amber-500/15 to-orange-500/10 text-amber-700 dark:text-amber-300",
    text: "Find happy hours near me and ask if they have vegan food."
  },
  {
    label: "Project check-in",
    detail: "Coordinate availability across a team",
    icon: ClipboardCheck,
    accent: "from-sky-500/15 to-indigo-500/10 text-sky-600 dark:text-sky-300",
    text: "Call these numbers and ask who is available for a project check-in tomorrow morning."
  }
];

const ROUTE_STEPS = [
  ["01", "Parse request", "Pull intent, contacts, and places"],
  ["02", "Review queue", "Choose targets and approve questions"],
  ["03", "Run calls", "Live status, transcript, extraction"],
  ["04", "Compare results", "Recommendation with evidence"]
];

export function RequestComposer({
  requestText,
  setRequestText,
  filters,
  setFilters,
  location,
  setLocation,
  onPreview,
  loading,
  error
}: {
  requestText: string;
  setRequestText: (value: string) => void;
  filters: SearchFilters;
  setFilters: (value: SearchFilters) => void;
  location: LocationInput;
  setLocation: (value: LocationInput) => void;
  onPreview: () => void;
  loading: boolean;
  error?: string | null;
}) {
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showNearbyOptions, setShowNearbyOptions] = useState(false);
  const speech = useSpeechInput((text) => setRequestText(text));
  const charCount = requestText.trim().length;

  async function captureLocation() {
    setLocationError(null);
    try {
      setLocation(await getBrowserLocation());
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Location lookup failed.");
    }
  }

  function updateFilter<Key extends keyof SearchFilters>(key: Key, value: SearchFilters[Key]) {
    setFilters({ ...filters, [key]: value });
  }

  return (
    <section className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="surface-strong relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brand-gradient opacity-10 blur-3xl"
          />
          <div className="relative flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
                <Sparkles size={11} />
                New concierge task
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[1.7rem]">
                What should the agent call, ask, or book?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                Write the request naturally. The agent separates direct phone lists from nearby searches and prepares a review queue before any call is placed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300">
                <PhoneCall size={12} />
                Calls
              </Badge>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                <ShieldCheck size={12} />
                Approval gated
              </Badge>
            </div>
          </div>

          <div className="relative grid gap-4 px-6 pb-6 pt-5">
            <div className="relative">
              <Textarea
                value={requestText}
                onChange={(event) => setRequestText(event.target.value)}
                rows={8}
                placeholder={EXAMPLES[0].text}
                className="min-h-48 bg-slate-50/70 text-base leading-7 dark:bg-slate-950/60"
              />
              <div className="pointer-events-none absolute bottom-3 right-4 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {charCount} characters
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={speech.listening ? "danger" : "secondary"}
                  onClick={speech.toggle}
                  disabled={!speech.supported}
                  title={speech.supported ? "Use voice input" : "Voice input is not supported in this browser"}
                >
                  {speech.listening ? (
                    <>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-rose-500 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                      </span>
                      <Square size={14} />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic size={15} />
                      Speak
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowNearbyOptions(!showNearbyOptions)}
                >
                  <SlidersHorizontal size={15} />
                  Nearby options
                  {showNearbyOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>
                {location.label ? (
                  <Badge className="border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    <MapPin size={11} />
                    {location.label}
                  </Badge>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={onPreview}
                disabled={loading || charCount < 4}
                className="px-5"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Preparing
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    Build approval queue
                  </>
                )}
              </Button>
            </div>
            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-lifted">
            <div
              aria-hidden
              className="absolute inset-0 opacity-80"
              style={{
                background:
                  "radial-gradient(60% 80% at 0% 0%, rgba(99,102,241,0.45) 0%, transparent 50%), radial-gradient(50% 60% at 100% 100%, rgba(6,182,212,0.32) 0%, transparent 60%)"
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                <Route size={13} />
                Task route
              </div>
              <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
                How the agent works
              </h3>
              <div className="mt-5 grid gap-3.5">
                {ROUTE_STEPS.map(([step, title, detail]) => (
                  <div key={step} className="grid grid-cols-[2.25rem_1fr] gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-xs font-bold text-cyan-200">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="surface-strong p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                <PhoneOutgoing size={15} />
              </span>
              <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
                Outbound policy
              </h2>
            </div>
            <ul className="mt-4 grid gap-2.5 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                AI caller disclosure on every call
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                User-approved targets only
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                No sensitive data collection
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="surface-strong p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
              Common concierge requests
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Tap a template to prefill the request — edit freely.
            </p>
          </div>
          <Badge className="border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <CalendarPlus size={12} />
            Voice or text
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {EXAMPLES.map((example) => {
            const Icon = example.icon;
            return (
              <button
                key={example.label}
                type="button"
                onClick={() => setRequestText(example.text)}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-brand-700"
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition group-hover:opacity-100 ${example.accent}`}
                />
                <div className="relative">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition group-hover:border-transparent group-hover:bg-brand-gradient group-hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
                  >
                    <Icon size={17} />
                  </span>
                  <p className="mt-3 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {example.label}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {example.detail}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showNearbyOptions ? (
        <div className="surface-strong animate-fade-in p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
                Nearby business search
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Used only when the request needs location-based discovery.
              </p>
            </div>
            <Button type="button" onClick={captureLocation} variant="secondary">
              <LocateFixed size={15} />
              Use my location
            </Button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Manual location">
              <Input
                value={location.label ?? ""}
                onChange={(event) => setLocation({ ...location, label: event.target.value || null })}
                placeholder="Toronto, ON"
              />
            </Field>
            <Field label="Latitude">
              <Input
                type="number"
                value={location.lat ?? ""}
                onChange={(event) =>
                  setLocation({
                    ...location,
                    lat: event.target.value ? Number(event.target.value) : null
                  })
                }
                placeholder="43.6532"
              />
            </Field>
            <Field label="Longitude">
              <Input
                type="number"
                value={location.lng ?? ""}
                onChange={(event) =>
                  setLocation({
                    ...location,
                    lng: event.target.value ? Number(event.target.value) : null
                  })
                }
                placeholder="-79.3832"
              />
            </Field>
            <Field label="Radius (m)">
              <div className="grid grid-cols-[1fr_5rem] items-center gap-3">
                <input
                  type="range"
                  min={500}
                  max={10000}
                  step={500}
                  value={filters.radius_meters}
                  onChange={(event) => updateFilter("radius_meters", Number(event.target.value))}
                  className="w-full accent-brand-600"
                />
                <Input
                  type="number"
                  value={filters.radius_meters}
                  onChange={(event) => updateFilter("radius_meters", Number(event.target.value))}
                />
              </div>
            </Field>
            <Field label="Cuisine or category">
              <Input
                value={filters.cuisine ?? ""}
                onChange={(event) => updateFilter("cuisine", event.target.value || null)}
                placeholder="Any"
              />
            </Field>
            <Field label="Minimum rating">
              <Input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={filters.min_rating ?? ""}
                onChange={(event) =>
                  updateFilter("min_rating", event.target.value ? Number(event.target.value) : null)
                }
              />
            </Field>
            <Field label="Max calls">
              <Input
                type="number"
                min={1}
                max={5}
                value={filters.max_calls}
                onChange={(event) => updateFilter("max_calls", Number(event.target.value))}
              />
            </Field>
            <Field label="Dietary preference">
              <Select
                value={filters.dietary_preference ?? ""}
                onChange={(event) => updateFilter("dietary_preference", event.target.value || null)}
              >
                <option value="">None</option>
                <option value="vegan">Vegan</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="gluten-free">Gluten-free</option>
                <option value="halal">Halal</option>
                <option value="kosher">Kosher</option>
              </Select>
            </Field>
            <Field label="Preferred call time">
              <Input
                value={filters.preferred_call_time ?? ""}
                onChange={(event) => updateFilter("preferred_call_time", event.target.value || null)}
                placeholder="Now, 5 PM, tomorrow morning"
              />
            </Field>
          </div>
          {locationError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {locationError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
