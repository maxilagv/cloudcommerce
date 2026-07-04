"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "@cloudcommerce/types";
import { navForRole } from "@/lib/nav";
import { useUiStore } from "@/stores/ui-store";

export function Sidebar({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const groups = navForRole(role);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="admin-sb">
      <div className="admin-sb__top">
        <span className="admin-sb__mark" />
        <span className="admin-sb__brand">CloudCommerce</span>
      </div>
      <nav className="admin-sb__nav">
        {groups.map((group, gi) => (
          <div key={group.label ?? `g${gi}`}>
            {group.label && <div className="admin-sb__grp">{group.label}</div>}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="admin-nav-i"
                  data-active={isActive(item.href) || undefined}
                >
                  <Icon size={18} />
                  <span className="admin-nav-i__txt">{item.label}</span>
                  {item.badge && <span className="admin-nav-i__badge">{item.badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** Collapsed state lives on the shell wrapper so the grid can animate its width. */
export function useSidebarCollapsed() {
  return useUiStore((s) => s.sidebarCollapsed);
}
