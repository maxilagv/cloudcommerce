import {
  AdminRole,
  CloudDigitalStatus,
  LoyaltyRedemptionStatus,
  LoyaltyRewardKind,
  LoyaltyTransactionType,
  type Actor,
} from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { v7 as uuidv7 } from "uuid";
import {
  computeEarnedPoints,
  isRewardRedeemable,
} from "../../domain/loyalty-policies.js";
import { LoyaltyService } from "../../application/loyalty-service.js";
import type {
  AdjustPointsRecord,
  AdjustPointsResult,
  AdminMembershipRow,
  AdminRedemptionRow,
  CloudDigitalBenefitRow,
  CloudDigitalMembershipRow,
  EarnPointsRecord,
  EarnResult,
  LoyaltyAccountRow,
  LoyaltyConfigRow,
  LoyaltyLedgerRow,
  LoyaltyRedemptionRow,
  LoyaltyRepository,
  LoyaltyRewardRow,
  LoyaltyStatsRow,
  OrderLoyaltyInfo,
  RedeemRecord,
  RedeemResult,
  ResolveRedemptionRecord,
  ResolveRedemptionResult,
  UpsertBenefitRecord,
  UpsertRewardRecord,
} from "../../application/loyalty-repository.js";
import { isRewardWindowOpen } from "../../domain/loyalty-policies.js";

const CUSTOMER_ID = "018f0000-0000-7000-8000-000000000001";
const ORDER_ID = "018f0000-0000-7000-8000-00000000000a";

const customerActor: Actor = { kind: "customer", customerId: CUSTOMER_ID };
const ownerActor: Actor = {
  kind: "admin",
  userId: "018f0000-0000-7000-8000-0000000000ad",
  role: AdminRole.OWNER,
  sessionId: "sess-1",
};
const supportActor: Actor = {
  kind: "admin",
  userId: "018f0000-0000-7000-8000-0000000000ae",
  role: AdminRole.SUPPORT,
  sessionId: "sess-2",
};

/**
 * Repo in-memory que replica las invariantes del Drizzle real: idempotencia
 * por clave, ledger firmado + balance cacheado, stock y estados de canje.
 */
class FakeLoyaltyRepository implements LoyaltyRepository {
  public config: LoyaltyConfigRow = { pointsPer1000: 1, isEnabled: true };
  public accounts = new Map<string, LoyaltyAccountRow>();
  public ledger: LoyaltyLedgerRow[] = [];
  public rewards = new Map<string, LoyaltyRewardRow>();
  public redemptions = new Map<string, LoyaltyRedemptionRow>();
  public memberships = new Map<string, CloudDigitalMembershipRow>();
  public benefits = new Map<string, CloudDigitalBenefitRow>();
  public orders = new Map<string, OrderLoyaltyInfo>();
  public knownCustomers = new Set<string>([CUSTOMER_ID]);
  private idempotencyKeys = new Set<string>();

  public async getConfig(): Promise<LoyaltyConfigRow> {
    return { ...this.config };
  }

  public async updateConfig(config: LoyaltyConfigRow): Promise<LoyaltyConfigRow> {
    this.config = { ...config };
    return { ...this.config };
  }

  public async findAccountByCustomer(customerId: string): Promise<LoyaltyAccountRow | null> {
    return this.accounts.get(customerId) ?? null;
  }

  public async listTransactions(accountId: string, limit: number): Promise<LoyaltyLedgerRow[]> {
    return this.ledger
      .filter((entry) => entry.accountId === accountId)
      .slice(-limit)
      .reverse();
  }

