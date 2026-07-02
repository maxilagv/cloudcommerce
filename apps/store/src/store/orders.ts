"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getOrderById, type Order } from "@/lib/mock-account";

type OrdersStore = {
  placedOrders: Order[];
  lastOrderId: string | null;
  addOrder: (order: Order) => void;
  getById: (id: string) => Order | undefined;
};

/** Client-placed orders (simulated checkout) + lookup over placed ∪ mock. */
export const useOrders = create<OrdersStore>()(
  persist(
    (set, get) => ({
      placedOrders: [],
      lastOrderId: null,
      addOrder: (order) =>
        set((s) => ({ placedOrders: [order, ...s.placedOrders], lastOrderId: order.id })),
      getById: (id) => get().placedOrders.find((o) => o.id === id) ?? getOrderById(id),
    }),
    {
      name: "cc-orders",
      partialize: (s) => ({ placedOrders: s.placedOrders, lastOrderId: s.lastOrderId }),
    },
  ),
);
