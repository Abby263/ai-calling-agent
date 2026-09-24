import type { TaskDetail, TaskListItem } from "../types/domain";

export type Stage = "request" | "preview" | "progress" | "results";
export type HistoryFilter = "all" | "approval" | "active" | "completed" | "stopped";
const TERMINAL_CALL_STATUSES = new Set(["completed", "failed", "no_answer", "voicemail"]);

export function callsAreTerminal(task: TaskDetail): boolean {
  return task.calls.length > 0 && task.calls.every((call) => TERMINAL_CALL_STATUSES.has(call.status));
}

export function shouldPollTask(task: TaskDetail): boolean {
  if (["cancelled", "failed", "completed"].includes(task.task.status)) return false;
  return ["calling", "summarizing"].includes(task.task.status) || (callsAreTerminal(task) && !task.summary);
}

export function canOpenStage(stage: Stage, task: TaskDetail | null): boolean {
  if (stage === "request") return true;
  if (!task) return false;
  if (stage === "preview") return !task.calls.length && ["draft", "preview_ready", "awaiting_approval"].includes(task.task.status);
  if (stage === "results") return Boolean(task.summary);
  return task.calls.length > 0 || ["calling", "summarizing", "cancelled", "failed"].includes(task.task.status);
}

export function filterHistory(tasks: TaskListItem[], query: string, filter: HistoryFilter): TaskListItem[] {
  const search = query.trim().toLowerCase();
  return tasks.filter((task) => {
    const matches = !search || task.original_request.toLowerCase().includes(search);
    const statusMatches = filter === "all"
      || (filter === "approval" && ["draft", "preview_ready", "awaiting_approval"].includes(task.status))
      || (filter === "active" && ["calling", "summarizing"].includes(task.status))
      || (filter === "completed" && task.status === "completed")
      || (filter === "stopped" && ["cancelled", "failed"].includes(task.status));
    return matches && statusMatches;
  });
}
