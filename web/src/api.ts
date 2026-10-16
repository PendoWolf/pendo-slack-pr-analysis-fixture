// API base URL. Defaults to the local server; override via VITE_API_URL for
// deployed/preview environments (QAWolf runs against whatever URL this points at).
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export interface AppState {
  counter: number;
  lastAction: string;
}

type Method = "GET" | "POST";

// Thrown by call() when a request fails. Carries the request details as fields
// so callers (e.g. failure tracking) don't have to parse them out of the message.
export class ApiError extends Error {
  readonly method: Method;
  readonly path: string;
  // Undefined for network failures (fetch rejected), where no response arrived.
  readonly status: number | undefined;

  constructor(message: string, method: Method, path: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.method = method;
    this.path = path;
    this.status = status;
  }
}

async function call(path: string, method: Method): Promise<AppState> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method });
  } catch (e) {
    // Network failure: no response, so no status. Keep fetch's own message,
    // which is what the UI displays.
    throw new ApiError((e as Error).message, method, path);
  }
  if (!res.ok) {
    throw new ApiError(`${method} ${path} failed: ${res.status}`, method, path, res.status);
  }
  return res.json() as Promise<AppState>;
}

export const api = {
  getState: () => call("/api/state", "GET"),
  increment: () => call("/api/increment", "POST"),
  decrement: () => call("/api/decrement", "POST"),
  reset: () => call("/api/reset", "POST"),
};
