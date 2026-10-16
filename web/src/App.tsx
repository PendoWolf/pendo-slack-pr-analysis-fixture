import { useEffect, useState } from "react";
import { api, ApiError, type AppState } from "./api";

// Actions run through run(). On success each fires the "demo-<action>" Track
// Event (demo-load, demo-increment, demo-decrement, demo-reset, demo-refresh);
// any failure fires demo-action-failed.
type Action = "load" | "increment" | "decrement" | "reset" | "refresh";

type TrackProperties = Record<string, unknown>;

// Seam for Pendo. Novus installs the Pendo agent, which provides window.pendo
// at runtime; this fires a Track Event for each action. No-op when the agent
// isn't present (local dev), so the app and Playwright mocks both stay simple.
function trackEvent(name: string, properties?: TrackProperties) {
  if (typeof window !== "undefined") {
    try {
      window.pendo?.track?.(`demo-${name}`, properties);
    } catch {
      // Tracking must never break an action or get reported as a failed one.
    }
  }
}

// Properties sent with each action's success event. `prev` is the state that
// was on screen when the action started; `next` is the state the API returned.
function actionProperties(action: Action, prev: AppState, next: AppState): TrackProperties {
  switch (action) {
    case "load":
      return { counter: next.counter, lastAction: next.lastAction };
    case "increment":
    case "decrement":
      return { counter: next.counter, previousCounter: prev.counter };
    case "reset":
      // The response is always 0/"reset"; the useful context is what got cleared.
      return { previousCounter: prev.counter, previousLastAction: prev.lastAction };
    case "refresh":
      return { counter: next.counter, lastAction: next.lastAction, previousCounter: prev.counter };
  }
}

// Properties sent with demo-action-failed. call() attaches the request details
// to the ApiError it throws; network failures have no HTTP status.
function failureProperties(action: Action, e: unknown): TrackProperties {
  const properties: TrackProperties = {
    action,
    // Truncated to keep the properties payload under Pendo's 512-byte limit.
    errorMessage: (e as Error).message.slice(0, 100),
  };
  if (e instanceof ApiError) {
    properties.method = e.method;
    properties.path = e.path;
    if (e.status !== undefined) properties.httpStatus = e.status;
  }
  return properties;
}

export default function App() {
  const [state, setState] = useState<AppState>({ counter: 0, lastAction: "none" });
  const [error, setError] = useState<string | null>(null);

  const run = async (name: Action, fn: () => Promise<AppState>) => {
    // State on screen when the action started (from this render's closure).
    const prev = state;
    try {
      setError(null);
      const next = await fn();
      setState(next);
      trackEvent(name, actionProperties(name, prev, next));
    } catch (e) {
      setError((e as Error).message);
      trackEvent("action-failed", failureProperties(name, e));
    }
  };

  useEffect(() => {
    run("load", api.getState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
      <h1>QAWolf Demo</h1>

      <p data-testid="counter-value" style={{ fontSize: "3rem", margin: "1rem 0" }}>
        {state.counter}
      </p>
      <p data-testid="last-action" style={{ color: "#666" }}>
        Last action: {state.lastAction}
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button data-testid="btn-increment" onClick={() => run("increment", api.increment)}>
          Increment
        </button>
        <button data-testid="btn-decrement" onClick={() => run("decrement", api.decrement)}>
          Decrement
        </button>
        <button data-testid="btn-reset" onClick={() => run("reset", api.reset)}>
          Reset
        </button>
        <button data-testid="btn-refresh" onClick={() => run("refresh", api.getState)}>
          Refresh
        </button>
      </div>

      {error && (
        <p data-testid="error" style={{ color: "crimson", marginTop: 16 }}>
          {error}
        </p>
      )}
    </main>
  );
}
