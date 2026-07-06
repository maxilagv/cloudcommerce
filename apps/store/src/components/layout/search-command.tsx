"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { autocompleteProducts } from "@/lib/api/catalog";
import { productHref, type ProductCardData } from "@/lib/catalog-types";
import { formatPrice } from "@/lib/utils";

const DEBOUNCE_MS = 250;

export function SearchCommand() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [results, setResults] = useState<ProductCardData[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLFormElement>(null);
  const requestSeq = useRef(0);

  // Debounced autocomplete against the real catalog.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const seq = ++requestSeq.current;
    const timer = window.setTimeout(() => {
      void autocompleteProducts(q).then((products) => {
        if (requestSeq.current !== seq) return; // stale response
        setResults(products);
        setOpen(products.length > 0);
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      ref={rootRef}
      onSubmit={handleSubmit}
      role="search"
      className="group relative hidden min-w-0 flex-1 md:block"
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-cc-muted transition-colors group-focus-within:text-cc-primary" />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setOpen(results.length > 0)}
        placeholder="Buscar productos, marcas y mas..."
        autoComplete="off"
        className="h-10 w-full rounded-cc-md border border-cc-border bg-cc-soft pl-10 pr-4 text-sm text-cc-text outline-none transition-[background,border-color,box-shadow] duration-[140ms] ease-cc-out placeholder:text-cc-muted focus:border-cc-primary-border focus:bg-white focus:shadow-cc-focus"
      />

      {/* Autocomplete dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-cc-md border border-cc-border bg-white shadow-cc-md">
          <ul>
            {results.map((product) => (
              <li key={product.id}>
                <Link
                  href={productHref(product)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-[120ms] hover:bg-cc-soft"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-cc-xs bg-cc-soft">
                    <Image
                      src={product.image}
                      alt={product.imageAlt}
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-cc-text">
                      {product.name}
                    </span>
                    <span className="block text-[11px] text-cc-muted">{product.brand}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-bold text-cc-text">
                    {formatPrice(product.price)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            className="block w-full border-t border-cc-border-subtle px-3 py-2 text-left text-[12px] font-semibold text-cc-primary transition-colors hover:bg-cc-soft"
          >
            Ver todos los resultados para “{value.trim()}”
          </button>
        </div>
      )}
    </form>
  );
}
