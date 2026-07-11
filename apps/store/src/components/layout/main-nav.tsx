"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

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
              "cc-focus-ring relative rounded-cc-sm px-3 py-2 text-sm transition-colors duration-[140ms] ease-cc-out",
              isActive
                ? "font-bold text-cc-primary"
                : "font-medium text-cc-secondary hover:bg-cc-primary-softer hover:text-cc-primary",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="main-nav-active-pill"
                className="absolute inset-0 -z-10 rounded-cc-sm bg-cc-primary-soft"
                transition={spring.gentle}
              />
            )}
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
