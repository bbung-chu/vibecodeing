"use client";

import { useEffect } from "react";

/** Marks <html> once React has hydrated, so E2E tests know client handlers are attached. */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
