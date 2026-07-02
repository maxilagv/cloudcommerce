import { adminSession, adminUser, auditLog, featureFlag, outboxEvent, setting, type JsonValue } from "@cloudcommerce/database";
import { AdminRole, type FeatureFlag, type SettingKey, type SettingScope, type SettingValue } from "@cloudcommerce/types";
import type { ListAdminUsersInput, ListFeatureFlagsInput } from "@cloudcommerce/validators";
import { and, desc, eq, ilike, inArray, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  AdminUserEntity,
  PersistedSetting,
  RequestAuditContext,
  SettingsRepository,
  UpsertFeatureFlagRecord,
  UpsertSettingRecord,
} from "../../application/settings-repository.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

type AdminCursor = {
  createdAt: Date;
  id: string;
};

export class DrizzleSettingsRepository implements SettingsRepository {
  public constructor(private readonly db: Database) {}

  public async listSettings(keys: readonly SettingKey[] | null): Promise<PersistedSetting[]> {
    const rows = keys && keys.length > 0
      ? await this.db.select().from(setting).where(inArray(setting.key, [...keys]))
      : await this.db.select().from(setting);
    return rows.map(mapSetting);
  }

  public async getSetting(key: SettingKey): Promise<PersistedSetting | null> {
    const row = await this.db.query.setting.findFirst({ where: eq(setting.key, key) });
    return row ? mapSetting(row) : null;
  }

  public async upsertSetting(input: UpsertSettingRecord, audit: RequestAuditContext): Promise<PersistedSetting> {
    const id = await this.db.transaction(async (tx) => {
      const before = await tx.query.setting.findFirst({ where: eq(setting.key, input.key) });
      const now = new Date();
      const value = toJson(input.value);
      const [row] = before
        ? await tx
            .update(setting)
            .set({ value, scope: input.scope, updatedBy: input.updatedBy, updatedAt: now })
            .where(eq(setting.key, input.key))
            .returning()
        : await tx
            .insert(setting)
            .values({
              id: uuidv7(),
              key: input.key,
              value,
              scope: input.scope,
              updatedBy: input.updatedBy,
              updatedAt: now,
              createdAt: now,
            })
            .returning();
      if (!row) {
        throw new Error("Failed to upsert setting");
      }
      await this.insertAudit(tx, audit, {
        action: "setting.update",
        resourceType: "setting",
        resourceId: input.key,
        before: before ? { value: before.value, scope: before.scope } : null,
        after: { value: input.value, scope: input.scope },
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "settings",
        aggregateId: input.key,
        eventType: "SettingChanged",
        payload: { key: input.key, scope: input.scope },
      });
      return row.id;
    });
    const saved = await this.db.query.setting.findFirst({ where: eq(setting.id, id) });
    if (!saved) {
      throw new Error("Updated setting could not be loaded");
    }
    return mapSetting(saved);
  }

  public async listAdminUsers(input: ListAdminUsersInput): Promise<{ rows: AdminUserEntity[]; nextCursor: string | null }> {
    const conditions: SQL[] = [];
    if (input.role !== undefined) conditions.push(eq(adminUser.role, input.role));
    if (input.isActive !== undefined) conditions.push(eq(adminUser.isActive, input.isActive));
    if (input.search !== undefined) {
      const search = `%${input.search}%`;
      conditions.push(or(ilike(adminUser.email, search), ilike(adminUser.fullName, search)) ?? sql`false`);
    }
    const cursor = decodeCursor(input.cursor);
    if (cursor) {
      conditions.push(
        or(lt(adminUser.createdAt, cursor.createdAt), and(eq(adminUser.createdAt, cursor.createdAt), lt(adminUser.id, cursor.id))) ?? sql`false`,
      );
    }
    const query = this.db
      .select()
      .from(adminUser)
      .$dynamic()
      .orderBy(desc(adminUser.createdAt), desc(adminUser.id))
      .limit(input.limit + 1);
    const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
    const visibleRows = rows.slice(0, input.limit).map(mapAdminUser);
    const last = visibleRows[visibleRows.length - 1];
    return {
      rows: visibleRows,
      nextCursor: rows.length > input.limit && last ? encodeCursor(last) : null,
    };
  }

  public async findAdminUserById(userId: string): Promise<AdminUserEntity | null> {
    const row = await this.db.query.adminUser.findFirst({ where: eq(adminUser.id, userId) });
    return row ? mapAdminUser(row) : null;
  }

  public async findAdminUserByEmail(email: string): Promise<AdminUserEntity | null> {
    const row = await this.db.query.adminUser.findFirst({ where: sql`lower(${adminUser.email}) = ${email.toLowerCase()}` });
    return row ? mapAdminUser(row) : null;
  }

