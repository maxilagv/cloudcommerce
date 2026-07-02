"use client";

import { useEffect } from "react";
import { defaultCatalogQuery } from "@/lib/catalog-filter";
import { useCatalog } from "@/store/catalog";

/**
 * Seeds the shared catalog store from a URL query (used by /search) and resets
 * it on unmount, so search filters never bleed into the home catalog. The home
 * page does NOT render this, so user-applied filters/sort persist there across
 * navigation (e.g. the nav "Ofertas"/"Novedades" shortcuts).
 */
export function CatalogSync({ query }: { query?: string }) {
  useEffect(() => {
    useCatalog.setState({ ...defaultCatalogQuery, query: query ?? "" });
  }, [query]);

  useEffect(() => {
    return () => {
      useCatalog.getState().reset();
    };
  }, []);

  return null;
}
