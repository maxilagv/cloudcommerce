"use client";

import { useEffect } from "react";
import { defaultCatalogQuery, type CatalogQuery } from "@/lib/catalog-filter";
import { useCatalog } from "@/store/catalog";

/**
 * Seeds the shared catalog store from the URL-derived initial state and resets
 * it on unmount, so filters never bleed between routes. `resetKey` must change
 * whenever the URL query changes (even if `initial` is identical) so that
 * navigating between category pages clears refinements.
 */
export function CatalogSync({
  initial,
  resetKey = "",
}: {
  initial?: Partial<CatalogQuery>;
  resetKey?: string;
}) {
  const key = `${resetKey}::${JSON.stringify(initial ?? {})}`;

  useEffect(() => {
    useCatalog.setState({ ...defaultCatalogQuery, ...(initial ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    return () => {
      useCatalog.getState().reset();
    };
  }, []);

  return null;
}
