import {
  cloudDigitalBenefit,
  cloudDigitalMembership,
  customer,
  loyaltyAccount,
  loyaltyProgramConfig,
  loyaltyRedemption,
  loyaltyReward,
  loyaltyTransaction,
  order,
} from "@cloudcommerce/database";
import {
  CloudDigitalStatus,
  LoyaltyRedemptionStatus,
  LoyaltyTransactionType,
} from "@cloudcommerce/types";
import { and, desc, eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import { isRewardWindowOpen } from "../../domain/loyalty-policies.js";
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

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const CONFIG_ID = "default";

export class DrizzleLoyaltyRepository implements LoyaltyRepository {
  public constructor(private readonly db: Database) {}

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------

  public async getConfig(): Promise<LoyaltyConfigRow> {
    const row = await this.db.query.loyaltyProgramConfig.findFirst({
      where: eq(loyaltyProgramConfig.id, CONFIG_ID),
    });
    return { pointsPer1000: row?.pointsPer1000 ?? 1, isEnabled: row?.isEnabled ?? true };
  }

  public async updateConfig(config: LoyaltyConfigRow): Promise<LoyaltyConfigRow> {
    await this.db
      .insert(loyaltyProgramConfig)
      .values({ id: CONFIG_ID, ...config, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: loyaltyProgramConfig.id,
        set: { pointsPer1000: config.pointsPer1000, isEnabled: config.isEnabled, updatedAt: new Date() },
      });
    return this.getConfig();
  }

  // -------------------------------------------------------------------------
  // Cuentas + ledger
  // -------------------------------------------------------------------------

  public async findAccountByCustomer(customerId: string): Promise<LoyaltyAccountRow | null> {
    const row = await this.db.query.loyaltyAccount.findFirst({
      where: eq(loyaltyAccount.customerId, customerId),
    });
    return row ?? null;
  }

  public async listTransactions(accountId: string, limit: number): Promise<LoyaltyLedgerRow[]> {
    return this.db.query.loyaltyTransaction.findMany({
      where: eq(loyaltyTransaction.accountId, accountId),
      orderBy: desc(loyaltyTransaction.createdAt),
      limit,
    });
  }

  /** Crea (o encuentra) la cuenta del cliente dentro de la transacción dada. */
  private async ensureAccount(tx: Tx, customerId: string): Promise<LoyaltyAccountRow> {
    const existing = await tx.query.loyaltyAccount.findFirst({
      where: eq(loyaltyAccount.customerId, customerId),
    });
    if (existing) {
      return existing;
    }
    const [created] = await tx
      .insert(loyaltyAccount)
      .values({ id: uuidv7(), customerId })
      .onConflictDoNothing({ target: loyaltyAccount.customerId })
      .returning();
    if (created) {
      return created;
    }
    // Carrera perdida contra otra transacción: la fila ya existe.
    const raced = await tx.query.loyaltyAccount.findFirst({
      where: eq(loyaltyAccount.customerId, customerId),
    });
    if (!raced) {
      throw new Error(`loyalty account for customer ${customerId} not found after upsert`);
    }
    return raced;
  }

  /** Bloquea la fila de la cuenta (FOR UPDATE) para operar sobre el saldo. */
  private async lockAccount(tx: Tx, accountId: string): Promise<LoyaltyAccountRow | null> {
    const [row] = await tx
      .select()
      .from(loyaltyAccount)
      .where(eq(loyaltyAccount.id, accountId))
      .for("update");
    return row ?? null;
  }

  public async earnPointsForOrder(record: EarnPointsRecord): Promise<EarnResult> {
    return this.db.transaction(async (tx) => {
      const account = await this.ensureAccount(tx, record.customerId);
      const [entry] = await tx
        .insert(loyaltyTransaction)
        .values({
          id: uuidv7(),
          accountId: account.id,
          type: LoyaltyTransactionType.EARN,
          points: record.points,
          orderId: record.orderId,
          reason: record.reason,
          idempotencyKey: record.idempotencyKey,
        })
        .onConflictDoNothing({ target: loyaltyTransaction.idempotencyKey })
        .returning();
      if (!entry) {
        return { applied: false };
      }
      await tx
        .update(loyaltyAccount)
        .set({
          balance: sql`${loyaltyAccount.balance} + ${record.points}`,
          lifetimeEarned: sql`${loyaltyAccount.lifetimeEarned} + ${record.points}`,
          updatedAt: new Date(),
        })
        .where(eq(loyaltyAccount.id, account.id));
      return { applied: true };
    });
  }

  public async reverseOrderPoints(record: {
    orderId: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<{ reversedPoints: number } | null> {
    return this.db.transaction(async (tx) => {
      const earn = await tx.query.loyaltyTransaction.findFirst({
        where: and(
          eq(loyaltyTransaction.orderId, record.orderId),
          eq(loyaltyTransaction.type, LoyaltyTransactionType.EARN),
        ),
      });
      if (!earn) {
        return null;
      }
      const [entry] = await tx
        .insert(loyaltyTransaction)
        .values({
          id: uuidv7(),
          accountId: earn.accountId,
          type: LoyaltyTransactionType.REVERSAL,
          points: -earn.points,
          orderId: record.orderId,
          reason: record.reason,
          idempotencyKey: record.idempotencyKey,
        })
        .onConflictDoNothing({ target: loyaltyTransaction.idempotencyKey })
        .returning();
      if (!entry) {
        // Ya se revirtió antes — idempotente.
        return null;
      }
      // El saldo puede quedar negativo si el cliente ya gastó esos puntos:
      // la deuda se descuenta de acreditaciones futuras.
      await tx
        .update(loyaltyAccount)
        .set({ balance: sql`${loyaltyAccount.balance} - ${earn.points}`, updatedAt: new Date() })
        .where(eq(loyaltyAccount.id, earn.accountId));
      return { reversedPoints: earn.points };
    });
  }

  public async adjustPoints(record: AdjustPointsRecord): Promise<AdjustPointsResult> {
    return this.db.transaction(async (tx) => {
      const exists = await tx.query.customer.findFirst({
        where: eq(customer.id, record.customerId),
        columns: { id: true },
      });
      if (!exists) {
        return { type: "CUSTOMER_NOT_FOUND" };
      }
      const account = await this.ensureAccount(tx, record.customerId);
      const locked = await this.lockAccount(tx, account.id);
      if (!locked) {
        return { type: "CUSTOMER_NOT_FOUND" };
      }
      if (record.points < 0 && locked.balance + record.points < 0) {
        return { type: "INSUFFICIENT_POINTS", balance: locked.balance };
      }
      await tx.insert(loyaltyTransaction).values({
        id: uuidv7(),
        accountId: locked.id,
        type: LoyaltyTransactionType.ADJUST,
        points: record.points,
        reason: record.reason,
      });
      const [updated] = await tx
        .update(loyaltyAccount)
        .set({ balance: sql`${loyaltyAccount.balance} + ${record.points}`, updatedAt: new Date() })
        .where(eq(loyaltyAccount.id, locked.id))
        .returning();
      return { type: "OK", account: updated! };
    });
  }

  // -------------------------------------------------------------------------
  // Recompensas
  // -------------------------------------------------------------------------

  public async listRewards(filter: { onlyOpen: boolean; now: Date }): Promise<LoyaltyRewardRow[]> {
    const rows = await this.db.query.loyaltyReward.findMany({
      orderBy: [loyaltyReward.position, loyaltyReward.pointsCost],
    });
    if (!filter.onlyOpen) {
      return rows;
    }
    return rows.filter((row) => isRewardWindowOpen(row, filter.now));
  }

  public async upsertReward(record: UpsertRewardRecord): Promise<LoyaltyRewardRow> {
    const [row] = await this.db
      .insert(loyaltyReward)
      .values({ ...record, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: loyaltyReward.id,
        set: {
          title: record.title,
          description: record.description,
          kind: record.kind,
          pointsCost: record.pointsCost,
          stock: record.stock,
          imageId: record.imageId,
          availableFrom: record.availableFrom,
          availableUntil: record.availableUntil,
          isActive: record.isActive,
          position: record.position,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row!;
  }

  // -------------------------------------------------------------------------
  // Canjes — la sección crítica del programa
  // -------------------------------------------------------------------------

  public async redeemReward(record: RedeemRecord): Promise<RedeemResult> {
    return this.db.transaction(async (tx) => {
      // Reintento idempotente: si esta clave ya canjeó, devolver ese canje.
      if (record.idempotencyKey) {
        const existing = await tx.query.loyaltyRedemption.findFirst({
          where: eq(loyaltyRedemption.idempotencyKey, record.idempotencyKey),
        });
        if (existing) {
          return { type: "DUPLICATE", redemption: existing };
        }
      }

      // Lock del regalo primero (orden estable de locks: reward → account).
      const [reward] = await tx
        .select()
        .from(loyaltyReward)
        .where(eq(loyaltyReward.id, record.rewardId))
        .for("update");
      if (!reward) {
        return { type: "REWARD_NOT_FOUND" };
      }
      if (!isRewardWindowOpen(reward, record.now)) {
        return { type: "REWARD_NOT_AVAILABLE" };
      }
      if (reward.stock !== null && reward.stock <= 0) {
        return { type: "OUT_OF_STOCK" };
      }

      const account = await this.ensureAccount(tx, record.customerId);
      const locked = await this.lockAccount(tx, account.id);
      if (!locked || locked.balance < reward.pointsCost) {
        return { type: "INSUFFICIENT_POINTS", balance: locked?.balance ?? 0 };
      }

      const redemptionId = uuidv7();
      const [redemption] = await tx
        .insert(loyaltyRedemption)
        .values({
          id: redemptionId,
          accountId: locked.id,
          rewardId: reward.id,
          rewardTitle: reward.title,
          pointsSpent: reward.pointsCost,
          status: LoyaltyRedemptionStatus.PENDING,
          code: record.code,
          idempotencyKey: record.idempotencyKey,
        })
        .returning();

      await tx.insert(loyaltyTransaction).values({
        id: uuidv7(),
        accountId: locked.id,
        type: LoyaltyTransactionType.REDEEM,
        points: -reward.pointsCost,
        redemptionId,
        reason: `Canje de "${reward.title}"`,
        idempotencyKey: `redeem:${redemptionId}`,
      });

      const [updatedAccount] = await tx
        .update(loyaltyAccount)
        .set({
          balance: sql`${loyaltyAccount.balance} - ${reward.pointsCost}`,
          updatedAt: new Date(),
        })
        .where(eq(loyaltyAccount.id, locked.id))
        .returning();

      if (reward.stock !== null) {
        await tx
          .update(loyaltyReward)
          .set({ stock: sql`${loyaltyReward.stock} - 1`, updatedAt: new Date() })
          .where(eq(loyaltyReward.id, reward.id));
      }

      return { type: "OK", redemption: redemption!, balance: updatedAccount!.balance };
    });
  }

  public async listRedemptionsByCustomer(
    customerId: string,
    limit: number,
  ): Promise<LoyaltyRedemptionRow[]> {
    const account = await this.findAccountByCustomer(customerId);
    if (!account) {
      return [];
    }
    return this.db.query.loyaltyRedemption.findMany({
      where: eq(loyaltyRedemption.accountId, account.id),
      orderBy: desc(loyaltyRedemption.createdAt),
      limit,
    });
  }

  public async listRedemptionsAdmin(filter: {
    status?: LoyaltyRedemptionStatus;
    limit: number;
  }): Promise<AdminRedemptionRow[]> {
    const rows = await this.db
      .select({
        redemption: loyaltyRedemption,
        customerId: loyaltyAccount.customerId,
        customerName: customer.displayName,
        customerEmail: customer.email,
      })
      .from(loyaltyRedemption)
      .innerJoin(loyaltyAccount, eq(loyaltyRedemption.accountId, loyaltyAccount.id))
      .innerJoin(customer, eq(loyaltyAccount.customerId, customer.id))
      .where(filter.status ? eq(loyaltyRedemption.status, filter.status) : undefined)
      .orderBy(desc(loyaltyRedemption.createdAt))
      .limit(filter.limit);
    return rows.map((row) => ({
      ...row.redemption,
      customerId: row.customerId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
    }));
  }

  public async resolveRedemption(
    record: ResolveRedemptionRecord,
  ): Promise<ResolveRedemptionResult> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(loyaltyRedemption)
        .where(eq(loyaltyRedemption.id, record.redemptionId))
        .for("update");
      if (!row) {
        return { type: "NOT_FOUND" };
      }
      if (row.status !== LoyaltyRedemptionStatus.PENDING) {
        return { type: "INVALID_STATE" };
      }

      if (record.action === "FULFILL") {
        const [updated] = await tx
          .update(loyaltyRedemption)
          .set({
            status: LoyaltyRedemptionStatus.FULFILLED,
            fulfilledAt: new Date(),
            note: record.note ?? row.note,
          })
          .where(eq(loyaltyRedemption.id, row.id))
          .returning();
        return { type: "OK", redemption: updated! };
      }

      // CANCEL: contra-asiento (+ puntos), restaurar stock y cerrar el canje.
      const [updated] = await tx
        .update(loyaltyRedemption)
        .set({
          status: LoyaltyRedemptionStatus.CANCELLED,
          cancelledAt: new Date(),
          note: record.note ?? row.note,
        })
        .where(eq(loyaltyRedemption.id, row.id))
        .returning();

      const [reversal] = await tx
        .insert(loyaltyTransaction)
        .values({
          id: uuidv7(),
          accountId: row.accountId,
          type: LoyaltyTransactionType.REVERSAL,
          points: row.pointsSpent,
          redemptionId: row.id,
          reason: `Canje "${row.rewardTitle}" cancelado`,
          idempotencyKey: `reversal:redemption:${row.id}`,
        })
        .onConflictDoNothing({ target: loyaltyTransaction.idempotencyKey })
        .returning();
      if (reversal) {
        await tx
          .update(loyaltyAccount)
          .set({
            balance: sql`${loyaltyAccount.balance} + ${row.pointsSpent}`,
            updatedAt: new Date(),
          })
          .where(eq(loyaltyAccount.id, row.accountId));
        const reward = await tx.query.loyaltyReward.findFirst({
          where: eq(loyaltyReward.id, row.rewardId),
        });
        if (reward?.stock !== null && reward?.stock !== undefined) {
          await tx
            .update(loyaltyReward)
            .set({ stock: sql`${loyaltyReward.stock} + 1`, updatedAt: new Date() })
            .where(eq(loyaltyReward.id, row.rewardId));
        }
      }
      return { type: "OK", redemption: updated! };
    });
  }

  // -------------------------------------------------------------------------
  // Órdenes / stats
  // -------------------------------------------------------------------------

  public async getOrderLoyaltyInfo(orderId: string): Promise<OrderLoyaltyInfo | null> {
    const row = await this.db.query.order.findFirst({
      where: eq(order.id, orderId),
      columns: { id: true, orderNumber: true, customerId: true, totalMinor: true },
    });
    if (!row) {
      return null;
    }
    return {
      orderId: row.id,
      orderNumber: row.orderNumber,
      customerId: row.customerId,
      totalMinor: row.totalMinor,
    };
  }

  public async getStats(): Promise<LoyaltyStatsRow> {
    const [accounts] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(loyaltyAccount);
    const [issued] = await this.db
      .select({ total: sql<number>`coalesce(sum(${loyaltyTransaction.points}), 0)::int` })
      .from(loyaltyTransaction)
      .where(eq(loyaltyTransaction.type, LoyaltyTransactionType.EARN));
    const [redeemed] = await this.db
      .select({ total: sql<number>`coalesce(sum(-${loyaltyTransaction.points}), 0)::int` })
      .from(loyaltyTransaction)
      .where(eq(loyaltyTransaction.type, LoyaltyTransactionType.REDEEM));
    const [pending] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(loyaltyRedemption)
      .where(eq(loyaltyRedemption.status, LoyaltyRedemptionStatus.PENDING));
    return {
      accounts: accounts?.count ?? 0,
      pointsIssued: issued?.total ?? 0,
      pointsRedeemed: redeemed?.total ?? 0,
      pendingRedemptions: pending?.count ?? 0,
    };
  }

  // -------------------------------------------------------------------------
  // CloudDigital
  // -------------------------------------------------------------------------

  public async findMembership(customerId: string): Promise<CloudDigitalMembershipRow | null> {
    const row = await this.db.query.cloudDigitalMembership.findFirst({
      where: eq(cloudDigitalMembership.customerId, customerId),
    });
    return row ?? null;
  }

  public async joinCloudDigital(customerId: string): Promise<CloudDigitalMembershipRow> {
    const [created] = await this.db
      .insert(cloudDigitalMembership)
      .values({ id: uuidv7(), customerId, status: CloudDigitalStatus.WAITLIST })
      .onConflictDoNothing({ target: cloudDigitalMembership.customerId })
      .returning();
    if (created) {
      return created;
    }
    const existing = await this.findMembership(customerId);
    if (!existing) {
      throw new Error(`clouddigital membership for ${customerId} not found after upsert`);
    }
    return existing;
  }

  public async setMembershipStatus(
    customerId: string,
    status: CloudDigitalStatus,
  ): Promise<CloudDigitalMembershipRow | null> {
    const now = new Date();
    const [row] = await this.db
      .update(cloudDigitalMembership)
      .set({
        status,
        activatedAt:
          status === CloudDigitalStatus.ACTIVE
            ? sql`coalesce(${cloudDigitalMembership.activatedAt}, ${now})`
            : cloudDigitalMembership.activatedAt,
        revokedAt: status === CloudDigitalStatus.REVOKED ? now : null,
        updatedAt: now,
      })
      .where(eq(cloudDigitalMembership.customerId, customerId))
      .returning();
    return row ?? null;
  }

  public async listMemberships(filter: {
    status?: CloudDigitalStatus;
    limit: number;
  }): Promise<AdminMembershipRow[]> {
    const rows = await this.db
      .select({
        membership: cloudDigitalMembership,
        customerName: customer.displayName,
        customerEmail: customer.email,
      })
      .from(cloudDigitalMembership)
      .innerJoin(customer, eq(cloudDigitalMembership.customerId, customer.id))
      .where(filter.status ? eq(cloudDigitalMembership.status, filter.status) : undefined)
      .orderBy(desc(cloudDigitalMembership.joinedAt))
      .limit(filter.limit);
    return rows.map((row) => ({
      ...row.membership,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
    }));
  }

  public async listBenefits(onlyActive: boolean): Promise<CloudDigitalBenefitRow[]> {
    return this.db.query.cloudDigitalBenefit.findMany({
      where: onlyActive ? eq(cloudDigitalBenefit.isActive, true) : undefined,
      orderBy: [cloudDigitalBenefit.position, cloudDigitalBenefit.title],
    });
  }

  public async upsertBenefit(record: UpsertBenefitRecord): Promise<CloudDigitalBenefitRow> {
    const [row] = await this.db
      .insert(cloudDigitalBenefit)
      .values({ ...record, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: cloudDigitalBenefit.id,
        set: {
          title: record.title,
          description: record.description,
          partner: record.partner,
          discountLabel: record.discountLabel,
          code: record.code,
          url: record.url,
          isActive: record.isActive,
          position: record.position,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row!;
  }
}