  private ensureAccount(customerId: string): LoyaltyAccountRow {
    const existing = this.accounts.get(customerId);
    if (existing) {
      return existing;
    }
    const account: LoyaltyAccountRow = {
      id: uuidv7(),
      customerId,
      balance: 0,
      lifetimeEarned: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.accounts.set(customerId, account);
    return account;
  }

  private appendLedger(entry: Omit<LoyaltyLedgerRow, "id" | "createdAt">): LoyaltyLedgerRow {
    const row: LoyaltyLedgerRow = { ...entry, id: uuidv7(), createdAt: new Date() };
    this.ledger.push(row);
    return row;
  }

  public async earnPointsForOrder(record: EarnPointsRecord): Promise<EarnResult> {
    if (this.idempotencyKeys.has(record.idempotencyKey)) {
      return { applied: false };
    }
    this.idempotencyKeys.add(record.idempotencyKey);
    const account = this.ensureAccount(record.customerId);
    this.appendLedger({
      accountId: account.id,
      type: LoyaltyTransactionType.EARN,
      points: record.points,
      orderId: record.orderId,
      redemptionId: null,
      reason: record.reason,
    });
    account.balance += record.points;
    account.lifetimeEarned += record.points;
    return { applied: true };
  }

  public async reverseOrderPoints(record: {
    orderId: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<{ reversedPoints: number } | null> {
    const earn = this.ledger.find(
      (entry) => entry.orderId === record.orderId && entry.type === LoyaltyTransactionType.EARN,
    );
    if (!earn || this.idempotencyKeys.has(record.idempotencyKey)) {
      return null;
    }
    this.idempotencyKeys.add(record.idempotencyKey);
    this.appendLedger({
      accountId: earn.accountId,
      type: LoyaltyTransactionType.REVERSAL,
      points: -earn.points,
      orderId: record.orderId,
      redemptionId: null,
      reason: record.reason,
    });
    const account = [...this.accounts.values()].find((a) => a.id === earn.accountId)!;
    account.balance -= earn.points;
    return { reversedPoints: earn.points };
  }

  public async adjustPoints(record: AdjustPointsRecord): Promise<AdjustPointsResult> {
    if (!this.knownCustomers.has(record.customerId)) {
      return { type: "CUSTOMER_NOT_FOUND" };
    }
    const account = this.ensureAccount(record.customerId);
    if (record.points < 0 && account.balance + record.points < 0) {
      return { type: "INSUFFICIENT_POINTS", balance: account.balance };
    }
    this.appendLedger({
      accountId: account.id,
      type: LoyaltyTransactionType.ADJUST,
      points: record.points,
      orderId: null,
      redemptionId: null,
      reason: record.reason,
    });
    account.balance += record.points;
    return { type: "OK", account: { ...account } };
  }

  public async listRewards(filter: { onlyOpen: boolean; now: Date }): Promise<LoyaltyRewardRow[]> {
    const rows = [...this.rewards.values()];
    return filter.onlyOpen ? rows.filter((row) => isRewardWindowOpen(row, filter.now)) : rows;
  }

  public async upsertReward(record: UpsertRewardRecord): Promise<LoyaltyRewardRow> {
    const existing = this.rewards.get(record.id);
    const row: LoyaltyRewardRow = {
      ...record,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    this.rewards.set(record.id, row);
    return row;
  }

  public async redeemReward(record: RedeemRecord): Promise<RedeemResult> {
    if (record.idempotencyKey) {
      const existing = [...this.redemptions.values()].find(
        (r) => r.code !== record.code && this.idempotencyKeys.has(`redeem-input:${record.idempotencyKey}`),
      );
      if (existing) {
        return { type: "DUPLICATE", redemption: existing };
      }
    }
    const reward = this.rewards.get(record.rewardId);
    if (!reward) {
      return { type: "REWARD_NOT_FOUND" };
    }
    if (!isRewardWindowOpen(reward, record.now)) {
      return { type: "REWARD_NOT_AVAILABLE" };
    }
    if (reward.stock !== null && reward.stock <= 0) {
      return { type: "OUT_OF_STOCK" };
    }
    const account = this.ensureAccount(record.customerId);
    if (account.balance < reward.pointsCost) {
      return { type: "INSUFFICIENT_POINTS", balance: account.balance };
    }
    if (record.idempotencyKey) {
      this.idempotencyKeys.add(`redeem-input:${record.idempotencyKey}`);
    }
    const redemption: LoyaltyRedemptionRow = {
      id: uuidv7(),
      accountId: account.id,
      rewardId: reward.id,
      rewardTitle: reward.title,
      pointsSpent: reward.pointsCost,
      status: LoyaltyRedemptionStatus.PENDING,
      code: record.code,
      note: null,
      createdAt: new Date(),
      fulfilledAt: null,
      cancelledAt: null,
    };
    this.redemptions.set(redemption.id, redemption);
    this.appendLedger({
      accountId: account.id,
      type: LoyaltyTransactionType.REDEEM,
      points: -reward.pointsCost,
      orderId: null,
      redemptionId: redemption.id,
      reason: `Canje de "${reward.title}"`,
    });
    account.balance -= reward.pointsCost;
    if (reward.stock !== null) {
      reward.stock -= 1;
    }
    return { type: "OK", redemption, balance: account.balance };
  }

  public async listRedemptionsByCustomer(
    customerId: string,
    limit: number,
  ): Promise<LoyaltyRedemptionRow[]> {
    const account = this.accounts.get(customerId);
    if (!account) {
      return [];
    }
    return [...this.redemptions.values()]
      .filter((r) => r.accountId === account.id)
      .slice(0, limit);
  }

  public async listRedemptionsAdmin(filter: {
    status?: LoyaltyRedemptionStatus | undefined;
    limit: number;
  }): Promise<AdminRedemptionRow[]> {
    return [...this.redemptions.values()]
      .filter((r) => !filter.status || r.status === filter.status)
      .slice(0, filter.limit)
      .map((r) => ({ ...r, customerId: CUSTOMER_ID, customerName: null, customerEmail: null }));
  }

  public async resolveRedemption(
    record: ResolveRedemptionRecord,
  ): Promise<ResolveRedemptionResult> {
    const row = this.redemptions.get(record.redemptionId);
    if (!row) {
      return { type: "NOT_FOUND" };
    }
    if (row.status !== LoyaltyRedemptionStatus.PENDING) {
      return { type: "INVALID_STATE" };
    }
    if (record.action === "FULFILL") {
      row.status = LoyaltyRedemptionStatus.FULFILLED;
      row.fulfilledAt = new Date();
      return { type: "OK", redemption: { ...row } };
    }
    row.status = LoyaltyRedemptionStatus.CANCELLED;
    row.cancelledAt = new Date();
    const account = [...this.accounts.values()].find((a) => a.id === row.accountId)!;
    this.appendLedger({
      accountId: account.id,
      type: LoyaltyTransactionType.REVERSAL,
      points: row.pointsSpent,
      orderId: null,
      redemptionId: row.id,
      reason: `Canje "${row.rewardTitle}" cancelado`,
    });
    account.balance += row.pointsSpent;
    const reward = this.rewards.get(row.rewardId);
    if (reward && reward.stock !== null) {
      reward.stock += 1;
    }
    return { type: "OK", redemption: { ...row } };
  }

  public async getOrderLoyaltyInfo(orderId: string): Promise<OrderLoyaltyInfo | null> {
    return this.orders.get(orderId) ?? null;
  }

  public async getStats(): Promise<LoyaltyStatsRow> {
    return { accounts: this.accounts.size, pointsIssued: 0, pointsRedeemed: 0, pendingRedemptions: 0 };
  }

  public async findMembership(customerId: string): Promise<CloudDigitalMembershipRow | null> {
    return this.memberships.get(customerId) ?? null;
  }

  public async joinCloudDigital(customerId: string): Promise<CloudDigitalMembershipRow> {
    const existing = this.memberships.get(customerId);
    if (existing) {
      return existing;
    }
    const row: CloudDigitalMembershipRow = {
      id: uuidv7(),
      customerId,
      status: CloudDigitalStatus.WAITLIST,
      joinedAt: new Date(),
      activatedAt: null,
      revokedAt: null,
    };
    this.memberships.set(customerId, row);
    return row;
  }

  public async setMembershipStatus(
    customerId: string,
    status: CloudDigitalStatus,
  ): Promise<CloudDigitalMembershipRow | null> {
    const row = this.memberships.get(customerId);
    if (!row) {
      return null;
    }
    row.status = status;
    if (status === CloudDigitalStatus.ACTIVE && !row.activatedAt) {
      row.activatedAt = new Date();
    }
    return { ...row };
  }

  public async listMemberships(filter: {
    status?: CloudDigitalStatus | undefined;
    limit: number;
  }): Promise<AdminMembershipRow[]> {
    return [...this.memberships.values()]
      .filter((m) => !filter.status || m.status === filter.status)
      .slice(0, filter.limit)
      .map((m) => ({ ...m, customerName: null, customerEmail: null }));
  }

  public async listBenefits(onlyActive: boolean): Promise<CloudDigitalBenefitRow[]> {
    return [...this.benefits.values()].filter((b) => !onlyActive || b.isActive);
  }

  public async upsertBenefit(record: UpsertBenefitRecord): Promise<CloudDigitalBenefitRow> {
    this.benefits.set(record.id, { ...record });
    return { ...record };
  }
}

const openReward = (overrides: Partial<LoyaltyRewardRow> = {}): LoyaltyRewardRow => ({
  id: uuidv7(),
  title: "Auriculares CloudSound",
  description: "",
  kind: LoyaltyRewardKind.PHYSICAL,
  pointsCost: 100,
  stock: 5,
  imageId: null,
  availableFrom: null,
  availableUntil: null,
  isActive: true,
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildService = (repository = new FakeLoyaltyRepository()) => ({
  repository,
  service: new LoyaltyService(repository),
});

describe("políticas puras", () => {
  it("computeEarnedPoints redondea SIEMPRE hacia abajo", () => {
    expect(computeEarnedPoints(100_000, 1)).toBe(1); // $1.000 → 1 punto
    expect(computeEarnedPoints(199_999, 1)).toBe(1); // $1.999,99 → 1 punto
    expect(computeEarnedPoints(99_999, 1)).toBe(0); // $999,99 → nada
    expect(computeEarnedPoints(550_000, 2)).toBe(10); // $5.500 a 2 pts → 10
    expect(computeEarnedPoints(0, 5)).toBe(0);
    expect(computeEarnedPoints(100_000, 0)).toBe(0);
  });

  it("isRewardRedeemable respeta ventana y stock", () => {
    const now = new Date("2026-07-06T12:00:00Z");
    const base = openReward();
    expect(isRewardRedeemable(base, now)).toBe(true);
    expect(isRewardRedeemable({ ...base, isActive: false }, now)).toBe(false);
    expect(isRewardRedeemable({ ...base, stock: 0 }, now)).toBe(false);
    expect(isRewardRedeemable({ ...base, stock: null }, now)).toBe(true);
    expect(
      isRewardRedeemable({ ...base, availableFrom: new Date("2026-07-07T00:00:00Z") }, now),
    ).toBe(false);
    expect(
      isRewardRedeemable({ ...base, availableUntil: new Date("2026-07-06T00:00:00Z") }, now),
    ).toBe(false);
  });
});

describe("acreditación por orden entregada", () => {
  it("acredita según la tasa y es idempotente por orden", async () => {
    const { repository, service } = buildService();
    repository.config = { pointsPer1000: 2, isEnabled: true };
    repository.orders.set(ORDER_ID, {
      orderId: ORDER_ID,
      orderNumber: "ORD-2026-000001",
      customerId: CUSTOMER_ID,
      totalMinor: 550_000, // $5.500 → 5 * 2 = 10 puntos
    });

    await service.handleOrderDelivered(ORDER_ID);
    await service.handleOrderDelivered(ORDER_ID); // repetido (retry del bus)

    const account = repository.accounts.get(CUSTOMER_ID);
    expect(account?.balance).toBe(10);
    expect(account?.lifetimeEarned).toBe(10);
    expect(repository.ledger).toHaveLength(1);
  });

  it("no acredita con el programa deshabilitado ni sin cliente", async () => {
    const { repository, service } = buildService();
    repository.config = { pointsPer1000: 1, isEnabled: false };
    repository.orders.set(ORDER_ID, {
      orderId: ORDER_ID,
      orderNumber: "ORD-2026-000001",
      customerId: CUSTOMER_ID,
      totalMinor: 900_000,
    });
    await service.handleOrderDelivered(ORDER_ID);
    expect(repository.accounts.size).toBe(0);

    repository.config = { pointsPer1000: 1, isEnabled: true };
    repository.orders.set(ORDER_ID, {
      orderId: ORDER_ID,
      orderNumber: "ORD-2026-000001",
      customerId: null,
      totalMinor: 900_000,
    });
    await service.handleOrderDelivered(ORDER_ID);
    expect(repository.accounts.size).toBe(0);
  });

  it("la cancelación revierte el EARN exactamente una vez", async () => {
    const { repository, service } = buildService();
    repository.orders.set(ORDER_ID, {
      orderId: ORDER_ID,
      orderNumber: "ORD-2026-000001",
      customerId: CUSTOMER_ID,
      totalMinor: 300_000, // 3 puntos
    });
    await service.handleOrderDelivered(ORDER_ID);
    expect(repository.accounts.get(CUSTOMER_ID)?.balance).toBe(3);

    await service.handleOrderCancelled(ORDER_ID);
    await service.handleOrderCancelled(ORDER_ID); // repetido

    const account = repository.accounts.get(CUSTOMER_ID);
    expect(account?.balance).toBe(0);
    expect(
      repository.ledger.filter((e) => e.type === LoyaltyTransactionType.REVERSAL),
    ).toHaveLength(1);
  });

  it("cancelar una orden que nunca acreditó no hace nada", async () => {
    const { repository, service } = buildService();
    await service.handleOrderCancelled(ORDER_ID);
    expect(repository.ledger).toHaveLength(0);
  });
});

describe("canje de regalos", () => {
  const seedPoints = async (repository: FakeLoyaltyRepository, points: number) => {
    await repository.earnPointsForOrder({
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      points,
      reason: "seed",
      idempotencyKey: `seed:${points}`,
    });
  };

  it("canje feliz: debita saldo, descuenta stock y emite código CP-", async () => {
    const { repository, service } = buildService();
    const reward = openReward({ pointsCost: 100, stock: 2 });
    repository.rewards.set(reward.id, reward);
    await seedPoints(repository, 250);

    const result = await service.redeem(customerActor, { rewardId: reward.id });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.balance).toBe(150);
      expect(result.value.redemption.code).toMatch(/^CP-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}$/);
      expect(result.value.redemption.status).toBe(LoyaltyRedemptionStatus.PENDING);
    }
    expect(reward.stock).toBe(1);
  });

  it("rechaza canje sin saldo suficiente", async () => {
    const { repository, service } = buildService();
    const reward = openReward({ pointsCost: 500 });
    repository.rewards.set(reward.id, reward);
    await seedPoints(repository, 100);

    const result = await service.redeem(customerActor, { rewardId: reward.id });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INSUFFICIENT_POINTS");
    }
    expect(repository.accounts.get(CUSTOMER_ID)?.balance).toBe(100);
  });

  it("rechaza canje fuera de la ventana de rotación", async () => {
    const { repository, service } = buildService();
    const reward = openReward({
      availableUntil: new Date(Date.now() - 60_000), // rotación ya cerrada
    });
    repository.rewards.set(reward.id, reward);
    await seedPoints(repository, 1_000);

    const result = await service.redeem(customerActor, { rewardId: reward.id });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("REWARD_NOT_AVAILABLE");
    }
  });

  it("rechaza canje sin stock", async () => {
    const { repository, service } = buildService();
    const reward = openReward({ stock: 0 });
    repository.rewards.set(reward.id, reward);
    await seedPoints(repository, 1_000);

    const result = await service.redeem(customerActor, { rewardId: reward.id });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("OUT_OF_STOCK");
    }
  });

  it("rechaza canje con el programa pausado", async () => {
    const { repository, service } = buildService();
    repository.config = { pointsPer1000: 1, isEnabled: false };
    const reward = openReward();
    repository.rewards.set(reward.id, reward);

    const result = await service.redeem(customerActor, { rewardId: reward.id });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("PROGRAM_DISABLED");
    }
  });

