import {
  AdminRole,
  CloudDigitalStatus,
  LoyaltyRedemptionStatus,
  type Actor,
  type CloudDigitalAdminMembershipView,
  type CloudDigitalBenefitView,
  type CloudDigitalMembershipView,
  type LoyaltyAdminRedemptionView,
  type LoyaltyProgramConfig,
  type LoyaltyProgramStats,
  type LoyaltyRedemptionView,
  type LoyaltyRewardView,
  type LoyaltySummary,
  type LoyaltyTransactionView,
} from "@cloudcommerce/types";
import type {
  AdjustLoyaltyPointsInput,
  ListCloudDigitalMembershipsInput,
  ListLoyaltyRedemptionsInput,
  LoyaltyTransactionsQueryInput,
  RedeemRewardInput,
  ResolveRedemptionInput,
  SetCloudDigitalMembershipStatusInput,
  UpdateLoyaltyConfigInput,
  UpsertCloudDigitalBenefitInput,
  UpsertLoyaltyRewardInput,
} from "@cloudcommerce/validators";
import { v7 as uuidv7 } from "uuid";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { LoyaltyDomainError } from "../../../shared/errors/domain-error.js";
import {
  computeEarnedPoints,
  earnIdempotencyKey,
  generateRedemptionCode,
  orderReversalIdempotencyKey,
} from "../domain/loyalty-policies.js";
import type {
  AdminMembershipRow,
  AdminRedemptionRow,
  CloudDigitalBenefitRow,
  CloudDigitalMembershipRow,
  LoyaltyLedgerRow,
  LoyaltyRedemptionRow,
  LoyaltyRepository,
  LoyaltyRewardRow,
} from "./loyalty-repository.js";

const iso = (date: Date): string => date.toISOString();
const isoOrNull = (date: Date | null): string | null => (date ? date.toISOString() : null);

const canViewLoyaltyAdmin = (actor: Actor): boolean => actor.kind === "admin";
const canManageLoyalty = (actor: Actor): boolean =>
  actor.kind === "admin" && (actor.role === AdminRole.OWNER || actor.role === AdminRole.ADMIN);

const toRewardView = (row: LoyaltyRewardRow): LoyaltyRewardView => ({
  id: row.id,
  title: row.title,
  description: row.description,
  kind: row.kind,
  pointsCost: row.pointsCost,
  stock: row.stock,
  imageId: row.imageId,
  availableFrom: isoOrNull(row.availableFrom),
  availableUntil: isoOrNull(row.availableUntil),
  isActive: row.isActive,
  position: row.position,
});

const toTransactionView = (row: LoyaltyLedgerRow): LoyaltyTransactionView => ({
  id: row.id,
  type: row.type,
  points: row.points,
  reason: row.reason,
  orderId: row.orderId,
  redemptionId: row.redemptionId,
  createdAt: iso(row.createdAt),
});

const toRedemptionView = (row: LoyaltyRedemptionRow): LoyaltyRedemptionView => ({
  id: row.id,
  rewardId: row.rewardId,
  rewardTitle: row.rewardTitle,
  pointsSpent: row.pointsSpent,
  status: row.status,
  code: row.code,
  note: row.note,
  createdAt: iso(row.createdAt),
  fulfilledAt: isoOrNull(row.fulfilledAt),
  cancelledAt: isoOrNull(row.cancelledAt),
});

const toAdminRedemptionView = (row: AdminRedemptionRow): LoyaltyAdminRedemptionView => ({
  ...toRedemptionView(row),
  customerId: row.customerId,
  customerName: row.customerName,
  customerEmail: row.customerEmail,
});

const toMembershipView = (row: CloudDigitalMembershipRow): CloudDigitalMembershipView => ({
  status: row.status,
  joinedAt: iso(row.joinedAt),
  activatedAt: isoOrNull(row.activatedAt),
});

const toAdminMembershipView = (row: AdminMembershipRow): CloudDigitalAdminMembershipView => ({
  customerId: row.customerId,
  status: row.status,
  joinedAt: iso(row.joinedAt),
  activatedAt: isoOrNull(row.activatedAt),
  customerName: row.customerName,
  customerEmail: row.customerEmail,
});

