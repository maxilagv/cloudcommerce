import {
  AdminRole,
  PaymentMethodId,
  ShippingMethod,
  type Actor,
  type FeatureFlag,
  type PaymentMethodConfig,
  type SettingKey,
  type SettingScope,
  type SettingValue,
  type ShippingOptionConfig,
} from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { SettingsService } from "../../application/settings-service.js";
import type {
  AdminUserEntity,
  PersistedSetting,
  RequestAuditContext,
  SecretProbePort,
  SettingsRepository,
  UpsertFeatureFlagRecord,
  UpsertSettingRecord,
} from "../../application/settings-repository.js";

const now = "2026-07-01T00:00:00.000Z";
const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const adminId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const supportId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";

describe("SettingsService", () => {
  it("rejects secrets embedded in setting values", async () => {
    const service = newService();

    const result = await service.updateSetting(
      admin(AdminRole.OWNER, ownerId),
      { key: "store.identity", value: { name: "CloudCommerce", apiKey: "sk_live_secret" } },
      requestContext,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("SETTING_SECRET_NOT_ALLOWED");
    }
  });

  it("requires exactly one active default shipping option", async () => {
    const service = newService();

    const result = await service.updateSetting(
      admin(AdminRole.ADMIN, adminId),
      {
        key: "shipping.options",
        value: [
          shippingOption("standard", false),
          shippingOption("express", false),
        ],
      },
      requestContext,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("SETTINGS_INVARIANT_VIOLATION");
    }
  });

  it("keeps at least one payment method enabled and validates provider secrets before enabling", async () => {
    const repository = new FakeSettingsRepository({
      settings: new Map([
        [
          "payments.methods",
          settingRecord("payments.methods", "business", [
            paymentMethod(PaymentMethodId.EFECTIVO, "offline", true),
            paymentMethod(PaymentMethodId.MERCADOPAGO, "mercadopago", false),
          ]),
        ],
      ]),
    });
    const service = newService({ repository, secrets: new FakeSecretProbe(false) });

    const missingSecret = await service.togglePaymentMethod(
      admin(AdminRole.OWNER, ownerId),
      { id: PaymentMethodId.MERCADOPAGO, isEnabled: true },
      requestContext,
    );
    expect(missingSecret.ok).toBe(false);
    if (!missingSecret.ok) expect(missingSecret.error.type).toBe("CONFIG_SECRET_MISSING");

    const disablingLast = await service.togglePaymentMethod(
      admin(AdminRole.OWNER, ownerId),
      { id: PaymentMethodId.EFECTIVO, isEnabled: false },
      requestContext,
    );
    expect(disablingLast.ok).toBe(false);
    if (!disablingLast.ok) expect(disablingLast.error.type).toBe("SETTINGS_INVARIANT_VIOLATION");
  });

  it("does not allow deactivating the last active OWNER", async () => {
    const service = newService({
      repository: new FakeSettingsRepository({ ownerCountExcludingTarget: 0 }),
    });

    const result = await service.deactivateUser(
      admin(AdminRole.OWNER, ownerId),
      { userId: ownerId, reason: "transferencia pendiente" },
      requestContext,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("SETTINGS_INVARIANT_VIOLATION");
    }
  });

  it("enforces settings permissions in the use case", async () => {
    const service = newService();

    const denied = await service.updateSetting(
      admin(AdminRole.SUPPORT, supportId),
      { key: "store.identity", value: { name: "CloudCommerce" } },
      requestContext,
    );
    const adminOwnerInvite = await service.inviteAdminUser(
      admin(AdminRole.ADMIN, adminId),
      { email: "owner2@example.com", fullName: "Owner Two", role: AdminRole.OWNER },
      requestContext,
    );

    expect(denied.ok).toBe(false);
    expect(adminOwnerInvite.ok).toBe(false);
    if (!denied.ok) expect(denied.error.type).toBe("FORBIDDEN");
    if (!adminOwnerInvite.ok) expect(adminOwnerInvite.error.type).toBe("FORBIDDEN");
  });
});

const newService = (options: { repository?: SettingsRepository; secrets?: SecretProbePort } = {}): SettingsService =>
  new SettingsService(options.repository ?? new FakeSettingsRepository(), options.secrets ?? new FakeSecretProbe(true));

const admin = (role: AdminRole, userId: string): Actor => ({ kind: "admin", userId, role, sessionId: "session" });

const requestContext = {
  ip: "127.0.0.1",
  userAgent: "vitest",
  requestId: "request-id",
};

class FakeSecretProbe implements SecretProbePort {
  public constructor(private readonly available: boolean) {}

  public async hasProviderSecrets(provider: PaymentMethodConfig["provider"]): Promise<boolean> {
    return provider === "offline" ? true : this.available;
  }
}

