"use client";

import { useEffect, useState } from "react";
import { fetchMyOrders, type StoreOrderSummary } from "@/lib/api/orders";

/**
 * Fetches the customer's orders (storefront.myOrders) once per mount.
 * Components rendered in the same pass share one HTTP request thanks to
 * tRPC's httpBatchLink.
 */
export function useMyOrders(): { orders: StoreOrderSummary[]; loading: boolean } {
  const [orders, setOrders] = useState<StoreOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchMyOrders().then((items) => {
      if (cancelled) return;
      setOrders(items);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { orders, loading };
}
