import type {
  CustomerAnalyticsBreakdown,
  CustomerAnalyticsRange,
  CustomerBreakdownSlice,
  CustomerPurchaseHistoryItem,
  Money,
  SpendingPoint,
} from "@cloudcommerce/types";

export type CustomerPurchaseAnalyticsSnapshot = {
  ordersCount: number;
  totalSpent: Money;
  totalSaved: Money;
  aov: Money;
  lastOrderAt: Date | null;
  spendingSeries: SpendingPoint[];
  purchaseBreakdown: CustomerBreakdownSlice[];
  purchaseHistory: CustomerPurchaseHistoryItem[];
  totalInvested: Money | null;
  margin: { amount: Money; pct: number } | null;
};

export interface CustomerPurchaseAnalyticsPort {
  getCustomerAnalytics(input: {
    customerId: string;
    range: CustomerAnalyticsRange;
    breakdown: CustomerAnalyticsBreakdown;
    includeSensitiveInvestment: boolean;
  }): Promise<CustomerPurchaseAnalyticsSnapshot>;
}

export class PlaceholderCustomerPurchaseAnalyticsPort implements CustomerPurchaseAnalyticsPort {
  public async getCustomerAnalytics(input: {
    customerId: string;
    range: CustomerAnalyticsRange;
    breakdown: CustomerAnalyticsBreakdown;
    includeSensitiveInvestment: boolean;
  }): Promise<CustomerPurchaseAnalyticsSnapshot> {
    const months = input.range === "3M" ? 3 : input.range === "6M" ? 6 : 12;
    const spendingSeries = Array.from({ length: months }, (_, index) => ({
      month: this.monthLabel(months - index - 1),
      amount: 0,
    }));
    const zero = { amountMinor: 0, currency: "ARS" as const };
    return {
      ordersCount: 0,
      totalSpent: zero,
      totalSaved: zero,
      aov: zero,
      lastOrderAt: null,
      spendingSeries,
      purchaseBreakdown: [],
      purchaseHistory: [],
      totalInvested: input.includeSensitiveInvestment ? zero : null,
      margin: input.includeSensitiveInvestment ? { amount: zero, pct: 0 } : null,
    };
  }

  private monthLabel(offsetFromNow: number): string {
    const date = new Date();
    date.setMonth(date.getMonth() - offsetFromNow);
    return new Intl.DateTimeFormat("es-AR", { month: "short" }).format(date).replace(".", "");
  }
}
