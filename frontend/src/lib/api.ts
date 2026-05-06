import type {
  ApproveCallsRequest,
  AuthSession,
  TaskDetail,
  TaskListItem,
  TaskPreviewRequest
} from "../types/domain";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? "" : "http://localhost:8000");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new ApiError(detail || `Request failed with ${response.status}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  getAuthSession() {
    return request<AuthSession>("/api/auth/session");
  },
  login() {
    const next = encodeURIComponent(window.location.pathname || "/app");
    window.location.href = `${API_BASE}/api/auth/login?next=${next}`;
  },
  logout() {
    return request<void>("/api/auth/logout", { method: "POST" });
  },
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
