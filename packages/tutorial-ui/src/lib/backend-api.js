// Shared backend fetch helper for in-page overlay components (Dashboard,
// Chat widget, ...). Mirrors the backend-URL resolution and auth-header
// pattern already used in ChatBoxWidgetOverlay.jsx so every overlay talks to
// the same backend the same way.

export async function resolveBackendUrl() {
  const isDev = Boolean(import.meta.env?.DEV);
  const defaultProdUrl = 'https://guideme-lac.vercel.app';
  let baseUrl = import.meta.env?.WXT_API_URL || (isDev ? 'http://localhost:4000' : defaultProdUrl);
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const stored = await chrome.storage.local.get(['guideme_backend_url']).catch(() => ({}));
      if (stored?.guideme_backend_url) baseUrl = stored.guideme_backend_url;
    }
  } catch {}
  return baseUrl.replace(/\/$/, '');
}

export async function getAuthToken() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    return authToken || null;
  } catch {
    return null;
  }
}

export class BackendApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'BackendApiError';
    this.status = status;
  }
}

/**
 * Fetch a `/api/...` endpoint on the GuideMe backend with the stored auth
 * token attached. Throws BackendApiError (with `.status`) on any non-OK
 * response, including 401 (session expired) and 403 (plan-gated feature).
 */
export async function backendApiRequest(endpoint, options = {}) {
  const baseUrl = await resolveBackendUrl();
  const token = await getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      message = errorData?.error?.message || errorData?.message || message;
    } catch {}

    if (res.status === 401 && typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove(['authToken', 'userProfile']).catch(() => {});
    }

    throw new BackendApiError(message, res.status);
  }

  return res.json();
}