const toBenefitView = (
  row: CloudDigitalBenefitRow,
  revealCode: boolean,
): CloudDigitalBenefitView => ({
  id: row.id,
  title: row.title,
  description: row.description,
  partner: row.partner,
  discountLabel: row.discountLabel,
  code: revealCode ? row.code : null,
  url: row.url,
  isActive: row.isActive,
  position: row.position,
});

/**
 * CloudPoints + CloudDigital. Toda mutación de saldo pasa por el ledger del
 * repositorio (asientos firmados e idempotentes); este servicio solo decide
 * QUÉ asiento corresponde y traduce filas a vistas de API.
 */
export class LoyaltyService {
  public constructor(private readonly repository: LoyaltyRepository) {}

  // -------------------------------------------------------------------------
  // Cliente (storefront)
  // -------------------------------------------------------------------------

  public async mySummary(actor: Actor): Promise<Result<LoyaltySummary, LoyaltyDomainError>> {
    if (actor.kind !== "customer") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const [account, config] = await Promise.all([
      this.repository.findAccountByCustomer(actor.customerId),
      this.repository.getConfig(),
    ]);
    return ok({
      balance: account?.balance ?? 0,
      lifetimeEarned: account?.lifetimeEarned ?? 0,
      config,
    });
  }

  public async myTransactions(
    actor: Actor,
    input: LoyaltyTransactionsQueryInput,
  ): Promise<Result<LoyaltyTransactionView[], LoyaltyDomainError>> {
    if (actor.kind !== "customer") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const account = await this.repository.findAccountByCustomer(actor.customerId);
    if (!account) {
      return ok([]);
    }
    const rows = await this.repository.listTransactions(account.id, input.limit);
    return ok(rows.map(toTransactionView));
  }

  /** Regalos con ventana abierta hoy — público (también sirve de marketing). */
  public async openRewards(): Promise<Result<LoyaltyRewardView[], LoyaltyDomainError>> {
    const rows = await this.repository.listRewards({ onlyOpen: true, now: new Date() });
    return ok(rows.map(toRewardView));
  }

  /** Info pública del programa (tasa y estado) — para marketing en la PDP. */
  public async programInfo(): Promise<Result<LoyaltyProgramConfig, LoyaltyDomainError>> {
    return ok(await this.repository.getConfig());
  }

  public async redeem(
    actor: Actor,
    input: RedeemRewardInput,
  ): Promise<Result<{ redemption: LoyaltyRedemptionView; balance: number }, LoyaltyDomainError>> {
    if (actor.kind !== "customer") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const config = await this.repository.getConfig();
    if (!config.isEnabled) {
      return err({ type: "PROGRAM_DISABLED" });
    }
    const result = await this.repository.redeemReward({
      customerId: actor.customerId,
      rewardId: input.rewardId,
      code: generateRedemptionCode(),
      idempotencyKey: input.idempotencyKey ?? null,
      now: new Date(),
    });
    switch (result.type) {
      case "OK":
        return ok({ redemption: toRedemptionView(result.redemption), balance: result.balance });
      case "DUPLICATE": {
        const account = await this.repository.findAccountByCustomer(actor.customerId);
        return ok({
          redemption: toRedemptionView(result.redemption),
          balance: account?.balance ?? 0,
        });
      }
      case "REWARD_NOT_FOUND":
        return err({ type: "REWARD_NOT_FOUND" });
      case "REWARD_NOT_AVAILABLE":
        return err({ type: "REWARD_NOT_AVAILABLE" });
      case "OUT_OF_STOCK":
        return err({ type: "OUT_OF_STOCK" });
      case "INSUFFICIENT_POINTS":
        return err({ type: "INSUFFICIENT_POINTS", balance: result.balance });
    }
  }

  public async myRedemptions(
    actor: Actor,
    input: LoyaltyTransactionsQueryInput,
  ): Promise<Result<LoyaltyRedemptionView[], LoyaltyDomainError>> {
    if (actor.kind !== "customer") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const rows = await this.repository.listRedemptionsByCustomer(actor.customerId, input.limit);
    return ok(rows.map(toRedemptionView));
  }

