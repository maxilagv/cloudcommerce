"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PaymentMethod } from "@/lib/account-types";

type PaymentInput = Omit<PaymentMethod, "id">;

type PaymentsStore = {
  methods: PaymentMethod[];
  add: (m: PaymentInput) => void;
  remove: (id: string) => void;
};

let seq = 0;
const newId = () => `pm-${Date.now().toString(36)}-${seq++}`;

/**
 * Saved payment methods, persisted locally until a real payments provider is
 * wired. Starts empty — the UI shows a real empty state, never seed data.
 */
export const usePayments = create<PaymentsStore>()(
  persist(
    (set) => ({
      methods: [],
      add: (m) => set((s) => ({ methods: [...s.methods, { ...m, id: newId() }] })),
      remove: (id) => set((s) => ({ methods: s.methods.filter((x) => x.id !== id) })),
    }),
    { name: "cc-payments", partialize: (s) => ({ methods: s.methods }) },
  ),
);
