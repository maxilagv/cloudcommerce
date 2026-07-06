import type {
  CloudDigitalStatus,
  LoyaltyRedemptionStatus,
  LoyaltyRewardKind,
  LoyaltyTransactionType,
} from "@cloudcommerce/types";

export type LoyaltyAccountRow = {
  id: string;
  customerId: string;
  balance: number;
  lifetimeEarned: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LoyaltyLedgerRow = {
  id: string;
  accountId: string;
  type: LoyaltyTransactionType;
  points: number;
  orderId: string | null;
  redemptionId: string | null;
  reason: string;
  createdAt: Date;
};

export type LoyaltyRewardRow = {
  id: string;
  title: string;
  description: string;
  kind: LoyaltyRewardKind;
  pointsCost: number;
  stock: number | null;
  imageId: string | null;
  availableFrom: Date | null;
  availableUntil: Date | null;
  isActive: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LoyaltyRedemptionRow = {
  id: string;
  accountId: string;
  rewardId: string;
  rewardTitle: string;
  pointsSpent: number;
  status: LoyaltyRedemptionStatus;
  code: string;
  note: string | null;
  createdAt: Date;
  fulfilledAt: Date | null;
  cancelledAt: Date | null;
};

export type LoyaltyConfigRow = {
  pointsPer1000: number;
  isEnabled: boolean;
};

export type OrderLoyaltyInfo = {
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  totalMinor: number;
};

export type EarnPointsRecord = {
  customerId: string;
  orderId: string;
  points: number;
  reason: string;
  idempotencyKey: string;
};

export type EarnResult = {
  /** false cuando la clave de idempotencia ya existía (asiento previo). */
  applied: boolean;
};

export type RedeemRecord = {
  customerId: string;
  rewardId: string;
  code: string;
  idempotencyKey: string | null;
  now: Date;
};

export type RedeemResult =
  | { type: "OK"; redemption: LoyaltyRedemptionRow; balance: number }
  | { type: "DUPLICATE"; redemption: LoyaltyRedemptionRow }
  | { type: "REWARD_NOT_FOUND" }
  | { type: "REWARD_NOT_AVAILABLE" }
  | { type: "OUT_OF_STOCK" }
  | { type: "INSUFFICIENT_POINTS"; balance: number };

export type ResolveRedemptionRecord = {
  redemptionId: string;
  action: "FULFILL" | "CANCEL";
  note?: string | undefined;
};

export type ResolveRedemptionResult =
  | { type: "OK"; redemption: LoyaltyRedemptionRow }
  | { type: "NOT_FOUND" }
  | { type: "INVALID_STATE" };

export type AdjustPointsRecord = {
  customerId: string;
  points: number;
  reason: string;
};

export type AdjustPointsResult =
  | { type: "OK"; account: LoyaltyAccountRow }
  | { type: "INSUFFICIENT_POINTS"; balance: number }
  | { type: "CUSTOMER_NOT_FOUND" };

export type UpsertRewardRecord = {
  id: string;
  title: string;
  description: string;
  kind: LoyaltyRewardKind;
  pointsCost: number;
  stock: number | null;
  imageId: string | null;
  availableFrom: Date | null;
  availableUntil: Date | null;
  isActive: boolean;
  position: number;
};

export type AdminRedemptionRow = LoyaltyRedemptionRow & {
  customerId: string;
  customerName: string | null;
  customerEmail: string | null;
};

export type LoyaltyStatsRow = {
  accounts: number;
  pointsIssued: number;
  pointsRedeemed: number;
  pendingRedemptions: number;
};

export type CloudDigitalMembershipRow = {
  id: string;
  customerId: string;
  status: CloudDigitalStatus;
  joinedAt: Date;
  activatedAt: Date | null;
  revokedAt: Date | null;
};

export type AdminMembershipRow = CloudDigitalMembershipRow & {
  customerName: string | null;
  customerEmail: string | null;
};

export type CloudDigitalBenefitRow = {
  id: string;
  title: string;
  description: string;
  partner: string;
  discountLabel: string;
  code: string | null;
  url: string | null;
  isActive: boolean;
  position: number;
};

export type UpsertBenefitRecord = {
  id: string;
  title: string;
  description: string;
  partner: string;
  discountLabel: string;
  code: string | null;
  url: string | null;
  isActive: boolean;
  position: number;
};

/**
 * Puerto de persistencia de loyalty. Las operaciones que mueven puntos son
 * transaccionales y atómicas dentro de la implementación (ledger + balance +
 * stock en la misma transacción, con lock de fila para los canjes).
 */
export type LoyaltyRepository = {
  getConfig(): Promise<LoyaltyConfigRow>;
  updateConfig(config: LoyaltyConfigRow): Promise<LoyaltyConfigRow>;

  findAccountByCustomer(customerId: string): Promise<LoyaltyAccountRow | null>;
  listTransactions(accountId: string, limit: number): Promise<LoyaltyLedgerRow[]>;

  /** Acredita puntos por una orden entregada. Idempotente por `idempotencyKey`. */
  earnPointsForOrder(record: EarnPointsRecord): Promise<EarnResult>;
  /**
   * Contra-asiento del EARN de una orden (cancelación/devolución). Devuelve
   * null si la orden nunca acreditó o si ya fue revertida (idempotente).
   */
  reverseOrderPoints(record: {
    orderId: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<{ reversedPoints: number } | null>;
  adjustPoints(record: AdjustPointsRecord): Promise<AdjustPointsResult>;

  listRewards(filter: { onlyOpen: boolean; now: Date }): Promise<LoyaltyRewardRow[]>;
  upsertReward(record: UpsertRewardRecord): Promise<LoyaltyRewardRow>;

  /** Canje race-free: valida ventana/stock/saldo con locks dentro de la tx. */
  redeemReward(record: RedeemRecord): Promise<RedeemResult>;
  listRedemptionsByCustomer(customerId: string, limit: number): Promise<LoyaltyRedemptionRow[]>;
  listRedemptionsAdmin(filter: {
    status?: LoyaltyRedemptionStatus | undefined;
    limit: number;
  }): Promise<AdminRedemptionRow[]>;
  resolveRedemption(record: ResolveRedemptionRecord): Promise<ResolveRedemptionResult>;

  getOrderLoyaltyInfo(orderId: string): Promise<OrderLoyaltyInfo | null>;
  getStats(): Promise<LoyaltyStatsRow>;

  findMembership(customerId: string): Promise<CloudDigitalMembershipRow | null>;
  /** Alta idempotente: crea en WAITLIST o devuelve la membresía existente. */
  joinCloudDigital(customerId: string): Promise<CloudDigitalMembershipRow>;
  setMembershipStatus(
    customerId: string,
    status: CloudDigitalStatus,
  ): Promise<CloudDigitalMembershipRow | null>;
  listMemberships(filter: {
    status?: CloudDigitalStatus | undefined;
    limit: number;
  }): Promise<AdminMembershipRow[]>;

  listBenefits(onlyActive: boolean): Promise<CloudDigitalBenefitRow[]>;
  upsertBenefit(record: UpsertBenefitRecord): Promise<CloudDigitalBenefitRow>;
};
