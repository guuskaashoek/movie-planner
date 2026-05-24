"use client";

import { useEffect } from "react";

export function useLiveUpdates(onUpdate: () => void) {
  useEffect(() => {
    const src = new EventSource("/api/live");
    const update = () => onUpdate();
    src.addEventListener("update", update);
    return () => {
      src.removeEventListener("update", update);
      src.close();
    };
  }, [onUpdate]);
}
