// chrome-extension/src/lib/api.ts
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

const API_BASE =
  env?.VITE_API_URL ||
  env?.WXT_API_URL ||
  "http://localhost:4000/api";

export interface FetchOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { requiresAuth = true, headers, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  // Pull JWT from storage if authentication is needed
  if (requiresAuth && typeof chrome !== "undefined" && chrome.storage?.local) {
    const { authToken } = await chrome.storage.local.get("authToken");
    if (authToken) {
      requestHeaders["Authorization"] = `Bearer ${authToken}`;
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers: requestHeaders,
  });

  // Handle expired or invalidated sessions
  if (response.status === 401) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.remove(["authToken", "userProfile"]);
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "GUIDEME_SESSION_EXPIRED" }).catch(() => {});
    }
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData.error?.message ||
      errorData.message ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}
