"use client";

import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastStore = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
};

let counter = 0;
const TIMERS = new Map<number, ReturnType<typeof setTimeout>>();

/** Ephemeral toast queue (never persisted — it holds live callbacks). */
export const useToast = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    TIMERS.set(
      id,
      setTimeout(() => get().dismiss(id), 3500),
    );
    return id;
  },
  dismiss: (id) => {
    const timer = TIMERS.get(id);
    if (timer) {
      clearTimeout(timer);
      TIMERS.delete(id);
    }
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
}));

type ToastOpts = Partial<Pick<Toast, "actionLabel" | "onAction" | "description">>;

/** Imperative API so stores/handlers (non-hook code) can fire toasts. */
export const toast = {
  success: (title: string, opts?: ToastOpts) =>
    useToast.getState().push({ title, variant: "success", ...opts }),
  error: (title: string, opts?: ToastOpts) =>
    useToast.getState().push({ title, variant: "error", ...opts }),
  info: (title: string, opts?: ToastOpts) =>
    useToast.getState().push({ title, variant: "info", ...opts }),
};
