"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Spinner } from "@cloudcommerce/ui";
import { trpc } from "@/lib/trpc";
import { useUiStore } from "@/stores/ui-store";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";

/**
 * Client-side session gate for the dashboard group. Resolves `identity.me`;
 * an unauthenticated/expired session bounces to /login (the middleware already
 * blocks the no-cookie case — this catches a cookie that no longer resolves).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  const { data: me, isLoading, isError } = useQuery({
    queryKey: ["identity", "me"],
    queryFn: () => trpc.identity.me.query(),
    retry: false,
  });

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  if (isLoading || !me) {
    return (
      <div className="admin-shell">
        <aside className="admin-sb" />
        <div className="admin-main">
          <header className="admin-topbar" />
          <div className="admin-content" style={{ display: "grid", placeItems: "center" }}>
            <Spinner size={22} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell" data-collapsed={collapsed || undefined}>
      <Sidebar role={me.profile.role} />
      <div className="admin-main">
        <Topbar me={me} />
        <div className="admin-content">{children}</div>
      </div>
      <CommandPalette />
    </div>
  );
}
