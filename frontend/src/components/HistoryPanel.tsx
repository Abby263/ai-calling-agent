import { Clock3, CopyPlus, History, Inbox, PhoneCall, RefreshCw, Search, Trash2 } from "lucide-react";
import { useState } from "react";

import { statusClass } from "../lib/format";
import type { TaskListItem } from "../types/domain";
import { filterHistory, type HistoryFilter } from "../lib/task-workflow";
import { Badge, Button, Input, Select } from "./ui";

export function HistoryPanel({
  tasks,
  activeId,
  onOpen,
  onDelete,
  onClear,
  onReuse,
  onRefresh,
  loading,
  busy,
  error
}: {
  tasks: TaskListItem[];
  activeId?: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onReuse: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
  busy: boolean;
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const visibleTasks = filterHistory(tasks, query, filter);
  const callCount = tasks.reduce((total, task) => total + task.call_count, 0);

  return (
    <aside aria-label="Task history" className="surface-strong order-2 grid content-start gap-4 overflow-auto p-4 scrollbar-thin lg:order-1 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]">
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
              <History size={16} />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Task history
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Saved requests and call results
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" className="h-8 min-h-8 w-8 shrink-0 p-0" onClick={onRefresh} disabled={loading || busy} title="Refresh history" aria-label="Refresh history">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          {tasks.length ? (
            <Button
              type="button"
              variant="danger"
              className="h-8 min-h-8 shrink-0 px-2 text-xs"
              onClick={onClear}
              disabled={busy}
            >
              <Trash2 size={12} />
              Clear
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200/70 bg-panel-gradient dark:border-slate-700/80 dark:bg-panel-gradient-dark">
          <div className="border-r border-slate-200/70 p-3 dark:border-slate-700/70">
            <div className="flex items-center gap-1.5">
              <Clock3 size={13} className="text-brand-600 dark:text-brand-400" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                Tasks
              </p>
            </div>
            <p className="mt-1 font-display text-xl font-bold text-slate-950 dark:text-white">
              {tasks.length}
            </p>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-1.5">
              <PhoneCall size={13} className="text-brand-600 dark:text-brand-400" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                Calls
              </p>
            </div>
            <p className="mt-1 font-display text-xl font-bold text-slate-950 dark:text-white">
              {callCount}
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        <label className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-500 dark:text-slate-400" />
          <Input aria-label="Search task history" placeholder="Search requests…" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <Select aria-label="Filter task history" value={filter} onChange={(event) => setFilter(event.target.value as HistoryFilter)}>
          <option value="all">All statuses</option>
          <option value="approval">Awaiting approval</option>
          <option value="active">In progress</option>
          <option value="completed">Completed</option>
          <option value="stopped">Cancelled or failed</option>
        </Select>
        <p aria-live="polite" className="text-xs text-slate-600 dark:text-slate-300">{visibleTasks.length} of {tasks.length} requests</p>
      </div>
      {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      {loading && tasks.length === 0 ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Loading history…</p> : visibleTasks.length === 0 ? (
        <div className="grid gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-5 text-center dark:border-slate-700 dark:bg-slate-950/40">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-500">
            <Inbox size={18} />
          </span>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{tasks.length ? "No matching requests" : "No tasks yet"}</p>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {tasks.length ? "Try another search or status." : "Your saved requests will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {visibleTasks.map((task) => {
            const isActive = task.id === activeId;
            return (
              <div
                key={task.id}
                className={`group relative grid gap-2 rounded-xl border p-3 transition ${
                  isActive
                    ? "border-brand-300 bg-brand-50/80 shadow-soft dark:border-brand-500/60 dark:bg-brand-500/15"
                    : "border-slate-200 bg-white/80 hover:border-slate-300 hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                }`}
              >
                {isActive ? (
                  <span
                    aria-hidden
                    className="absolute left-0 top-3 h-[calc(100%-1.5rem)] w-1 rounded-r-full bg-brand-gradient"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpen(task.id)}
                  disabled={busy}
                  aria-current={isActive ? "true" : undefined}
                  className="text-left text-sm font-medium leading-5 text-slate-900 line-clamp-3 dark:text-slate-100"
                >
                  {task.original_request}
                </button>
                <time dateTime={task.created_at} className="text-xs text-slate-500 dark:text-slate-400">{new Date(task.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge className={statusClass(task.status)}>{task.status.replace("_", " ")}</Badge>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {task.call_count} {task.call_count === 1 ? "call" : "calls"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                  <Button type="button" variant="ghost" className="min-h-8 px-1 text-xs" onClick={() => onReuse(task.id)} disabled={busy}>
                    <CopyPlus size={13} /> Use as new request
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 min-h-8 px-2 text-xs opacity-100 transition"
                    aria-label="Delete task history"
                    title="Delete task history"
                    onClick={() => onDelete(task.id)}
                    disabled={busy}
                  >
                    <Trash2 size={13} />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
