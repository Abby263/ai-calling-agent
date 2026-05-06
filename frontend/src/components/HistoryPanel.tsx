import { Clock3, History, Inbox, PhoneCall, Trash2 } from "lucide-react";

import { statusClass } from "../lib/format";
import type { TaskListItem } from "../types/domain";
import { Badge, Button } from "./ui";

export function HistoryPanel({
  tasks,
  activeId,
  onOpen,
  onDelete,
  onClear
}: {
  tasks: TaskListItem[];
  activeId?: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const callCount = tasks.reduce((total, task) => total + task.call_count, 0);

  return (
    <aside className="surface-strong order-2 grid max-h-[calc(100vh-3rem)] content-start gap-4 overflow-auto p-4 scrollbar-thin lg:order-1 lg:sticky lg:top-6">
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
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
          {tasks.length ? (
            <Button
              type="button"
              variant="danger"
              className="h-8 min-h-8 px-2 text-xs"
              onClick={onClear}
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
      {tasks.length === 0 ? (
        <div className="grid gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-5 text-center dark:border-slate-700 dark:bg-slate-950/40">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-500">
            <Inbox size={18} />
          </span>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No tasks yet</p>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            Create your first concierge task and approved calls will land here.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {tasks.map((task) => {
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
                  className="text-left text-sm font-medium leading-5 text-slate-900 line-clamp-3 dark:text-slate-100"
                >
                  {task.original_request}
                </button>
                <div className="flex items-center justify-between gap-2">
                  <Badge className={statusClass(task.status)}>{task.status.replace("_", " ")}</Badge>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {task.call_count} {task.call_count === 1 ? "call" : "calls"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 min-h-8 px-2 text-xs opacity-100 transition"
                    aria-label="Delete task history"
                    title="Delete task history"
                    onClick={() => onDelete(task.id)}
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
