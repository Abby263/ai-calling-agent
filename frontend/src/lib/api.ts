import type {
  ApproveCallsRequest,
  TaskDetail,
  TaskListItem,
  TaskPreviewRequest
} from "../types/domain";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? "" : "http://localhost:8000");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  previewTask(payload: TaskPreviewRequest) {
    return request<TaskDetail>("/api/tasks/preview", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  approveCalls(taskId: string, payload: ApproveCallsRequest) {
    return request<TaskDetail>(`/api/tasks/${taskId}/approve-calls`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getTask(taskId: string) {
    return request<TaskDetail>(`/api/tasks/${taskId}`);
  },
  listTasks() {
    return request<TaskListItem[]>("/api/tasks");
  },
  cancelTask(taskId: string) {
    return request<TaskDetail>(`/api/tasks/${taskId}/cancel`, { method: "POST" });
  },
  deleteTask(taskId: string) {
    return request<void>(`/api/tasks/${taskId}`, { method: "DELETE" });
  }
};