class FakeSettingsRepository implements SettingsRepository {
  private readonly settings: Map<SettingKey, PersistedSetting>;
  private readonly users: Map<string, AdminUserEntity>;

  public constructor(private readonly options: {
    settings?: Map<SettingKey, PersistedSetting>;
    ownerCountExcludingTarget?: number;
  } = {}) {
    this.settings = options.settings ?? new Map();
    this.users = new Map([
      [ownerId, adminUser(ownerId, AdminRole.OWNER)],
      [adminId, adminUser(adminId, AdminRole.ADMIN)],
      [supportId, adminUser(supportId, AdminRole.SUPPORT)],
    ]);
  }

  public async listSettings(keys: readonly SettingKey[] | null): Promise<PersistedSetting[]> {
    const selected = keys ?? [...this.settings.keys()];
    return selected.flatMap((key) => {
      const row = this.settings.get(key);
      return row ? [row] : [];
    });
  }

  public async getSetting(key: SettingKey): Promise<PersistedSetting | null> {
    return this.settings.get(key) ?? null;
  }

  public async upsertSetting(input: UpsertSettingRecord, _audit: RequestAuditContext): Promise<PersistedSetting> {
    const row = settingRecord(input.key, input.scope, input.value, input.updatedBy);
    this.settings.set(input.key, row);
    return row;
  }

  public async listAdminUsers(): Promise<{ rows: AdminUserEntity[]; nextCursor: string | null }> {
    return { rows: [...this.users.values()], nextCursor: null };
  }

  public async findAdminUserById(userId: string): Promise<AdminUserEntity | null> {
    return this.users.get(userId) ?? null;
  }

  public async findAdminUserByEmail(email: string): Promise<AdminUserEntity | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  public async countActiveOwners(_excludingUserId?: string): Promise<number> {
    return this.options.ownerCountExcludingTarget ?? 1;
  }

  public async createInvitedAdminUser(input: { email: string; fullName: string; role: AdminRole; passwordHash: string }): Promise<AdminUserEntity> {
    const user = adminUser("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", input.role, input.email, input.fullName);
    this.users.set(user.id, user);
    return user;
  }

  public async setAdminUserRole(input: { userId: string; role: AdminRole }): Promise<AdminUserEntity | null> {
    const user = this.users.get(input.userId);
    if (!user) return null;
    const updated = { ...user, role: input.role };
    this.users.set(input.userId, updated);
    return updated;
  }

  public async deactivateAdminUser(input: { userId: string }): Promise<AdminUserEntity | null> {
    const user = this.users.get(input.userId);
    if (!user) return null;
    const updated = { ...user, isActive: false };
    this.users.set(input.userId, updated);
    return updated;
  }

  public async listFeatureFlags(): Promise<FeatureFlag[]> {
    return [];
  }

  public async upsertFeatureFlag(input: UpsertFeatureFlagRecord): Promise<FeatureFlag> {
    return {
      key: input.key,
      enabled: input.enabled,
      owner: input.owner,
      reviewAt: input.reviewAt,
      removalPlan: input.removalPlan,
      description: input.description,
      updatedBy: input.updatedBy,
      updatedAt: now,
      createdAt: now,
    };
  }

  public async toggleFeatureFlag(): Promise<FeatureFlag | null> {
    return null;
  }

  public async recordAudit(): Promise<void> {}
}

const settingRecord = (
  key: SettingKey,
  scope: SettingScope,
  value: SettingValue,
  updatedBy: string | null = null,
): PersistedSetting => ({
  key,
  scope,
  value,
  updatedBy,
  updatedAt: now,
  createdAt: now,
});

const adminUser = (
  id: string,
  role: AdminRole,
  email = `${role.toLowerCase()}@example.com`,
  fullName = `${role} User`,
): AdminUserEntity => ({
  id,
  email,
  fullName,
  role,
  isActive: true,
  mfaEnabled: false,
  lastLoginAt: null,
  createdAt: now,
  updatedAt: now,
});

const shippingOption = (id: string, isDefault: boolean): ShippingOptionConfig => ({
  id,
  method: id === "pickup" ? ShippingMethod.PICKUP : id === "express" ? ShippingMethod.EXPRESS : ShippingMethod.STANDARD,
  label: id,
  detail: id,
  costAmountMinor: 0,
  currency: "ARS",
  isActive: true,
  isDefault,
  position: isDefault ? 0 : 1,
});

const paymentMethod = (
  id: PaymentMethodId,
  provider: PaymentMethodConfig["provider"],
  isEnabled: boolean,
): PaymentMethodConfig => ({
  id,
  label: id,
  provider,
  isEnabled,
  position: 0,
});
