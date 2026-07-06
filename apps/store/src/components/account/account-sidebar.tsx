"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cloud,
  LayoutDashboard,
  MapPin,
  Package,
  Star,
} from "lucide-react";
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
  const user = useAuth((s) => s.user);
  const pathname = usePathname();
  const current = activePath ?? pathname;

  return (
    <aside className="hidden lg:flex flex-col w-[240px] shrink-0">
      {/* Profile card */}
      <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-4 flex flex-col items-center gap-3 mb-4">
        <div className="h-14 w-14 rounded-full bg-cc-primary flex items-center justify-center text-white text-[20px] font-bold">
          {user?.initials ?? "?"}
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-cc-text leading-snug">
            {user?.name}
          </p>
          <p className="text-[12px] text-cc-muted mt-0.5">{user?.email}</p>
        </div>
        {user?.tier && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cc-primary-soft px-2.5 py-0.5 text-[11px] font-bold text-cc-primary">
            <Star className="h-2.5 w-2.5" fill="currentColor" />
            {user.tier}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav
        aria-label="Secciones de tu cuenta"
        className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm overflow-hidden flex-1 flex flex-col"
      >
        <ul className="flex-1 p-2 flex flex-col gap-0.5">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = current === link.href;
            return (
              <li key={link.label}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-cc-sm text-[13px] font-medium transition-colors duration-[140ms] ease-cc-out cc-focus-ring",
                    isActive
                      ? "bg-cc-primary-soft text-cc-primary"
                      : "text-cc-secondary hover:bg-cc-bg-hover hover:text-cc-text",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  {link.label}
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
