import { useEffect, useRef, useState } from "react";

export type SSEStatus = "idle" | "connecting" | "streaming" | "done" | "error";

export interface UseSSEOptions<T> {
  url: string | null;
  onMessage?: (data: T) => void;
  onDone?: (final: unknown) => void;
  onError?: (err: Event | Error) => void;
}

export interface UseSSEResult {
  status: SSEStatus;
  error: string | null;
  close: () => void;
}

/**
 * Subscribe to a backend SSE stream.
 *
 * Accepts a `url` (or null to disconnect). Default `data:` frames are parsed
 * as JSON and dispatched via onMessage. The terminal `event: done` frame
 * triggers onDone and closes the source.
 */
export function useSSE<T = unknown>({
  url,
  onMessage,
  onDone,
  onError,
}: UseSSEOptions<T>): UseSSEResult {
  const [status, setStatus] = useState<SSEStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  // Keep latest callbacks without restarting the stream.
  const cbRef = useRef({ onMessage, onDone, onError });
  cbRef.current = { onMessage, onDone, onError };

  useEffect(() => {
    if (!url) {
      sourceRef.current?.close();
      sourceRef.current = null;
      setStatus("idle");
      return;
    }
    setStatus("connecting");
    setError(null);
    const es = new EventSource(url);
    sourceRef.current = es;

    es.onopen = () => setStatus("streaming");

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as T;
        cbRef.current.onMessage?.(data);
      } catch (e) {
        cbRef.current.onError?.(e as Error);
      }
    };

    es.addEventListener("done", (ev) => {
      let final: unknown = null;
      try {
        final = JSON.parse((ev as MessageEvent).data);
      } catch {
        /* ignore — done frame may have empty/non-json data */
      }
      cbRef.current.onDone?.(final);
      setStatus("done");
      es.close();
    });

    es.onerror = (ev) => {
      // EventSource fires onerror on normal close too; only escalate if not done.
      if (es.readyState === EventSource.CLOSED) return;
      setStatus("error");
      setError("SSE connection error");
      cbRef.current.onError?.(ev);
      es.close();
    };

    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, [url]);

  return {
    status,
    error,
    close: () => {
      sourceRef.current?.close();
      sourceRef.current = null;
      setStatus("idle");
    },
  };
}
