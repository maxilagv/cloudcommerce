"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type OrdersStore = {
  /** Last order placed in this browser — used by the checkout success page. */
  lastOrderId: string | null;
  setLastOrderId: (id: string) => void;
};

/**
 * Orders now live in the backend (storefront.myOrders / orderDetail); this
 * store only remembers the last placed order id for the success screen.
 */
export const useOrders = create<OrdersStore>()(
  persist(
    (set) => ({
      lastOrderId: null,
      setLastOrderId: (id) => set({ lastOrderId: id }),
    }),
    {
      name: "cc-orders",
      partialize: (s) => ({ lastOrderId: s.lastOrderId }),
    },
  ),
);
