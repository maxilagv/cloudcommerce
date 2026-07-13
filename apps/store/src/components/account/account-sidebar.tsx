"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Cloud, LayoutDashboard, MapPin, Package, Star } from "lucide-react";
import { useAuth } from "@/store/auth";
import { LogoutButton } from "./logout-button";

const navLinks = [
  { href: "/account", label: "Inicio", icon: LayoutDashboard },
  { href: "/orders", label: "Mis pedidos", icon: Package },
  { href: "/account/cloudpoints", label: "CloudPoints", icon: Star },
  { href: "/account/clouddigital", label: "CloudDigital", icon: Cloud },
  { href: "/account/addresses", label: "Direcciones y pagos", icon: MapPin },
];

export function AccountSidebar({ activePath }: { activePath?: string }) {
  const user = useAuth((state) => state.user);
  const pathname = usePathname();
  const current = activePath ?? pathname;

  return (
    <aside className="hidden w-[240px] shrink-0 flex-col lg:flex">
      <div className="mb-4 flex flex-col items-center gap-3 rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-4 shadow-cc-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cc-primary text-[20px] font-bold text-cc-shell">
          {user?.initials ?? "?"}
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold leading-snug text-cc-text">{user?.name}</p>
          <p className="mt-0.5 text-[12px] text-cc-muted">{user?.email}</p>
        </div>
        {user?.tier && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cc-primary-soft px-2.5 py-0.5 text-[11px] font-bold text-cc-primary">
            <Star className="h-2.5 w-2.5" fill="currentColor" strokeWidth={1.75} />
            {user.tier}
          </span>
        )}
      </div>

      <nav
        aria-label="Secciones de tu cuenta"
        className="flex flex-1 flex-col overflow-hidden rounded-cc-xl border border-cc-border-subtle bg-cc-shell shadow-cc-sm"
      >
        <ul className="flex flex-1 flex-col gap-0.5 p-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = current === link.href || (link.href !== "/account" && current.startsWith(`${link.href}/`));

            return (
              <li key={link.label}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "cc-focus-ring relative flex min-h-11 items-center gap-2.5 overflow-hidden rounded-cc-sm px-3 py-2.5 text-[13px] font-medium transition-colors duration-[var(--cc-duration-fast)] ease-cc-out",
                    isActive ? "text-cc-primary" : "text-cc-secondary hover:bg-cc-hover hover:text-cc-text",
                  ].join(" ")}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-cc-sm bg-cc-primary-soft"
                    />
                  )}
                  <Icon className="relative h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="relative">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-cc-border-subtle p-2">
          <LogoutButton />
        </div>
      </nav>
    </aside>
  );
}
