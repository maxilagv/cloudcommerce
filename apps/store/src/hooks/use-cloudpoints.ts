"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  LoyaltyRedemptionView,
  LoyaltyRewardView,
  LoyaltySummary,
  LoyaltyTransactionView,
} from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";

/**
 * Estado de CloudPoints del cliente: saldo, regalos de la rotación vigente,
 * movimientos y canjes. `refresh()` recarga todo (post-canje).
 */
export function useCloudPoints() {
  const [summary, setSummary] = useState<LoyaltySummary | null>(null);
  const [rewards, setRewards] = useState<LoyaltyRewardView[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransactionView[]>([]);
  const [redemptions, setRedemptions] = useState<LoyaltyRedemptionView[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [summaryResult, rewardsResult, transactionsResult, redemptionsResult] =
      await Promise.allSettled([
        trpc.loyalty.my.summary.query(),
        trpc.loyalty.rewards.open.query(),
        trpc.loyalty.my.transactions.query({ limit: 50 }),
        trpc.loyalty.my.redemptions.query({ limit: 50 }),
      ]);
    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
    if (rewardsResult.status === "fulfilled") setRewards(rewardsResult.value);
    if (transactionsResult.status === "fulfilled") setTransactions(transactionsResult.value);
    if (redemptionsResult.status === "fulfilled") setRedemptions(redemptionsResult.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, rewards, transactions, redemptions, loading, refresh };
}
