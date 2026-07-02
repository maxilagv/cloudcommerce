import {
  AdminRole,
  PaymentMethodId,
  ShippingMethod,
  type Actor,
  type AdminInviteResult,
  type AdminUserListResult,
  type AdminUserSummary,
  type FeatureFlag,
  type FeatureFlagListResult,
  type PaymentMethodConfig,
  type SettingKey,
  type SettingRecord,
  type SettingScope,
  type SettingValue,
  type ShippingOptionConfig,
} from "@cloudcommerce/types";
import {
  SETTING_SCHEMAS,
  type DeactivateAdminUserInput,
  type GetSettingsInput,
  type InviteAdminUserInput,
  type ListAdminUsersInput,
  type ListFeatureFlagsInput,
  type ListPaymentMethodsInput,
  type ListShippingOptionsInput,
  type SetAdminUserRoleInput,
  type ToggleFeatureFlagInput,
  type TogglePaymentMethodInput,
  type UpdateSettingInput,
  type UpsertFeatureFlagInput,
  type UpsertShippingOptionInput,
} from "@cloudcommerce/validators";
import { hash } from "argon2";
import { randomBytes } from "node:crypto";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { SettingsDomainError } from "../../../shared/errors/domain-error.js";
import {
  canChangeRoleTo,
  canInviteAdminRole,
  canManageOwnerOnlySetting,
  canManageSettings,
  canViewSettings,
} from "../domain/settings-permissions.js";
import { isOwnerOnlySettingKey, knownSettingKeys, secretLikeFieldNames, settingScopeForKey } from "../domain/settings-keys.js";
import type { PersistedSetting, RequestAuditContext, SecretProbePort, SettingsRepository } from "./settings-repository.js";

type RequestContext = {
  ip: string;
  userAgent: string;
  requestId: string;
  reason?: string | null;
};

export class SettingsService {
  public constructor(
    private readonly repository: SettingsRepository,
    private readonly secrets: SecretProbePort,
  ) {}

