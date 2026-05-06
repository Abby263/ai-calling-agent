import type {
  ApproveCallsRequest,
  AuthSession,
  TaskDetail,
  TaskListItem,
  TaskPreviewRequest
} from "../types/domain";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? "" : "http://localhost:8000");

type AuthTokenProvider = () => Promise<string | null>;

let authTokenProvider: AuthTokenProvider | null = null;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function setAuthTokenProvider(provider: AuthTokenProvider | null) {
  authTokenProvider = provider;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authTokenProvider ? await authTokenProvider() : null;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