  it("cancelar un canje devuelve puntos y stock; no se puede resolver dos veces", async () => {
    const { repository, service } = buildService();
    const reward = openReward({ pointsCost: 100, stock: 1 });
    repository.rewards.set(reward.id, reward);
    await seedPoints(repository, 100);

    const redeemed = await service.redeem(customerActor, { rewardId: reward.id });
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;
    const redemptionId = redeemed.value.redemption.id;
    expect(repository.accounts.get(CUSTOMER_ID)?.balance).toBe(0);
    expect(reward.stock).toBe(0);

    const cancelled = await service.resolveRedemption(ownerActor, {
      redemptionId,
      action: "CANCEL",
    });
    expect(cancelled.ok).toBe(true);
    expect(repository.accounts.get(CUSTOMER_ID)?.balance).toBe(100);
    expect(reward.stock).toBe(1);

    const again = await service.resolveRedemption(ownerActor, {
      redemptionId,
      action: "FULFILL",
    });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.type).toBe("REDEMPTION_INVALID_STATE");
    }
  });
});

describe("ajustes y permisos de admin", () => {
  it("un ajuste negativo nunca deja el saldo bajo cero", async () => {
    const { repository, service } = buildService();
    await repository.earnPointsForOrder({
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      points: 50,
      reason: "seed",
      idempotencyKey: "seed:50",
    });

    const result = await service.adjustPoints(ownerActor, {
      customerId: CUSTOMER_ID,
      points: -80,
      reason: "corrección de prueba",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INSUFFICIENT_POINTS");
    }
    expect(repository.accounts.get(CUSTOMER_ID)?.balance).toBe(50);
  });

  it("solo OWNER/ADMIN pueden mutar el programa; SUPPORT puede leer", async () => {
    const { service } = buildService();

    const write = await service.updateConfig(supportActor, { pointsPer1000: 5, isEnabled: true });
    expect(write.ok).toBe(false);
    if (!write.ok) {
      expect(write.error.type).toBe("FORBIDDEN");
    }

    const read = await service.getConfig(supportActor);
    expect(read.ok).toBe(true);

    const customerRead = await service.getConfig(customerActor);
    expect(customerRead.ok).toBe(false);
  });
});

describe("CloudDigital", () => {
  it("unirse es idempotente y arranca en lista de espera", async () => {
    const { repository, service } = buildService();
    const first = await service.joinCloudDigital(customerActor);
    const second = await service.joinCloudDigital(customerActor);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.status).toBe(CloudDigitalStatus.WAITLIST);
      expect(second.value.joinedAt).toBe(first.value.joinedAt);
    }
    expect(repository.memberships.size).toBe(1);
  });

  it("los códigos de beneficios solo se revelan a membresías ACTIVE", async () => {
    const { repository, service } = buildService();
    repository.benefits.set("b1", {
      id: "b1",
      title: "Hosting LayerCloud",
      description: "",
      partner: "LayerCloud",
      discountLabel: "-30%",
      code: "LAYER30",
      url: null,
      isActive: true,
      position: 0,
    });

    await service.joinCloudDigital(customerActor);
    const waitlisted = await service.cloudDigitalBenefits(customerActor);
    expect(waitlisted.ok).toBe(true);
    if (waitlisted.ok) {
      expect(waitlisted.value[0]?.code).toBeNull();
    }

    await service.setMembershipStatus(ownerActor, {
      customerId: CUSTOMER_ID,
      status: CloudDigitalStatus.ACTIVE,
    });
    const active = await service.cloudDigitalBenefits(customerActor);
    expect(active.ok).toBe(true);
    if (active.ok) {
      expect(active.value[0]?.code).toBe("LAYER30");
    }
  });
});
