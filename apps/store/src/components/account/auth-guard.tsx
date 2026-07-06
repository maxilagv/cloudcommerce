"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useAuth } from "@/store/auth";

/** Client-side gate for account/order pages — redirects to login when signed out. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const hydrateSession = useAuth((s) => s.hydrateSession);
  const router = useRouter();
  const pathname = usePathname();

  // Recover the cookie session once on mount so a refreshed page stays logged in
  // (and drop the stale local user when the server session expired).
  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, user, pathname, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex w-full justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-cc-muted" />
      </div>
    );
  }

  return <>{children}</>;
}
