import { API_BASE_URL } from "@/lib/product";
import type { ApiEnvelope, ApiErrorBody } from "./types";

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let authFailureHandler: (() => void) | null = null;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
    public requestId?: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function setAccessToken(token: string | null) { accessToken = token; }
export function getAccessToken() { return accessToken; }
export function onAuthFailure(handler: (() => void) | null) { authFailureHandler = handler; }

function isErrorBody(value: unknown): value is ApiErrorBody {
  return Boolean(
    value &&
    typeof value === "object" &&
    "success" in value &&
    (value as { success?: unknown }).success === false,
  );
}

async function readResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  let body: unknown;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok || isErrorBody(body)) {
    const error = isErrorBody(body) ? body.error : null;
    throw new ApiError(
      error?.code || (response.status === 401 ? "UNAUTHORIZED" : "NETWORK_ERROR"),
      error?.message || "We couldn’t complete that request. Please try again.",
      response.status,
      error?.details,
      response.headers.get("x-request-id"),
    );
  }
  if (!body || typeof body !== "object" || !("success" in body)) {
    throw new ApiError("INVALID_RESPONSE", "The server returned an unexpected response.", response.status);
  }
  return body as ApiEnvelope<T>;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const envelope = await readResponse<{ accessToken: string }>(response);
        setAccessToken(envelope.data.accessToken);
        return true;
      })
      .catch(() => {
        setAccessToken(null);
        authFailureHandler?.();
        return false;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  retry401?: boolean;
  timeoutMs?: number;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const { body, auth = true, retry401 = true, timeoutMs = 15_000, headers, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestHeaders = new Headers(headers);
    requestHeaders.set("Accept", "application/json");
    if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
    if (auth && accessToken) requestHeaders.set("Authorization", `Bearer ${accessToken}`);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 401 && auth && retry401 && !path.startsWith("/auth/")) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return apiRequest<T>(path, { ...options, retry401: false });
    }
    return await readResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("REQUEST_TIMEOUT", "The server took too long to respond.", 0);
    }
    throw new ApiError(
      "NETWORK_ERROR",
      "We couldn’t reach the finance service. Check your connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function toQuery(
  params: Record<string, string | number | boolean | undefined | null>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function apiData<T>(path: string, options?: ApiRequestOptions) {
  return (await apiRequest<T>(path, options)).data;
}
