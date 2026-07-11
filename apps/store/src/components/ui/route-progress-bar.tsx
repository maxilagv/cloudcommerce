"use client";

import { useEffect, useState } from "react";

/**
 * Renders inside each route's loading.tsx — its own lifetime IS the "is this
 * route pending" signal, no global nav-state plumbing needed. Delays 150ms
 * before showing so instant navigations never flash it.
 */
export function RouteProgressBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[60] h-[2px] overflow-hidden"
    >
      <div className="h-full w-1/3 animate-cc-route-progress bg-[linear-gradient(90deg,transparent,var(--cc-primary),transparent)]" />
    </div>
  );
}
