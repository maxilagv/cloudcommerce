"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Catálogo", href: "/products" },
  { label: "Ofertas", href: "/products?deals=1" },
  { label: "Novedades", href: "/products?sort=newest" },
] as const;

/** Desktop primary nav — plain crawlable links driven by URL params. */
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
      {NAV_LINKS.map((link) => {
        const isActive =
          link.href === "/" ? pathname === "/" : link.href === "/products" && pathname === "/products";
        return (
          <Link
            key={link.label}
            href={link.href}
            className={cn(
              "cc-focus-ring rounded-cc-sm px-3 py-2 text-sm transition-[color,background] duration-[140ms] ease-cc-out",
              isActive
                ? "bg-cc-primary-soft font-bold text-cc-primary"
                : "font-medium text-cc-secondary hover:bg-cc-primary-softer hover:text-cc-primary",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