  // -------------------------------------------------------------------------
  // CloudDigital (cliente)
  // -------------------------------------------------------------------------

  public async myCloudDigital(
    actor: Actor,
  ): Promise<Result<CloudDigitalMembershipView | null, LoyaltyDomainError>> {
    if (actor.kind !== "customer") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const membership = await this.repository.findMembership(actor.customerId);
    return ok(membership ? toMembershipView(membership) : null);
  }

  public async joinCloudDigital(
    actor: Actor,
  ): Promise<Result<CloudDigitalMembershipView, LoyaltyDomainError>> {
    if (actor.kind !== "customer") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const membership = await this.repository.joinCloudDigital(actor.customerId);
    return ok(toMembershipView(membership));
  }

  /** Beneficios activos; los códigos solo se revelan a membresías ACTIVE. */
  public async cloudDigitalBenefits(
    actor: Actor,
  ): Promise<Result<CloudDigitalBenefitView[], LoyaltyDomainError>> {
    if (actor.kind !== "customer") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const [membership, rows] = await Promise.all([
      this.repository.findMembership(actor.customerId),
      this.repository.listBenefits(true),
    ]);
    const revealCode = membership?.status === CloudDigitalStatus.ACTIVE;
    return ok(rows.map((row) => toBenefitView(row, revealCode)));
  }

  // -------------------------------------------------------------------------
  // Eventos de órdenes (invocado por el subscriber, actor implícito system)
  // -------------------------------------------------------------------------

  /** Acredita CloudPoints al entregarse una orden. Idempotente por orden. */
  public async handleOrderDelivered(orderId: string): Promise<void> {
    const config = await this.repository.getConfig();
    if (!config.isEnabled || config.pointsPer1000 <= 0) {
      return;
    }
    const info = await this.repository.getOrderLoyaltyInfo(orderId);
    if (!info || !info.customerId) {
      return;
    }
    const points = computeEarnedPoints(info.totalMinor, config.pointsPer1000);
    if (points <= 0) {
      return;
    }
    await this.repository.earnPointsForOrder({
      customerId: info.customerId,
      orderId,
      points,
      reason: `Compra entregada ${info.orderNumber}`,
      idempotencyKey: earnIdempotencyKey(orderId),
    });
  }

