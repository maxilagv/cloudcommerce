"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TRPCClientError } from "@trpc/client";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { toast } from "@/store/toast";

type StoreProfile = RouterOutputs["storefront"]["me"];

export type AuthUser = {
  name: string;
  email: string;
  initials: string;
  customerId: string;
  tier?: string;
};

type AuthStore = {
  user: AuthUser | null;
  /** Real login against apps/api. Returns true on success; errors surface via toast. */
  login: (email: string, password: string) => Promise<boolean>;
  /** Real registration. `name` is split into firstName/lastName for the API. */
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  /**
   * Recovers the session from the httpOnly cookie (storefront.me) so a hard
   * refresh keeps the user signed in. Clears the local user when the cookie
   * session is gone/expired.
   */
  hydrateSession: () => Promise<void>;
};

function initialsFrom(value: string): string {
  const parts = value.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function userFromProfile(profile: StoreProfile): AuthUser {
  const name = profile.displayName || `${profile.firstName} ${profile.lastName}`.trim();
  return {
    name,
    email: profile.email,
    initials: initialsFrom(name || profile.email),
    customerId: profile.customerId,
    tier: profile.tier,
  };
}

function errorCode(err: unknown): string | undefined {
  if (err instanceof TRPCClientError) {
    const data = err.data as { code?: string } | undefined;
    return data?.code;
  }
  return undefined;
}

// Dedupe concurrent hydrations (AuthGuard + header can both trigger on mount).
let hydrating: Promise<void> | null = null;

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,

      login: async (email, password) => {
        try {
          const result = await trpc.storefront.login.mutate({ email, password });
          set({ user: userFromProfile(result.profile) });
          return true;
        } catch (err) {
          const code = errorCode(err);
          if (code === "UNAUTHORIZED") {
            toast.error("Email o contraseña incorrectos");
          } else {
            toast.error("No pudimos iniciar sesión", {
              description: "Revisá tu conexión e intentá de nuevo.",
            });
          }
          return false;
        }
      },

      register: async (name, email, password) => {
        const parts = name.trim().split(/\s+/);
        const firstName = parts[0] ?? name.trim();
        const lastName = parts.slice(1).join(" ") || firstName;
        try {
          const result = await trpc.storefront.register.mutate({
            email,
            password,
            firstName,
            lastName,
          });
          set({ user: userFromProfile(result.profile) });
          return true;
        } catch (err) {
          const code = errorCode(err);
          if (code === "CONFLICT") {
            toast.error("Ya existe una cuenta con ese email");
          } else if (code === "BAD_REQUEST") {
            toast.error("Datos inválidos", {
              description: "Revisá el nombre, el email y que la contraseña tenga al menos 8 caracteres.",
            });
          } else {
            toast.error("No pudimos crear tu cuenta", {
              description: "Revisá tu conexión e intentá de nuevo.",
            });
          }
          return false;
        }
      },

      logout: async () => {
        try {
          await trpc.storefront.logout.mutate();
        } catch {
          // The local session is cleared regardless — the cookie expires server-side.
        }
        set({ user: null });
      },

      hydrateSession: async () => {
        if (!hydrating) {
          hydrating = (async () => {
            try {
              const profile = await trpc.storefront.me.query();
              set({ user: userFromProfile(profile) });
            } catch {
              set({ user: null });
            } finally {
              hydrating = null;
            }
          })();
        }
        return hydrating;
      },
    }),
    { name: "cc-auth" },
  ),
);

export const useIsAuthenticated = () => useAuth((s) => s.user !== null);
