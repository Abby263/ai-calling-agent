import {
  ChevronDown,
  ChevronUp,
  LocateFixed,
  Mic,
  PhoneForwarded,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Square
} from "lucide-react";
import { useState } from "react";

import { getBrowserLocation } from "../lib/location";
import { useSpeechInput } from "../lib/speech";
import type { LocationInput, SearchFilters } from "../types/domain";
import { Button, Field, Input, Select, Textarea } from "./ui";

const EXAMPLES = [
  "Call +1 416 555 0101, +1 416 555 0102, and +1 416 555 0103. Invite them for dinner tonight and track who says yes.",
  "Book an appointment with a doctor from Apple Tree at Harbour Street near me.",
  "Find happy hours near me and ask if they have vegan food.",
  "Call these numbers and ask who is available for a project check-in tomorrow morning."
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
    <section className="grid gap-5">
      <div className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Voice concierge</p>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-ink sm:text-4xl">
                Give it a task. It figures out who to call and what to track.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                Paste phone numbers directly, ask for nearby businesses, or dictate the whole task.
                You approve every call and edit the questions before anything is placed.
              </p>
            </div>

            <div className="grid gap-3">
              <Textarea
                value={requestText}
                onChange={(event) => setRequestText(event.target.value)}
                rows={7}
                placeholder={EXAMPLES[0]}
                className="text-base leading-7"
              />
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
                <Button type="button" onClick={onPreview} disabled={loading || requestText.trim().length < 4}>
                  <Send size={16} />
                  {loading ? "Preparing" : "Review task"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowNearbyOptions(!showNearbyOptions)}>
                  <SlidersHorizontal size={16} />
                  Nearby search options
                  {showNearbyOptions ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </Button>
              </div>
              {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            </div>
          </div>

          <aside className="grid content-start gap-3 rounded-md border border-line bg-panel p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-100 text-brand">
                <PhoneForwarded size={18} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Works with general requests</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Direct phone-number lists skip business search and go straight to an approval queue.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                <ShieldCheck size={18} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Human approval gate</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  The agent discloses it is AI, avoids sales calls, and only asks approved questions.
                </p>
              </div>
            </div>
          </aside>
        </div>

        <div className="border-t border-line bg-slate-50 px-5 py-4 sm:px-7">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <Button key={example} type="button" variant="secondary" onClick={() => setRequestText(example)}>
                {example.startsWith("Call")
                  ? "Use call-list example"
                  : example.startsWith("Book")
                    ? "Use appointment example"
                    : "Use nearby example"}
              </Button>
            ))}
          </div>
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
