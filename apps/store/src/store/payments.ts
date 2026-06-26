"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mockPaymentMethods, type PaymentMethod } from "@/lib/mock-account";

type PaymentInput = Omit<PaymentMethod, "id">;

type PaymentsStore = {
  methods: PaymentMethod[];
  add: (m: PaymentInput) => void;
  remove: (id: string) => void;
};

let seq = 0;
const newId = () => `pm-${Date.now().toString(36)}-${seq++}`;

/** Seeded from mock data via initial state (see addresses store for rationale). */
export const usePayments = create<PaymentsStore>()(
  persist(
    (set) => ({
      methods: mockPaymentMethods,
      add: (m) => set((s) => ({ methods: [...s.methods, { ...m, id: newId() }] })),
      remove: (id) => set((s) => ({ methods: s.methods.filter((x) => x.id !== id) })),
    }),
    { name: "cc-payments", partialize: (s) => ({ methods: s.methods }) },
  ),
);
