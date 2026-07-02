"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = { name: string; email: string; initials: string };

type AuthStore = {
  user: AuthUser | null;
  /** Simulated login — any credentials succeed (no backend). */
  login: (email: string) => void;
  /** Simulated registration. */
  register: (name: string, email: string) => void;
  logout: () => void;
};

function initialsFrom(value: string): string {
  const parts = value.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "Usuario";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      login: (email) => {
        const name = nameFromEmail(email);
        set({ user: { name, email, initials: initialsFrom(name) } });
      },
      register: (name, email) => {
        set({ user: { name, email, initials: initialsFrom(name || email) } });
      },
      logout: () => set({ user: null }),
    }),
    { name: "cc-auth" },
  ),
);

export const useIsAuthenticated = () => useAuth((s) => s.user !== null);