  /** Revierte el EARN si la orden se cancela/devuelve. Idempotente. */
  public async handleOrderCancelled(orderId: string): Promise<void> {
    const info = await this.repository.getOrderLoyaltyInfo(orderId);
    const orderNumber = info?.orderNumber ?? orderId;
    await this.repository.reverseOrderPoints({
      orderId,
      reason: `Orden ${orderNumber} cancelada`,
      idempotencyKey: orderReversalIdempotencyKey(orderId),
    });
  }

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  public async getConfig(actor: Actor): Promise<Result<LoyaltyProgramConfig, LoyaltyDomainError>> {
    if (!canViewLoyaltyAdmin(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    return ok(await this.repository.getConfig());
  }

  public async updateConfig(
    actor: Actor,
    input: UpdateLoyaltyConfigInput,
  ): Promise<Result<LoyaltyProgramConfig, LoyaltyDomainError>> {
    if (!canManageLoyalty(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    return ok(await this.repository.updateConfig(input));
  }

  public async stats(actor: Actor): Promise<Result<LoyaltyProgramStats, LoyaltyDomainError>> {
    if (!canViewLoyaltyAdmin(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    return ok(await this.repository.getStats());
  }

  public async listRewardsAdmin(
    actor: Actor,
  ): Promise<Result<LoyaltyRewardView[], LoyaltyDomainError>> {
    if (!canViewLoyaltyAdmin(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const rows = await this.repository.listRewards({ onlyOpen: false, now: new Date() });
    return ok(rows.map(toRewardView));
  }

  public async upsertReward(
    actor: Actor,
    input: UpsertLoyaltyRewardInput,
  ): Promise<Result<LoyaltyRewardView, LoyaltyDomainError>> {
    if (!canManageLoyalty(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const row = await this.repository.upsertReward({
      id: input.id ?? uuidv7(),
      title: input.title,
      description: input.description,
      kind: input.kind,
      pointsCost: input.pointsCost,
      stock: input.stock,
      imageId: input.imageId,
      availableFrom: input.availableFrom,
      availableUntil: input.availableUntil,
      isActive: input.isActive,
      position: input.position,
    });
    return ok(toRewardView(row));
  }

  public async listRedemptions(
    actor: Actor,
    input: ListLoyaltyRedemptionsInput,
  ): Promise<Result<LoyaltyAdminRedemptionView[], LoyaltyDomainError>> {
    if (!canViewLoyaltyAdmin(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const rows = await this.repository.listRedemptionsAdmin({
      status: input.status,
      limit: input.limit,
    });
    return ok(rows.map(toAdminRedemptionView));
  }

  public async resolveRedemption(
    actor: Actor,
    input: ResolveRedemptionInput,
  ): Promise<Result<LoyaltyRedemptionView, LoyaltyDomainError>> {
    if (!canManageLoyalty(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const result = await this.repository.resolveRedemption({
      redemptionId: input.redemptionId,
      action: input.action,
      note: input.note,
    });
    switch (result.type) {
      case "OK":
        return ok(toRedemptionView(result.redemption));
      case "NOT_FOUND":
        return err({ type: "REDEMPTION_NOT_FOUND" });
      case "INVALID_STATE":
        return err({ type: "REDEMPTION_INVALID_STATE" });
    }
  }

  public async adjustPoints(
    actor: Actor,
    input: AdjustLoyaltyPointsInput,
  ): Promise<Result<{ balance: number }, LoyaltyDomainError>> {
    if (!canManageLoyalty(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const result = await this.repository.adjustPoints({
      customerId: input.customerId,
      points: input.points,
      reason: input.reason,
    });
    switch (result.type) {
      case "OK":
        return ok({ balance: result.account.balance });
      case "INSUFFICIENT_POINTS":
        return err({ type: "INSUFFICIENT_POINTS", balance: result.balance });
      case "CUSTOMER_NOT_FOUND":
        return err({ type: "CUSTOMER_NOT_FOUND" });
    }
  }

  public async listMemberships(
    actor: Actor,
    input: ListCloudDigitalMembershipsInput,
  ): Promise<Result<CloudDigitalAdminMembershipView[], LoyaltyDomainError>> {
    if (!canViewLoyaltyAdmin(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const rows = await this.repository.listMemberships({
      status: input.status,
      limit: input.limit,
    });
    return ok(rows.map(toAdminMembershipView));
  }

  public async setMembershipStatus(
    actor: Actor,
    input: SetCloudDigitalMembershipStatusInput,
  ): Promise<Result<CloudDigitalMembershipView, LoyaltyDomainError>> {
    if (!canManageLoyalty(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const row = await this.repository.setMembershipStatus(input.customerId, input.status);
    if (!row) {
      return err({ type: "MEMBERSHIP_NOT_FOUND" });
    }
    return ok(toMembershipView(row));
  }

  public async listBenefitsAdmin(
    actor: Actor,
  ): Promise<Result<CloudDigitalBenefitView[], LoyaltyDomainError>> {
    if (!canViewLoyaltyAdmin(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const rows = await this.repository.listBenefits(false);
    return ok(rows.map((row) => toBenefitView(row, true)));
  }

  public async upsertBenefit(
    actor: Actor,
    input: UpsertCloudDigitalBenefitInput,
  ): Promise<Result<CloudDigitalBenefitView, LoyaltyDomainError>> {
    if (!canManageLoyalty(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const row = await this.repository.upsertBenefit({
      id: input.id ?? uuidv7(),
      title: input.title,
      description: input.description,
      partner: input.partner,
      discountLabel: input.discountLabel,
      code: input.code,
      url: input.url,
      isActive: input.isActive,
      position: input.position,
    });
    return ok(toBenefitView(row, true));
  }
}
