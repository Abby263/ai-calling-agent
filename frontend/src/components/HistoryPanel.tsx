import { Clock3, Trash2 } from "lucide-react";

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
  return (
    <aside className="grid max-h-[calc(100vh-2rem)] content-start gap-3 overflow-auto rounded-md border border-line bg-white p-4 shadow-soft lg:sticky lg:top-4">
      <div className="flex items-center gap-2">
        <Clock3 size={18} className="text-brand" />
        <h2 className="font-semibold text-slate-900">Saved searches</h2>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm leading-6 text-slate-500">Completed and in-progress requests appear here.</p>
      ) : (
        <div className="grid gap-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`grid gap-2 rounded-md border p-3 ${
                task.id === activeId ? "border-brand bg-blue-50" : "border-line bg-white"
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(task.id)}
                className="text-left text-sm font-medium leading-5 text-slate-900"
              >
                {task.original_request}
              </button>
              <div className="flex items-center justify-between gap-2">
                <Badge className={statusClass(task.status)}>{task.status.replace("_", " ")}</Badge>
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

