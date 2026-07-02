import type { Money } from "./domain.js";
import type { CustomerContactChannel, CustomerContactDirection, CustomerTier } from "./enums.js";

export type CustomerAnalyticsRange = "3M" | "6M" | "12M";
export type CustomerAnalyticsBreakdown = "category" | "spend";

export type SpendingPoint = {
  month: string;
  amount: number;
};

export type CustomerBreakdownSlice = {
  key: string;
  label: string;
  value: number;
  amountMinor?: number;
  count?: number;
  pct?: number;
  color?: string;
};

export type CustomerPurchaseHistoryItem = {
  orderId: string;
  orderNumber: string;
  placedAt: Date;
  status: string;
  total: Money;
};

export type CustomerSummary = {
  id: string;
  displayName: string;
  email: string | null;
  whatsapp: string | null;
  tier: CustomerTier;
  primaryCity: string | null;
  ordersCount: number;
  totalSpent: Money;
  lastOrderAt: Date | null;
  createdAt: Date;
};

export type CustomerAddressResponse = {
  id: string;
  customerId: string;
  label: string | null;
  recipientName: string | null;
  province: string;
  city: string;
  street: string;
  streetNumber: string | null;
  betweenStreets: string | null;
  postalCode: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerContactLogResponse = {
  id: string;
  customerId: string;
  channel: CustomerContactChannel;
  direction: CustomerContactDirection;
  note: string | null;
  occurredAt: Date;
};

export type CustomerDetail = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  whatsapp: string | null;
  notes: string | null;
  tier: CustomerTier;
  addresses: CustomerAddressResponse[];
  recentContacts: CustomerContactLogResponse[];
  callsCount: number;
  contactsCount: number;
  lastContactAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerAnalytics = {
  customerId: string;
  range: CustomerAnalyticsRange;
  ordersCount: number;
  totalSpent: Money;
  totalSaved: Money;
  callsCount: number;
  contactsCount: number;
  aov: Money;
  lastOrderAt: Date | null;
  lastContactAt: Date | null;
  spendingSeries: SpendingPoint[];
  purchaseBreakdown: CustomerBreakdownSlice[];
  purchaseHistory: CustomerPurchaseHistoryItem[];
  totalInvested?: Money;
  margin?: { amount: Money; pct: number };
  investedAvailable: boolean;
};

export type CustomerSearchResult = {
  items: CustomerSummary[];
  nextCursor: string | null;
};