  public async countActiveOwners(excludingUserId?: string): Promise<number> {
    const conditions: SQL[] = [eq(adminUser.role, AdminRole.OWNER), eq(adminUser.isActive, true)];
    if (excludingUserId !== undefined) {
      conditions.push(ne(adminUser.id, excludingUserId));
    }
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminUser)
      .where(and(...conditions));
    return row?.count ?? 0;
  }

  public async createInvitedAdminUser(
    input: { email: string; fullName: string; role: AdminRole; passwordHash: string },
    audit: RequestAuditContext,
  ): Promise<AdminUserEntity> {
    const row = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(adminUser)
        .values({
          id: uuidv7(),
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          passwordHash: input.passwordHash,
          isActive: true,
        })
        .returning();
      if (!created) {
        throw new Error("Failed to create invited admin user");
      }
      await this.insertAudit(tx, audit, {
        action: "admin.invite",
        resourceType: "admin_user",
        resourceId: created.id,
        before: null,
        after: { email: input.email, role: input.role },
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "identity",
        aggregateId: created.id,
        eventType: "AdminUserInvited",
        payload: { userId: created.id, role: input.role },
      });
      return created;
    });
    return mapAdminUser(row);
  }

  public async setAdminUserRole(input: { userId: string; role: AdminRole }, audit: RequestAuditContext): Promise<AdminUserEntity | null> {
    const updatedId = await this.db.transaction(async (tx) => {
      const before = await tx.query.adminUser.findFirst({ where: eq(adminUser.id, input.userId) });
      if (!before) {
        return null;
      }
      const now = new Date();
      const [updated] = await tx
        .update(adminUser)
        .set({ role: input.role, updatedAt: now })
        .where(eq(adminUser.id, input.userId))
        .returning();
      if (!updated) {
        return null;
      }
      await tx.update(adminSession).set({ revokedAt: now, updatedAt: now }).where(eq(adminSession.adminUserId, input.userId));
      await this.insertAudit(tx, audit, {
        action: "admin.role.update",
        resourceType: "admin_user",
        resourceId: input.userId,
        before: { role: before.role },
        after: { role: input.role },
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "identity",
        aggregateId: input.userId,
        eventType: "AdminRoleChanged",
        payload: { userId: input.userId, fromRole: before.role, toRole: input.role },
      });
      return updated.id;
    });
    return updatedId ? this.findAdminUserById(updatedId) : null;
  }

  public async deactivateAdminUser(input: { userId: string }, audit: RequestAuditContext): Promise<AdminUserEntity | null> {
    const updatedId = await this.db.transaction(async (tx) => {
      const before = await tx.query.adminUser.findFirst({ where: eq(adminUser.id, input.userId) });
      if (!before) {
        return null;
      }
      const now = new Date();
      const [updated] = await tx
        .update(adminUser)
        .set({ isActive: false, updatedAt: now })
        .where(eq(adminUser.id, input.userId))
        .returning();
      if (!updated) {
        return null;
      }
      await tx.update(adminSession).set({ revokedAt: now, updatedAt: now }).where(eq(adminSession.adminUserId, input.userId));
      await this.insertAudit(tx, audit, {
        action: "admin.deactivate",
        resourceType: "admin_user",
        resourceId: input.userId,
        before: { isActive: before.isActive },
        after: { isActive: false },
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "identity",
        aggregateId: input.userId,
        eventType: "AdminUserDeactivated",
        payload: { userId: input.userId },
      });
      return updated.id;
    });
    return updatedId ? this.findAdminUserById(updatedId) : null;
  }

  public async listFeatureFlags(input: ListFeatureFlagsInput): Promise<FeatureFlag[]> {
    const conditions: SQL[] = [];
    if (input.enabled !== undefined) conditions.push(eq(featureFlag.enabled, input.enabled));
    if (input.owner !== undefined) conditions.push(ilike(featureFlag.owner, `%${input.owner}%`));
    const rows = conditions.length > 0
      ? await this.db.select().from(featureFlag).where(and(...conditions)).orderBy(desc(featureFlag.updatedAt))
      : await this.db.select().from(featureFlag).orderBy(desc(featureFlag.updatedAt));
    return rows.map(mapFeatureFlag);
  }

  public async upsertFeatureFlag(input: UpsertFeatureFlagRecord, audit: RequestAuditContext): Promise<FeatureFlag> {
    const rowId = await this.db.transaction(async (tx) => {
      const before = await tx.query.featureFlag.findFirst({ where: eq(featureFlag.key, input.key) });
      const now = new Date();
      const [row] = before
        ? await tx
            .update(featureFlag)
            .set({
              enabled: input.enabled,
              owner: input.owner,
              reviewAt: input.reviewAt,
              removalPlan: input.removalPlan,
              description: input.description,
              updatedBy: input.updatedBy,
              updatedAt: now,
            })
            .where(eq(featureFlag.key, input.key))
            .returning()
        : await tx
            .insert(featureFlag)
            .values({
              id: uuidv7(),
              key: input.key,
              enabled: input.enabled,
              owner: input.owner,
              reviewAt: input.reviewAt,
              removalPlan: input.removalPlan,
              description: input.description,
              updatedBy: input.updatedBy,
              updatedAt: now,
              createdAt: now,
            })
            .returning();
      if (!row) {
        throw new Error("Failed to upsert feature flag");
      }
      await this.insertAudit(tx, audit, {
        action: "feature_flag.upsert",
        resourceType: "feature_flag",
        resourceId: input.key,
        before: before ? { enabled: before.enabled, owner: before.owner, reviewAt: before.reviewAt } : null,
        after: { enabled: input.enabled, owner: input.owner, reviewAt: input.reviewAt },
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "settings",
        aggregateId: input.key,
        eventType: "FeatureFlagChanged",
        payload: { key: input.key, enabled: input.enabled },
      });
      return row.id;
    });
    const row = await this.db.query.featureFlag.findFirst({ where: eq(featureFlag.id, rowId) });
    if (!row) {
      throw new Error("Updated feature flag could not be loaded");
    }
    return mapFeatureFlag(row);
  }

  public async toggleFeatureFlag(
    input: { key: string; enabled: boolean; updatedBy: string | null },
    audit: RequestAuditContext,
  ): Promise<FeatureFlag | null> {
    const rowId = await this.db.transaction(async (tx) => {
      const before = await tx.query.featureFlag.findFirst({ where: eq(featureFlag.key, input.key) });
      if (!before) {
        return null;
      }
      const now = new Date();
      const [row] = await tx
        .update(featureFlag)
        .set({ enabled: input.enabled, updatedBy: input.updatedBy, updatedAt: now })
        .where(eq(featureFlag.key, input.key))
        .returning();
      if (!row) {
        return null;
      }
      await this.insertAudit(tx, audit, {
        action: "feature_flag.toggle",
        resourceType: "feature_flag",
        resourceId: input.key,
        before: { enabled: before.enabled },
        after: { enabled: input.enabled },
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "settings",
        aggregateId: input.key,
        eventType: "FeatureFlagChanged",
        payload: { key: input.key, enabled: input.enabled },
      });
      return row.id;
    });
    if (!rowId) {
      return null;
    }
    const row = await this.db.query.featureFlag.findFirst({ where: eq(featureFlag.id, rowId) });
    return row ? mapFeatureFlag(row) : null;
  }

  public async recordAudit(
    input: {
      action: string;
      resourceType: string;
      resourceId: string;
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
    },
    audit: RequestAuditContext,
  ): Promise<void> {
    await this.insertAudit(this.db, audit, input);
  }

  private async insertAudit(
    tx: Tx | Database,
    audit: RequestAuditContext,
    input: {
      action: string;
      resourceType: string;
      resourceId: string;
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
    },
  ): Promise<void> {
    await tx.insert(auditLog).values({
      id: uuidv7(),
      actorId: audit.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      before: input.before,
      after: input.after,
      ip: audit.ip,
      userAgent: audit.userAgent,
      requestId: audit.requestId,
      reason: audit.reason ?? null,
    });
  }
}

