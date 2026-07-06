// ---------------------------------------------------------------------------
// Loyalty (CloudPoints) + CloudDigital — contratos compartidos API/frontends.
// El saldo de puntos es un cache derivado de un ledger inmutable de
// transacciones firmadas; toda mutación de saldo pasa por el ledger.
// ---------------------------------------------------------------------------

export enum LoyaltyTransactionType {
  /** Puntos acreditados por una orden entregada. */
  EARN = "EARN",
  /** Puntos debitados por el canje de una recompensa. */
  REDEEM = "REDEEM",
  /** Contra-asiento (orden cancelada tras acreditar, canje cancelado). */
  REVERSAL = "REVERSAL",
  /** Ajuste manual de un admin (positivo o negativo, con motivo). */
  ADJUST = "ADJUST",
}

export enum LoyaltyRewardKind {
  PHYSICAL = "PHYSICAL",
  DIGITAL = "DIGITAL",
}

export enum LoyaltyRedemptionStatus {
  PENDING = "PENDING",
  FULFILLED = "FULFILLED",
  CANCELLED = "CANCELLED",
}

export enum CloudDigitalStatus {
  WAITLIST = "WAITLIST",
  ACTIVE = "ACTIVE",
  REVOKED = "REVOKED",
}

export type LoyaltyProgramConfig = {
  /** CloudPoints otorgados por cada $1.000 ARS de compra entregada. */
  pointsPer1000: number;
  isEnabled: boolean;
};

export type LoyaltySummary = {
  balance: number;
  lifetimeEarned: number;
  config: LoyaltyProgramConfig;
};

export type LoyaltyTransactionView = {
  id: string;
  type: LoyaltyTransactionType;
  /** Delta firmado: EARN/ADJUST+ positivos, REDEEM/REVERSAL de EARN negativos. */
  points: number;
  reason: string;
  orderId: string | null;
  redemptionId: string | null;
  createdAt: string;
};

export type LoyaltyRewardView = {
  id: string;
  title: string;
  description: string;
  kind: LoyaltyRewardKind;
  pointsCost: number;
  /** null = sin límite de stock. */
  stock: number | null;
  imageId: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  isActive: boolean;
  position: number;
};

export type LoyaltyRedemptionView = {
  id: string;
  rewardId: string;
  rewardTitle: string;
  pointsSpent: number;
  status: LoyaltyRedemptionStatus;
  /** Código único que el cliente presenta para retirar/usar el regalo. */
  code: string;
  note: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  cancelledAt: string | null;
};

export type LoyaltyAdminRedemptionView = LoyaltyRedemptionView & {
  customerId: string;
  customerName: string | null;
  customerEmail: string | null;
};

export type LoyaltyProgramStats = {
  accounts: number;
  pointsIssued: number;
  pointsRedeemed: number;
  pendingRedemptions: number;
};

export type CloudDigitalMembershipView = {
  status: CloudDigitalStatus;
  joinedAt: string;
  activatedAt: string | null;
};

export type CloudDigitalBenefitView = {
  id: string;
  title: string;
  description: string;
  partner: string;
  discountLabel: string;
  /** Solo visible para membresías ACTIVE; null en cualquier otro caso. */
  code: string | null;
  url: string | null;
  isActive: boolean;
  position: number;
};

export type CloudDigitalAdminMembershipView = {
  customerId: string;
  status: CloudDigitalStatus;
  joinedAt: string;
  activatedAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
};
