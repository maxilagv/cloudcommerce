"use client";

import { useEffect, useState } from "react";

/**
 * Returns `false` during SSR and the first client render, then `true` after
 * mount. Gate any UI driven by a *persisted* Zustand store on this so the first
 * paint matches the server output (which has no localStorage) — avoids React 19
 * hydration mismatches and flicker.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
