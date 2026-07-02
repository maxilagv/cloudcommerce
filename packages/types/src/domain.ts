import { AdminRole } from "./enums.js";

export type Currency = "ARS" | "USD";

export type Money = {
  amountMinor: number;
  currency: Currency;
};

export type Permission = {
  resource: string;
  action: string;
};

export type AdminProfile = {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
};

export type Actor =
  | { kind: "admin"; userId: string; role: AdminRole; sessionId: string }
  | { kind: "customer"; customerId: string }
  | { kind: "public" }
  | { kind: "system"; service: string };