  public async getSettings(actor: Actor, input: GetSettingsInput): Promise<Result<SettingRecord[], SettingsDomainError>> {
    if (!canViewSettings(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const keys = input.keys ?? [...knownSettingKeys];
    const persisted = await this.repository.listSettings(keys);
    const byKey = new Map(persisted.map((row) => [row.key, row]));
    const now = new Date().toISOString();
    const settings: SettingRecord[] = [];
    for (const key of keys) {
      const row = byKey.get(key);
      const presented = row ? this.presentSetting(row) : this.defaultSetting(key, now);
      if (presented) {
        settings.push(presented);
      }
    }
    return ok(settings);
  }

  public async updateSetting(
    actor: Actor,
    input: UpdateSettingInput,
    context: RequestContext,
  ): Promise<Result<SettingRecord, SettingsDomainError>> {
    if (!this.canUpdateSetting(actor, input.key)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (containsSecretPayload(input.value)) {
      return err({ type: "SETTING_SECRET_NOT_ALLOWED" });
    }
    const parsed = parseSettingValue(input.key, input.value);
    if (!parsed) {
      return err({ type: "SETTINGS_INVARIANT_VIOLATION", reason: "El valor de configuracion no cumple el schema de la clave." });
    }
    const invariant = await this.validateSettingInvariant(input.key, parsed);
    if (invariant) {
      return err(invariant);
    }
    const saved = await this.repository.upsertSetting(
      {
        key: input.key,
        scope: settingScopeForKey(input.key),
        value: parsed,
        updatedBy: actor.kind === "admin" ? actor.userId : null,
      },
      this.audit(actor, context, input.reason),
    );
    const presented = this.presentSetting(saved);
    return presented ? ok(presented) : err({ type: "UPSTREAM_UNAVAILABLE" });
  }

  public async listShippingOptions(
    actor: Actor,
    input: ListShippingOptionsInput,
  ): Promise<Result<ShippingOptionConfig[], SettingsDomainError>> {
    if (!canViewSettings(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const options = await this.loadShippingOptions();
    const visible = input.includeInactive ? options : options.filter((option) => option.isActive);
    return ok(visible.sort((left, right) => left.position - right.position));
  }

  public async upsertShippingOption(
    actor: Actor,
    input: UpsertShippingOptionInput,
    context: RequestContext,
  ): Promise<Result<ShippingOptionConfig[], SettingsDomainError>> {
    if (!canManageSettings(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const current = await this.loadShippingOptions();
    const incoming = toShippingOption(input);
    const next = current.filter((option) => option.id !== incoming.id);
    if (incoming.isDefault) {
      next.push(incoming);
      const normalized = next.map((option) => option.id === incoming.id ? option : { ...option, isDefault: false });
      const invalid = validateShippingOptions(normalized);
      if (invalid) return err(invalid);
      return this.saveShippingOptions(actor, normalized, context, input.reason);
    }
    next.push(incoming);
    const invalid = validateShippingOptions(next);
    if (invalid) return err(invalid);
    return this.saveShippingOptions(actor, next, context, input.reason);
  }

  public async listPaymentMethods(
    actor: Actor,
    input: ListPaymentMethodsInput,
  ): Promise<Result<PaymentMethodConfig[], SettingsDomainError>> {
    if (!canViewSettings(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const methods = await this.loadPaymentMethods();
    const visible = input.includeDisabled ? methods : methods.filter((method) => method.isEnabled);
    return ok(visible.map(sanitizePaymentMethod).sort((left, right) => left.position - right.position));
  }

  public async togglePaymentMethod(
    actor: Actor,
    input: TogglePaymentMethodInput,
    context: RequestContext,
  ): Promise<Result<PaymentMethodConfig[], SettingsDomainError>> {
    if (!canManageSettings(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const methods = await this.loadPaymentMethods();
    const method = methods.find((item) => item.id === input.id);
    if (!method) {
      return err({ type: "SETTING_NOT_FOUND" });
    }
    if (input.isEnabled && !(await this.secrets.hasProviderSecrets(method.provider))) {
      return err({ type: "CONFIG_SECRET_MISSING", provider: method.provider });
    }
    const next = methods.map((item) => item.id === input.id ? { ...item, isEnabled: input.isEnabled } : item);
    const invalid = validatePaymentMethods(next);
    if (invalid) return err(invalid);
    const saved = await this.repository.upsertSetting(
      {
        key: "payments.methods",
        scope: "business",
        value: next,
        updatedBy: actor.kind === "admin" ? actor.userId : null,
      },
      this.audit(actor, context, input.reason),
    );
    const presented = this.presentSetting(saved);
    if (!presented || presented.key !== "payments.methods" || !Array.isArray(presented.value)) {
      return err({ type: "UPSTREAM_UNAVAILABLE" });
    }
    return ok((presented.value as PaymentMethodConfig[]).map(sanitizePaymentMethod));
  }

  public async listAdminUsers(actor: Actor, input: ListAdminUsersInput): Promise<Result<AdminUserListResult, SettingsDomainError>> {
    if (!canViewSettings(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const result = await this.repository.listAdminUsers(input);
    return ok({ items: result.rows.map(presentAdminUser), nextCursor: result.nextCursor });
  }

  public async inviteAdminUser(
    actor: Actor,
    input: InviteAdminUserInput,
    context: RequestContext,
  ): Promise<Result<AdminInviteResult, SettingsDomainError>> {
    if (!canInviteAdminRole(actor, input.role)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const existing = await this.repository.findAdminUserByEmail(input.email);
    if (existing) {
      return ok({ accepted: true });
    }
    const temporaryPassword = randomBytes(48).toString("base64url");
    await this.repository.createInvitedAdminUser(
      {
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        passwordHash: await hash(temporaryPassword, { type: 2 }),
      },
      this.audit(actor, context, input.reason),
    );
    return ok({ accepted: true });
  }

  public async setUserRole(
    actor: Actor,
    input: SetAdminUserRoleInput,
    context: RequestContext,
  ): Promise<Result<AdminUserSummary, SettingsDomainError>> {
    if (!canChangeRoleTo(actor, input.role)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const target = await this.repository.findAdminUserById(input.userId);
    if (!target) {
      return err({ type: "ADMIN_USER_NOT_FOUND" });
    }
    if (target.role === AdminRole.OWNER && actor.kind === "admin" && actor.role !== AdminRole.OWNER) {
      return err({ type: "FORBIDDEN" });
    }
    if (target.role === AdminRole.OWNER && input.role !== AdminRole.OWNER) {
      const remainingOwners = await this.repository.countActiveOwners(target.id);
      if (remainingOwners === 0) {
        return err({ type: "SETTINGS_INVARIANT_VIOLATION", reason: "Debe existir al menos un OWNER activo." });
      }
    }
    const updated = await this.repository.setAdminUserRole({ userId: input.userId, role: input.role }, this.audit(actor, context, input.reason));
    return updated ? ok(presentAdminUser(updated)) : err({ type: "ADMIN_USER_NOT_FOUND" });
  }

  public async deactivateUser(
    actor: Actor,
    input: DeactivateAdminUserInput,
    context: RequestContext,
  ): Promise<Result<AdminUserSummary, SettingsDomainError>> {
    if (!canManageSettings(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const target = await this.repository.findAdminUserById(input.userId);
    if (!target) {
      return err({ type: "ADMIN_USER_NOT_FOUND" });
    }
    if (target.role === AdminRole.OWNER) {
      const remainingOwners = await this.repository.countActiveOwners(target.id);
      if (remainingOwners === 0) {
        return err({ type: "SETTINGS_INVARIANT_VIOLATION", reason: "No se puede desactivar el ultimo OWNER activo." });
      }
    }
    const updated = await this.repository.deactivateAdminUser({ userId: input.userId }, this.audit(actor, context, input.reason));
    return updated ? ok(presentAdminUser(updated)) : err({ type: "ADMIN_USER_NOT_FOUND" });
  }

  public async listFeatureFlags(
    actor: Actor,
    input: ListFeatureFlagsInput,
  ): Promise<Result<FeatureFlagListResult, SettingsDomainError>> {
    if (!canViewSettings(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    return ok({ items: await this.repository.listFeatureFlags(input) });
  }

  public async toggleFeatureFlag(
    actor: Actor,
    input: ToggleFeatureFlagInput,
    context: RequestContext,
  ): Promise<Result<FeatureFlag, SettingsDomainError>> {
    if (!canManageSettings(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const flag = await this.repository.toggleFeatureFlag(
      { key: input.key, enabled: input.enabled, updatedBy: actor.kind === "admin" ? actor.userId : null },
      this.audit(actor, context, input.reason),
    );
    return flag ? ok(flag) : err({ type: "FEATURE_FLAG_NOT_FOUND" });
  }

  public async upsertFeatureFlag(
    actor: Actor,
    input: UpsertFeatureFlagInput,
    context: RequestContext,
  ): Promise<Result<FeatureFlag, SettingsDomainError>> {
    if (!canManageSettings(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    return ok(
      await this.repository.upsertFeatureFlag(
        {
          key: input.key,
          enabled: input.enabled,
          owner: input.owner,
          reviewAt: input.reviewAt,
          removalPlan: input.removalPlan ?? null,
          description: input.description,
          updatedBy: actor.kind === "admin" ? actor.userId : null,
        },
        this.audit(actor, context, input.reason),
      ),
    );
  }

  private canUpdateSetting(actor: Actor, key: SettingKey): boolean {
    if (isOwnerOnlySettingKey(key)) {
      return canManageOwnerOnlySetting(actor);
    }
    return canManageSettings(actor);
  }

  private async validateSettingInvariant(key: SettingKey, value: SettingValue): Promise<SettingsDomainError | null> {
    if (key === "shipping.options") {
      return validateShippingOptions(value as ShippingOptionConfig[]);
    }
    if (key === "payments.methods") {
      const paymentMethods = value as PaymentMethodConfig[];
      const invalid = validatePaymentMethods(paymentMethods);
      if (invalid) return invalid;
      for (const method of paymentMethods) {
        if (method.isEnabled && !(await this.secrets.hasProviderSecrets(method.provider))) {
          return { type: "CONFIG_SECRET_MISSING", provider: method.provider };
        }
      }
    }
    return null;
  }

  private async loadShippingOptions(): Promise<ShippingOptionConfig[]> {
    const row = await this.repository.getSetting("shipping.options");
    const parsed = row ? this.presentSetting(row) : null;
    return parsed?.key === "shipping.options" && Array.isArray(parsed.value)
      ? parsed.value as ShippingOptionConfig[]
      : defaultShippingOptions;
  }

  private async saveShippingOptions(
    actor: Actor,
    options: ShippingOptionConfig[],
    context: RequestContext,
    reason?: string | null,
  ): Promise<Result<ShippingOptionConfig[], SettingsDomainError>> {
    const saved = await this.repository.upsertSetting(
      {
        key: "shipping.options",
        scope: "public",
        value: options.sort((left, right) => left.position - right.position),
        updatedBy: actor.kind === "admin" ? actor.userId : null,
      },
      this.audit(actor, context, reason),
    );
    const presented = this.presentSetting(saved);
    if (!presented || presented.key !== "shipping.options" || !Array.isArray(presented.value)) {
      return err({ type: "UPSTREAM_UNAVAILABLE" });
    }
    return ok(presented.value as ShippingOptionConfig[]);
  }

  private async loadPaymentMethods(): Promise<PaymentMethodConfig[]> {
    const row = await this.repository.getSetting("payments.methods");
    const parsed = row ? this.presentSetting(row) : null;
    return parsed?.key === "payments.methods" && Array.isArray(parsed.value)
      ? parsed.value as PaymentMethodConfig[]
      : defaultPaymentMethods;
  }

  private presentSetting(row: PersistedSetting): SettingRecord | null {
    const value = parseSettingValue(row.key, row.value);
    if (!value) {
      return null;
    }
    return {
      key: row.key,
      scope: row.scope,
      value: sanitizeSettingValue(row.key, value),
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private defaultSetting(key: SettingKey, now: string): SettingRecord | null {
    const value = defaultSettingValues[key];
    if (!value) {
      return null;
    }
    return { key, scope: settingScopeForKey(key), value: sanitizeSettingValue(key, value), updatedBy: null, updatedAt: now, createdAt: now };
  }

  private audit(actor: Actor, context: RequestContext, reason?: string | null): RequestAuditContext {
    return {
      actorId: actor.kind === "admin" ? actor.userId : null,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      reason: reason ?? context.reason ?? null,
    };
  }
}

const parseSettingValue = (key: SettingKey, value: unknown): SettingValue | null => {
  const parsed = SETTING_SCHEMAS[key].safeParse(value);
  if (!parsed.success) {
    return null;
  }
  if (key === "shipping.options") {
    return (parsed.data as ShippingOptionConfig[]).map(toShippingOption);
  }
  if (key === "payments.methods") {
    return (parsed.data as PaymentMethodConfig[]).map(toPaymentMethod);
  }
  return parsed.data as SettingValue;
};

const sanitizeSettingValue = (key: SettingKey, value: SettingValue): SettingValue => {
  if (key !== "payments.methods") {
    return value;
  }
  return (value as PaymentMethodConfig[]).map(sanitizePaymentMethod);
};

const validateShippingOptions = (options: ShippingOptionConfig[]): SettingsDomainError | null => {
  if (options.length === 0) {
    return { type: "SETTINGS_INVARIANT_VIOLATION", reason: "Debe existir al menos una opcion de envio." };
  }
  const activeDefaultCount = options.filter((option) => option.isActive && option.isDefault).length;
  if (activeDefaultCount !== 1) {
    return { type: "SETTINGS_INVARIANT_VIOLATION", reason: "Debe existir exactamente un envio default activo." };
  }
  return null;
};

const validatePaymentMethods = (methods: PaymentMethodConfig[]): SettingsDomainError | null => {
  if (!methods.some((method) => method.isEnabled)) {
    return { type: "SETTINGS_INVARIANT_VIOLATION", reason: "Debe existir al menos un metodo de pago habilitado." };
  }
  return null;
};

const containsSecretPayload = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some(containsSecretPayload);
  }
  if (!value || typeof value !== "object") {
    return typeof value === "string" && /(?:sk_live_|sk_test_|xoxb-|-----BEGIN)/i.test(value);
  }
  for (const [key, nested] of Object.entries(value)) {
    if (key !== "credentialsRef" && secretLikeFieldNames.has(key)) {
      return true;
    }
    if (containsSecretPayload(nested)) {
      return true;
    }
  }
  return false;
};

const toShippingOption = (input: ShippingOptionConfig): ShippingOptionConfig => ({
  id: input.id,
  method: input.method,
  label: input.label,
  detail: input.detail,
  costAmountMinor: input.costAmountMinor,
  currency: "ARS",
  isActive: input.isActive,
  isDefault: input.isDefault,
  position: input.position,
});

const toPaymentMethod = (input: PaymentMethodConfig): PaymentMethodConfig => {
  const base: PaymentMethodConfig = {
    id: input.id,
    label: input.label,
    provider: input.provider,
    isEnabled: input.isEnabled,
    position: input.position,
  };
  if (input.credentialsRef !== undefined) base.credentialsRef = input.credentialsRef;
  if (input.surchargePct !== undefined) base.surchargePct = input.surchargePct;
  if (input.installmentsMax !== undefined) base.installmentsMax = input.installmentsMax;
  return base;
};

const sanitizePaymentMethod = (input: PaymentMethodConfig): PaymentMethodConfig => {
  const base = toPaymentMethod(input);
  const { credentialsRef: _credentialsRef, ...safe } = base;
  return safe;
};

const presentAdminUser = (user: AdminUserSummary): AdminUserSummary => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  isActive: user.isActive,
  mfaEnabled: user.mfaEnabled,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const defaultShippingOptions: ShippingOptionConfig[] = [
  {
    id: "standard",
    method: ShippingMethod.STANDARD,
    label: "Envio estandar",
    detail: "Llega en 3 a 5 dias habiles",
    costAmountMinor: 0,
    currency: "ARS",
    isActive: true,
    isDefault: true,
    position: 0,
  },
  {
    id: "express",
    method: ShippingMethod.EXPRESS,
    label: "Envio express",
    detail: "Llega en 24 a 48 horas",
    costAmountMinor: 24_900,
    currency: "ARS",
    isActive: true,
    isDefault: false,
    position: 1,
  },
  {
    id: "pickup",
    method: ShippingMethod.PICKUP,
    label: "Retiro coordinado",
    detail: "Listo para coordinar en 2 horas",
    costAmountMinor: 0,
    currency: "ARS",
    isActive: true,
    isDefault: false,
    position: 2,
  },
];

const defaultPaymentMethods: PaymentMethodConfig[] = [
  { id: PaymentMethodId.VISA, label: "Visa", provider: "stripe", isEnabled: true, position: 0, credentialsRef: "sm://payments/stripe", installmentsMax: 12 },
  { id: PaymentMethodId.MASTERCARD, label: "Mastercard", provider: "stripe", isEnabled: true, position: 1, credentialsRef: "sm://payments/stripe", installmentsMax: 12 },
  { id: PaymentMethodId.AMEX, label: "American Express", provider: "stripe", isEnabled: true, position: 2, credentialsRef: "sm://payments/stripe", installmentsMax: 6 },
  { id: PaymentMethodId.MERCADOPAGO, label: "MercadoPago", provider: "mercadopago", isEnabled: false, position: 3, credentialsRef: "sm://payments/mercadopago" },
  { id: PaymentMethodId.MODO, label: "MODO", provider: "modo", isEnabled: false, position: 4, credentialsRef: "sm://payments/modo" },
  { id: PaymentMethodId.EFECTIVO, label: "Efectivo", provider: "offline", isEnabled: true, position: 5 },
];

const defaultSettingValues: Record<SettingKey, SettingValue> = {
  "store.identity": { name: "CloudCommerce" },
  "store.currency": { base: "ARS", display: "es-AR", rounding: "nearest_100" },
  "store.billing": { legalName: "CloudCommerce", cuit: "30-00000000-0", ivaCondition: "Responsable Inscripto", fiscalAddress: "Buenos Aires, AR" },
  "store.legal.terms": { markdown: "Terminos y condiciones pendientes de configurar.", version: "draft", updatedAt: "2026-07-01T00:00:00.000Z" },
  "store.legal.privacy": { markdown: "Politica de privacidad pendiente de configurar.", version: "draft", updatedAt: "2026-07-01T00:00:00.000Z" },
  "store.social": {},
  "shipping.options": defaultShippingOptions,
  "shipping.coverage": {
    provinces: ["Ciudad Autonoma de Buenos Aires", "Buenos Aires", "Cordoba", "Santa Fe", "Mendoza"],
    cities: ["Buenos Aires, AR", "Cordoba, AR", "Rosario, AR", "Mendoza, AR", "La Plata, AR"],
    defaultCity: "Buenos Aires, AR",
  },
  "payments.methods": defaultPaymentMethods,
  "checkout.policy": { allowGuest: true },
};
