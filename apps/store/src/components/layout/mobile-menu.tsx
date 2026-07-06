"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  Headphones,
  Package,
  Search,
  ShieldCheck,
  Truck,
  User,
} from "lucide-react";
import { categoryHref, type CategoryLink } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "./main-nav";
import { BrandLogo } from "./brand-logo";

/**
 * Mobile navigation: animated hamburger + left slide-in drawer with search,
 * primary links, the real category tree and account shortcuts. Closes on
 * navigation, backdrop tap and Escape; locks body scroll while open.
 */
export function MobileMenu({ categories }: { categories: CategoryLink[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  // Close whenever the route changes (covers back/forward too).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Body scroll lock.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    setQuery("");
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const line = "block h-[2px] w-5 rounded-full bg-current transition-all duration-[220ms] ease-cc-out";

  return (
    <div className="lg:hidden">
      {/* Animated hamburger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="cc-focus-ring grid h-10 w-10 place-items-center rounded-cc-sm text-cc-secondary transition-colors duration-[140ms] ease-cc-out hover:bg-cc-primary-softer hover:text-cc-primary"
      >
        <span className="flex flex-col items-center justify-center">
          <span className={cn(line, open && "translate-y-[6px] rotate-45")} />
          <span className={cn(line, "my-1", open && "scale-x-0 opacity-0")} />
          <span className={cn(line, open && "-translate-y-[6px] -rotate-45")} />
        </span>
      </button>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px] transition-opacity duration-[220ms] ease-cc-out",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Drawer */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menú principal"
        className={cn(
          "fixed inset-y-0 left-0 z-[71] flex w-[86%] max-w-[360px] flex-col bg-cc-surface shadow-[18px_0_50px_rgba(16,24,40,0.18)]",
          "transition-transform duration-[280ms] ease-cc-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-cc-border-subtle px-4 py-3">
          <BrandLogo />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {/* Search */}
          <form onSubmit={submitSearch} role="search" className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cc-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos..."
              aria-label="Buscar productos"
              className="cc-focus-ring h-11 w-full rounded-full border border-cc-border bg-cc-soft pl-10 pr-4 text-[14px] text-cc-text placeholder:text-cc-muted"
            />
          </form>

          {/* Primary links */}
          <nav aria-label="Principal" className="mt-4 grid gap-0.5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="cc-focus-ring flex items-center justify-between rounded-cc-md px-3 py-2.5 text-[15px] font-semibold text-cc-text transition-colors duration-[140ms] hover:bg-cc-primary-softer hover:text-cc-primary"
              >
                {link.label}
                <ChevronRight className="h-4 w-4 text-cc-faint" />
              </Link>
            ))}
          </nav>

          {/* Categories (real tree) */}
          {categories.length > 0 && (
            <div className="mt-5">
              <p className="px-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-cc-muted">
                Categorías
              </p>
              <nav aria-label="Categorías" className="mt-2 grid gap-0.5">
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={categoryHref(category.slug)}
                    onClick={() => setOpen(false)}
                    className="cc-focus-ring flex items-center justify-between rounded-cc-md px-3 py-2.5 text-[14px] font-medium text-cc-secondary transition-colors duration-[140ms] hover:bg-cc-primary-softer hover:text-cc-primary"
                  >
                    {category.label}
                    <ChevronRight className="h-4 w-4 text-cc-faint" />
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* Account shortcuts */}
          <div className="mt-5">
            <p className="px-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-cc-muted">
              Tu cuenta
            </p>
            <nav aria-label="Cuenta" className="mt-2 grid gap-0.5">
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="cc-focus-ring flex items-center gap-3 rounded-cc-md px-3 py-2.5 text-[14px] font-medium text-cc-secondary transition-colors duration-[140ms] hover:bg-cc-primary-softer hover:text-cc-primary"
              >
                <User className="h-[18px] w-[18px]" strokeWidth={1.9} />
                Mi cuenta
              </Link>
              <Link
                href="/orders"
                onClick={() => setOpen(false)}
                className="cc-focus-ring flex items-center gap-3 rounded-cc-md px-3 py-2.5 text-[14px] font-medium text-cc-secondary transition-colors duration-[140ms] hover:bg-cc-primary-softer hover:text-cc-primary"
              >
                <Package className="h-[18px] w-[18px]" strokeWidth={1.9} />
                Mis pedidos
              </Link>
            </nav>
          </div>
        </div>

        {/* Trust footer */}
        <div className="border-t border-cc-border-subtle px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-cc-muted">
            <span className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-cc-primary" /> Envíos al país
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-cc-primary" /> Compra segura
            </span>
            <span className="flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5 text-cc-primary" /> Soporte
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
