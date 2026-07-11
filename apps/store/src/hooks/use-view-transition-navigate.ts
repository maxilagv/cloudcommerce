"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { flushSync } from "react-dom";

/**
 * Navigate via the native View Transitions API when the browser supports it
 * (Chrome/Edge/Opera; Safari/Firefox fall through to a plain router.push —
 * silent, no polyfill). Pair with a shared `viewTransitionName` on the
 * element that should morph across the navigation (e.g. a product image).
 */
export function useViewTransitionNavigate() {
  const router = useRouter();

  return useCallback(
    (href: string) => {
      const doc = document as Document & {
        startViewTransition?: (callback: () => void) => void;
      };
      if (!doc.startViewTransition) {
        router.push(href);
        return;
      }
      doc.startViewTransition(() => {
        flushSync(() => router.push(href));
      });
    },
    [router],
  );
}
