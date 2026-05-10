import { getAuthToken } from "@/lib/auth-storage";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, token, timeoutMs, signal, ...rest } = options;
  const resolvedToken = token ?? getAuthToken();
  const requestHeaders = new Headers(headers);
  const timeoutController =
    timeoutMs && timeoutMs > 0 ? new AbortController() : null;
  const timeoutId = timeoutController
    ? globalThis.setTimeout(() => timeoutController.abort(), timeoutMs)
    : null;
  const requestSignal = mergeSignals(signal, timeoutController?.signal ?? null);

  requestHeaders.set("Accept", "application/json");

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (resolvedToken) {
    requestHeaders.set("Authorization", `Token ${resolvedToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: requestSignal,
    });
  } catch (error) {
    if (timeoutController?.signal.aborted) {
      throw new ApiError(
        "Backend is still starting. Please try again in a moment.",
        408,
        null,
      );
    }
    throw error;
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }

  const text = await response.text();
  const data = text ? tryParseJson(text) : null;

  if (!response.ok) {
    throw new ApiError(getApiErrorMessage(data), response.status, data);
  }

  return data as T;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getApiErrorMessage(data: unknown): string {
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const message = Reflect.get(data, "message");
    if (typeof message === "string" && message.trim()) return message;
    const detail = Reflect.get(data, "detail");
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return "Something went wrong while talking to the backend.";
}

export { API_BASE_URL };

function mergeSignals(
  originalSignal: AbortSignal | null | undefined,
  timeoutSignal: AbortSignal | null,
) {
  if (!originalSignal) return timeoutSignal ?? undefined;
  if (!timeoutSignal) return originalSignal;

  const controller = new AbortController();
  const abort = () => controller.abort();
  originalSignal.addEventListener("abort", abort, { once: true });
  timeoutSignal.addEventListener("abort", abort, { once: true });
  return controller.signal;
}
