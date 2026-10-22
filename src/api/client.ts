// ORIGIN API Client with Cookie Session and CSRF Support

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
  csrf_token?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ApiError {
  detail: string | { msg: string }[];
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match ? decodeURIComponent(match[3]) : null;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  retryOnAuth = true
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  // Double Submit CSRF Token for browser sessions on mutating requests
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfToken = getCookie("origin_csrf_token");
    if (csrfToken && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Required for HttpOnly cookie sessions
  });

  // Attempt automatic silent token refresh on 401 once if it's not an auth endpoint
  if (
    response.status === 401 &&
    retryOnAuth &&
    !endpoint.includes("/api/auth/login") &&
    !endpoint.includes("/api/auth/register") &&
    !endpoint.includes("/api/auth/refresh")
  ) {
    try {
      const refreshed = await refreshSessionApi();
      if (refreshed) {
        // Retry original request once
        return apiRequest<T>(endpoint, options, false);
      }
    } catch {
      // Refresh failed, proceed to error throw
    }
  }

  if (!response.ok) {
    let errorData: ApiError;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText || `HTTP ${response.status}` };
    }

    let message = "Request failed";
    if (typeof errorData.detail === "string") {
      message = errorData.detail;
    } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
      message = errorData.detail.map((err) => err.msg || JSON.stringify(err)).join(", ");
    }

    const err = new Error(message);
    (err as unknown as { status: number }).status = response.status;
    throw err;
  }

  // Handle empty responses
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  return null as T;
}

// Public Endpoints
export async function checkBackendHealth() {
  return apiRequest<{ status: string; service: string }>("/api/health", { method: "GET" });
}

// Auth Endpoints
export async function registerApi(payload: RegisterPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginApi(payload: LoginPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function refreshSessionApi(): Promise<AuthResponse | null> {
  try {
    return await apiRequest<AuthResponse>("/api/auth/refresh", {
      method: "POST",
    }, false);
  } catch {
    return null;
  }
}

export async function logoutApi(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function getCurrentUserApi(): Promise<User> {
  return apiRequest<User>("/api/auth/me", {
    method: "GET",
  });
}

// Protected Investigations Endpoints
export async function getInvestigationsApi() {
  return apiRequest<unknown[]>("/api/investigations", { method: "GET" });
}

export async function getInvestigationDetectionApi(id: string) {
  return apiRequest<unknown>(`/api/investigations/${id}/detection`, { method: "GET" });
}

export async function getInvestigationVesselsApi(id: string) {
  return apiRequest<unknown>(`/api/investigations/${id}/vessels`, { method: "GET" });
}

export async function getInvestigationSourceApi(id: string) {
  return apiRequest<unknown>(`/api/investigations/${id}/source`, { method: "GET" });
}

export async function getInvestigationReportApi(id: string) {
  return apiRequest<unknown>(`/api/investigations/${id}/report`, { method: "GET" });
}