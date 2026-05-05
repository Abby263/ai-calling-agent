import {
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  LocateFixed,
  Mic,
  PhoneCall,
  PhoneOutgoing,
  Route,
  Send,
  ShieldCheck,
  SlidersHorizontal,
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
    icon: Users,
    text: "Call +1 416 555 0101, +1 416 555 0102, and +1 416 555 0103. Invite them for dinner tonight and track who says yes."
  },
  {
    label: "Doctor appointment",
    icon: Stethoscope,
    text: "Book an appointment with a doctor from Apple Tree at Harbour Street near me."
  },
  {
    label: "Restaurant research",
    icon: Utensils,
    text: "Find happy hours near me and ask if they have vegan food."
  },
  {
    label: "Project check-in",
    icon: ClipboardCheck,
    text: "Call these numbers and ask who is available for a project check-in tomorrow morning."
  }
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
    <section className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">New concierge task</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                What should the agent handle?
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-sky-200 bg-sky-50 text-sky-700">
                <PhoneCall size={13} />
                Calls
              </Badge>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                <ShieldCheck size={13} />
                Approval
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 p-5">
            <Textarea
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
              rows={8}
              placeholder={EXAMPLES[0].text}
              className="min-h-48 bg-slate-50 text-base leading-7"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={speech.listening ? "danger" : "secondary"}
                  onClick={speech.toggle}
                  disabled={!speech.supported}
                  title={speech.supported ? "Use voice input" : "Voice input is not supported in this browser"}
                >
                  {speech.listening ? <Square size={16} /> : <Mic size={16} />}
                  {speech.listening ? "Stop" : "Speak"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowNearbyOptions(!showNearbyOptions)}>
                  <SlidersHorizontal size={16} />
                  Nearby options
                  {showNearbyOptions ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </Button>
              </div>
              <Button type="button" onClick={onPreview} disabled={loading || requestText.trim().length < 4}>
                <Send size={16} />
                {loading ? "Preparing" : "Build approval queue"}
              </Button>
            </div>
            {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-md border border-slate-800 bg-slate-950 p-5 text-white shadow-soft">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
              <Route size={16} />
              Task route
            </div>
            <div className="mt-5 grid gap-4">
              {[
                ["01", "Parse request", "intent, contacts, places"],
                ["02", "Review queue", "targets and questions"],
                ["03", "Run calls", "status, transcript, extraction"],
                ["04", "Compare results", "recommendation and evidence"]
              ].map(([step, title, detail]) => (
                <div key={step} className="grid grid-cols-[2.25rem_1fr] gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-white/10 text-xs font-semibold text-cyan-100">
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-slate-400">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-line bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <PhoneOutgoing size={17} className="text-brand" />
              <h2 className="font-semibold text-slate-950">Outbound policy</h2>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                AI caller disclosure
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                User-approved targets only
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                No sensitive data collection
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950">Fast starters</h2>
          <Badge className="border-slate-200 bg-slate-100 text-slate-600">
            <CalendarPlus size={13} />
            Voice or text
          </Badge>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {EXAMPLES.map((example) => {
            const Icon = example.icon;
            return (
              <button
                key={example.label}
                type="button"
                onClick={() => setRequestText(example.text)}
                className="grid min-h-24 gap-2 rounded-md border border-line bg-panel p-3 text-left transition hover:border-brand hover:bg-blue-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-brand shadow-sm">
                  <Icon size={16} />
                </span>
                <span className="text-sm font-semibold text-slate-900">{example.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showNearbyOptions ? (
        <div className="grid gap-4 rounded-md border border-line bg-white p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Nearby business search</h2>
              <p className="text-sm text-slate-500">Used only when the request needs location-based discovery.</p>
            </div>
            <Button type="button" onClick={captureLocation} variant="secondary">
              <LocateFixed size={16} />
              Use my location
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            <Field label="Radius">
              <div className="grid grid-cols-[1fr_5rem] gap-3">
                <input
                  type="range"
                  min={500}
                  max={10000}
                  step={500}
                  value={filters.radius_meters}
                  onChange={(event) => updateFilter("radius_meters", Number(event.target.value))}
                  className="w-full accent-brand"
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
          {locationError ? <p className="text-sm text-rose-700">{locationError}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
