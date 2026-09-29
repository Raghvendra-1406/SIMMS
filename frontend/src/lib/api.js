import { logout } from "./session";

// Backend URL. Override with VITE_API_BASE_URL in frontend/.env.local,
// e.g. VITE_API_BASE_URL=http://192.168.1.10:8000 to use it from a phone.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * fetch() against the backend with the session token.
 * Returns parsed JSON (or null for 204). Throws Error(detail) on failure.
 * An expired session (401) logs the user out.
 */
export async function apiFetch(path, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...getAuthHeaders(),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    logout();
    throw new Error("Your session has expired. Please log in again.");
  }

  const data =
    response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : `Request failed (${response.status}).`
    );
  }

  return data;
}
