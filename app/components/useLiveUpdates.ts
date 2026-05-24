"use client";

import { useEffect } from "react";

export function useLiveUpdates(onUpdate: () => void) {
  useEffect(() => {
    let src: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const update = () => onUpdate();

    const connect = () => {
      src?.close();
      src = new EventSource("/api/live");
      src.addEventListener("update", update);
      src.onerror = () => {
        // Force a clean reconnect path when the stream stalls.
        src?.close();
      };
    };

    const ensureConnected = () => {
      if (src?.readyState === EventSource.CLOSED) {
        connect();
      }
    };

    connect();

    // Fallback: if SSE gets stuck in some environments, force periodic refresh.
    const pollFallback = setInterval(() => onUpdate(), 30000);
    // Also guard against silently closed streams.
    reconnectTimeout = setInterval(ensureConnected, 5000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        ensureConnected();
        onUpdate();
      }
    };
    window.addEventListener("focus", onUpdate);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (reconnectTimeout) clearInterval(reconnectTimeout);
      clearInterval(pollFallback);
      window.removeEventListener("focus", onUpdate);
      document.removeEventListener("visibilitychange", onVisible);
      if (src) {
        src.removeEventListener("update", update);
        src.close();
      }
    };
  }, [onUpdate]);
}