const mapSetting = (row: typeof setting.$inferSelect): PersistedSetting => ({
  key: row.key as SettingKey,
  scope: row.scope as SettingScope,
  value: row.value,
  updatedBy: row.updatedBy,
  updatedAt: row.updatedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});

const mapAdminUser = (row: typeof adminUser.$inferSelect): AdminUserEntity => ({
  id: row.id,
  email: row.email,
  fullName: row.fullName,
  role: row.role,
  isActive: row.isActive,
  mfaEnabled: row.mfaEnabled,
  lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const mapFeatureFlag = (row: typeof featureFlag.$inferSelect) => ({
  key: row.key,
  enabled: row.enabled,
  owner: row.owner,
  reviewAt: row.reviewAt,
  removalPlan: row.removalPlan,
  description: row.description,
  updatedBy: row.updatedBy,
  updatedAt: row.updatedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});

const toJson = (value: SettingValue): JsonValue => value as JsonValue;

const encodeCursor = (row: AdminUserEntity): string =>
  Buffer.from(JSON.stringify({ createdAt: row.createdAt, id: row.id })).toString("base64url");

const decodeCursor = (cursor: string | undefined): AdminCursor | null => {
  if (!cursor) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const value = parsed as { createdAt?: unknown; id?: unknown };
    if (typeof value.createdAt !== "string" || typeof value.id !== "string") {
      return null;
    }
    const createdAt = new Date(value.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }
    return { createdAt, id: value.id };
  } catch {
    return null;
  }
};
