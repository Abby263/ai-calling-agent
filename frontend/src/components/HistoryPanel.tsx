import { Clock3, History, PhoneCall, Trash2 } from "lucide-react";

import { statusClass } from "../lib/format";
import type { TaskListItem } from "../types/domain";
import { Badge, Button } from "./ui";

export function HistoryPanel({
  tasks,
  activeId,
  onOpen,
  onDelete
}: {
  tasks: TaskListItem[];
  activeId?: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const callCount = tasks.reduce((total, task) => total + task.call_count, 0);

  return (
    <aside className="order-2 grid max-h-[calc(100vh-2rem)] content-start gap-4 overflow-auto rounded-md border border-line bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900 lg:order-1 lg:sticky lg:top-4">
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <History size={18} className="text-brand" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Task history</h2>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-line bg-panel dark:border-slate-800 dark:bg-slate-950">
          <div className="border-r border-line p-3 dark:border-slate-800">
            <Clock3 size={15} className="text-brand" />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Tasks</p>
            <p className="text-lg font-semibold text-slate-950 dark:text-white">{tasks.length}</p>
          </div>
          <div className="p-3">
            <PhoneCall size={15} className="text-brand" />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Calls</p>
            <p className="text-lg font-semibold text-slate-950 dark:text-white">{callCount}</p>
          </div>
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-panel p-3 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
          No tasks yet.
        </p>
      ) : (
        <div className="grid gap-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`grid gap-2 rounded-md border p-3 ${
                task.id === activeId
                  ? "border-brand bg-blue-50 dark:bg-blue-950/30"
                  : "border-line bg-white dark:border-slate-800 dark:bg-slate-950"
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(task.id)}
                className="text-left text-sm font-medium leading-5 text-slate-900 dark:text-slate-100"
              >
                {task.original_request}
              </button>
              <div className="flex items-center justify-between gap-2">
                <Badge className={statusClass(task.status)}>{task.status.replace("_", " ")}</Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400">{task.call_count} calls</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-8 px-0"
                  aria-label="Delete task history"
                  title="Delete task history"
                  onClick={() => onDelete(task.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
