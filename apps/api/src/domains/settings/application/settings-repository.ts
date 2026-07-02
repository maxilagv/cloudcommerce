import type {
  AdminRole,
  AdminUserSummary,
  FeatureFlag,
  PaymentMethodConfig,
  SettingKey,
  SettingRecord,
  SettingScope,
  SettingValue,
} from "@cloudcommerce/types";
import type { ListAdminUsersInput, ListFeatureFlagsInput } from "@cloudcommerce/validators";

export type RequestAuditContext = {
  actorId: string | null;
  ip: string;
  userAgent: string;
  requestId: string;
  reason?: string | null;
};

export type PersistedSetting = Omit<SettingRecord, "value"> & {
  value: unknown;
};

export type AdminUserEntity = AdminUserSummary;

export type UpsertSettingRecord = {
  key: SettingKey;
  scope: SettingScope;
  value: SettingValue;
  updatedBy: string | null;
};

export type UpsertFeatureFlagRecord = {
  key: string;
  enabled: boolean;
  owner: string;
  reviewAt: string;
  removalPlan: string | null;
  description: string;
  updatedBy: string | null;
};

export type SettingsRepository = {
  listSettings(keys: readonly SettingKey[] | null): Promise<PersistedSetting[]>;
  getSetting(key: SettingKey): Promise<PersistedSetting | null>;
  upsertSetting(input: UpsertSettingRecord, audit: RequestAuditContext): Promise<PersistedSetting>;
  listAdminUsers(input: ListAdminUsersInput): Promise<{ rows: AdminUserEntity[]; nextCursor: string | null }>;
  findAdminUserById(userId: string): Promise<AdminUserEntity | null>;
  findAdminUserByEmail(email: string): Promise<AdminUserEntity | null>;
  countActiveOwners(excludingUserId?: string): Promise<number>;
  createInvitedAdminUser(input: { email: string; fullName: string; role: AdminRole; passwordHash: string }, audit: RequestAuditContext): Promise<AdminUserEntity>;
  setAdminUserRole(input: { userId: string; role: AdminRole }, audit: RequestAuditContext): Promise<AdminUserEntity | null>;
  deactivateAdminUser(input: { userId: string }, audit: RequestAuditContext): Promise<AdminUserEntity | null>;
  listFeatureFlags(input: ListFeatureFlagsInput): Promise<FeatureFlag[]>;
  upsertFeatureFlag(input: UpsertFeatureFlagRecord, audit: RequestAuditContext): Promise<FeatureFlag>;
  toggleFeatureFlag(input: { key: string; enabled: boolean; updatedBy: string | null }, audit: RequestAuditContext): Promise<FeatureFlag | null>;
  recordAudit(input: {
    action: string;
    resourceType: string;
    resourceId: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  }, audit: RequestAuditContext): Promise<void>;
};

export type SecretProbePort = {
  hasProviderSecrets(provider: PaymentMethodConfig["provider"]): Promise<boolean>;
};
