import { AdminRole, AccessLogAction, type Actor, type AdminProfile, type Permission } from "@cloudcommerce/types";
import type {
  CompletePasswordResetInput,
  CreateAdminUserInput,
  LoginInput,
  RefreshInput,
  RevokeSessionInput,
  StartPasswordResetInput,
  UpdateAdminRoleInput,
} from "@cloudcommerce/validators";
import { hash, verify } from "argon2";
import { addMinutes, addDays } from "date-fns";
import type { Redis } from "ioredis";
import { authenticator } from "otplib";
import type { Logger } from "pino";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { err, ok, type Result } from "../../../../shared/domain/result.js";
import type { IdentityDomainError } from "../../../../shared/errors/domain-error.js";
import type { InMemoryEventBus } from "../../../../shared/events/event-bus.js";
import type { UnitOfWork } from "../../../../infrastructure/database/unit-of-work.js";
import { isSessionActive, type AdminSession } from "../../domain/entities/admin-session.js";
import type { AdminUser } from "../../domain/entities/admin-user.js";
import { canAssignRole, canManageAdminUsers, canRevokeSession } from "../../domain/policies/permissions.js";
import type { IdentityRepository } from "../ports/identity-repository.js";

export type RequestContext = {
  ip: string;
  userAgent: string;
  requestId: string;
  deviceFingerprint?: string;
};

export type AuthenticatedSession = {
  actor: Actor;
  profile: AdminProfile;
  permissions: Permission[];
};

export type LoginResult = AuthenticatedSession & {
  sessionId: string;
  sessionToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export type RefreshResult = {
  sessionId: string;
  sessionToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export type ListedSession = {
  id: string;
  deviceLabel: string;
  ip: string;
  userAgent: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

type IdentityServiceDeps = {
  repository: IdentityRepository;
  cache: Redis;
  unitOfWork: UnitOfWork;
  eventBus: InMemoryEventBus;
  logger: Logger;
  mfaSecretKey: string;
};

const loginLimit = 5;
const loginWindowSeconds = 15 * 60;
const resetLimit = 3;
const resetWindowSeconds = 60 * 60;
const dummyPasswordHash = hash("cloudcommerce-dummy-password", { type: 2 });
const rateLimitScript = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return { count, ttl }
`;

export class IdentityService {
  private readonly repository: IdentityRepository;
  private readonly cache: Redis;
  private readonly unitOfWork: UnitOfWork;
  private readonly eventBus: InMemoryEventBus;
  private readonly logger: Logger;
  private readonly mfaKey: Buffer;

  public constructor(deps: IdentityServiceDeps) {
    this.repository = deps.repository;
    this.cache = deps.cache;
    this.unitOfWork = deps.unitOfWork;
    this.eventBus = deps.eventBus;
    this.logger = deps.logger;
    this.mfaKey = createHash("sha256").update(deps.mfaSecretKey).digest();
  }

  public async login(input: LoginInput, ctx: RequestContext): Promise<Result<LoginResult, IdentityDomainError>> {
    const rateLimit = await this.checkRateLimit(`login:${ctx.ip}:${input.email}`, loginLimit, loginWindowSeconds);
    if (!rateLimit.allowed) {
      return err({ type: "RATE_LIMITED", retryAfterSeconds: rateLimit.retryAfterSeconds });
    }

    const user = await this.repository.findUserByEmail(input.email);
    if (!user || !user.isActive) {
      await verify(await dummyPasswordHash, input.password).catch(() => false);
      await this.logAuthFailure(null, ctx);
      return err({ type: "INVALID_CREDENTIALS" });
    }

    const passwordOk = await verify(user.passwordHash, input.password);
    if (!passwordOk) {
      await this.logAuthFailure(user.id, ctx);
      return err({ type: "INVALID_CREDENTIALS" });
    }

    if (user.mfaEnabled) {
      if (!input.otp) {
        return err({ type: "MFA_REQUIRED" });
      }
      const secret = user.mfaSecretEnc ? this.safeDecrypt(user.mfaSecretEnc) : null;
      if (!secret || !authenticator.check(input.otp, secret)) {
        return err({ type: "INVALID_MFA_CODE" });
      }
    }

    const sessionToken = this.createToken();
    const refreshToken = this.createToken();
    const refreshExpiresAt = addDays(new Date(), 30);
    const session = await this.repository.createSession({
      id: uuidv7(),
      adminUserId: user.id,
      sessionTokenHash: this.hashToken(sessionToken),
      refreshTokenHash: this.hashToken(refreshToken),
      familyId: uuidv7(),
      deviceLabel: this.deviceLabel(ctx.userAgent),
      deviceFingerprintHash: ctx.deviceFingerprint ? this.hashToken(ctx.deviceFingerprint) : null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      expiresAt: refreshExpiresAt,
    });
    await this.repository.updateLastLogin(user.id, new Date());
    await this.repository.logAccess({
      actorId: user.id,
      resourceType: "identity",
      resourceId: session.id,
      action: AccessLogAction.LOGIN_SUCCESS,
      reason: "admin_login",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    const permissions = await this.repository.listPermissions(user.role);
    return ok({
      actor: { kind: "admin", userId: user.id, role: user.role, sessionId: session.id },
      profile: this.toProfile(user),
      permissions,
      sessionId: session.id,
      sessionToken,
      refreshToken,
      refreshExpiresAt,
    });
  }

  public async resolveSession(sessionToken: string | undefined): Promise<Result<AuthenticatedSession, IdentityDomainError>> {
    if (!sessionToken) {
      return err({ type: "UNAUTHENTICATED" });
    }
    const session = await this.repository.findSessionByTokenHash(this.hashToken(sessionToken));
    if (!session || !isSessionActive(session)) {
      return err({ type: "UNAUTHENTICATED" });
    }
    const user = await this.repository.findUserById(session.adminUserId);
    if (!user || !user.isActive) {
      return err({ type: "UNAUTHENTICATED" });
    }
    const permissions = await this.repository.listPermissions(user.role);
    return ok({
      actor: { kind: "admin", userId: user.id, role: user.role, sessionId: session.id },
      profile: this.toProfile(user),
      permissions,
    });
  }

  public async refresh(input: RefreshInput, ctx: RequestContext): Promise<Result<RefreshResult, IdentityDomainError>> {
    if (!input.refreshToken) {
      return err({ type: "UNAUTHENTICATED" });
    }
    const currentHash = this.hashToken(input.refreshToken);
    const session = await this.repository.findSessionByRefreshHash(currentHash);
    if (session && isSessionActive(session)) {
      const nextSessionToken = this.createToken();
      const nextRefreshToken = this.createToken();
      const expiresAt = addDays(new Date(), 30);
      const rotated = await this.repository.rotateSession(session.id, this.hashToken(nextSessionToken), this.hashToken(nextRefreshToken), currentHash, expiresAt);
      if (!rotated) {
        return err({ type: "UNAUTHENTICATED" });
      }
      await this.repository.logAccess({
        actorId: session.adminUserId,
        resourceType: "identity",
        resourceId: session.id,
        action: AccessLogAction.REFRESH,
        reason: "refresh_rotation",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      return ok({ sessionId: session.id, sessionToken: nextSessionToken, refreshToken: nextRefreshToken, refreshExpiresAt: expiresAt });
    }

    const reused = await this.repository.findSessionByPreviousRefreshHash(currentHash);
    if (reused) {
      const now = new Date();
      await this.repository.revokeSessionFamily(reused.familyId, now);
      await this.repository.logAccess({
        actorId: reused.adminUserId,
        resourceType: "identity",
        resourceId: reused.id,
        action: AccessLogAction.REFRESH_REUSE_DETECTED,
        reason: "refresh_reuse_detected",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      return err({ type: "REFRESH_REUSE_DETECTED" });
    }

    return err({ type: "UNAUTHENTICATED" });
  }

  public async logout(actor: Actor, ctx: RequestContext): Promise<Result<{ revoked: true }, IdentityDomainError>> {
    if (actor.kind !== "admin") {
      return err({ type: "UNAUTHENTICATED" });
    }
    await this.repository.revokeSession(actor.sessionId, new Date());
    await this.repository.logAccess({
      actorId: actor.userId,
      resourceType: "identity",
      resourceId: actor.sessionId,
      action: AccessLogAction.LOGOUT,
      reason: "admin_logout",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return ok({ revoked: true });
  }

  public async logoutAll(actor: Actor, ctx: RequestContext): Promise<Result<{ revoked: true }, IdentityDomainError>> {
    if (actor.kind !== "admin") {
      return err({ type: "UNAUTHENTICATED" });
    }
    await this.repository.revokeAllUserSessions(actor.userId, new Date());
    await this.repository.logAccess({
      actorId: actor.userId,
      resourceType: "identity",
      resourceId: actor.userId,
      action: AccessLogAction.LOGOUT_ALL,
      reason: "admin_logout_all",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return ok({ revoked: true });
  }

  public async listSessions(actor: Actor): Promise<Result<ListedSession[], IdentityDomainError>> {
    if (actor.kind !== "admin") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const sessions = await this.repository.listSessions(actor.userId);
    return ok(sessions.map((session) => this.toListedSession(session)));
  }

  public async revokeSession(actor: Actor, input: RevokeSessionInput, ctx: RequestContext): Promise<Result<{ revoked: true }, IdentityDomainError>> {
    const session = await this.repository.findSessionById(input.sessionId);
    if (!session || !canRevokeSession(actor, session.adminUserId)) {
      return err({ type: "FORBIDDEN" });
    }
    await this.repository.revokeSession(input.sessionId, new Date());
    await this.repository.logAccess({
      actorId: actor.kind === "admin" ? actor.userId : null,
      resourceType: "identity",
      resourceId: input.sessionId,
      action: AccessLogAction.SESSION_REVOKED,
      reason: input.reason ?? "session_revoked",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return ok({ revoked: true });
  }

  public async createUser(actor: Actor, input: CreateAdminUserInput, ctx: RequestContext): Promise<Result<AdminProfile, IdentityDomainError>> {
    if (!canManageAdminUsers(actor) || !canAssignRole(actor, input.role)) {
      return err({ type: "FORBIDDEN" });
    }
    const existing = await this.repository.findUserByEmail(input.email);
    if (existing) {
      return err({ type: "USER_ALREADY_EXISTS" });
    }
    let user: AdminUser;
    try {
      user = await this.repository.createUser({
        id: uuidv7(),
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        passwordHash: await hash(input.password, { type: 2 }),
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        return err({ type: "USER_ALREADY_EXISTS" });
      }
      throw error;
    }
    await this.repository.logAccess({
      actorId: actor.kind === "admin" ? actor.userId : null,
      resourceType: "admin_user",
      resourceId: user.id,
      action: AccessLogAction.ADMIN_USER_CREATED,
      reason: "admin_user_created",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return ok(this.toProfile(user));
  }

  public async updateRole(actor: Actor, input: UpdateAdminRoleInput, ctx: RequestContext): Promise<Result<AdminProfile, IdentityDomainError>> {
    const target = await this.repository.findUserById(input.userId);
    if (!target) {
      return err({ type: "USER_NOT_FOUND" });
    }
    if (!canAssignRole(actor, input.role, target.role)) {
      return err({ type: "FORBIDDEN" });
    }
    if (target.role === AdminRole.OWNER) {
      return err({ type: "OWNER_ROLE_IMMUTABLE" });
    }
    const updated = await this.repository.updateUserRole(input.userId, input.role);
    if (!updated) {
      return err({ type: "USER_NOT_FOUND" });
    }
    await this.repository.logAccess({
      actorId: actor.kind === "admin" ? actor.userId : null,
      resourceType: "admin_user",
      resourceId: input.userId,
      action: AccessLogAction.ADMIN_ROLE_UPDATED,
      reason: `role_updated:${target.role}->${input.role}`,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return ok(this.toProfile(updated));
  }

  public async startPasswordReset(input: StartPasswordResetInput, ctx: RequestContext): Promise<Result<{ accepted: true }, IdentityDomainError>> {
    const rateLimit = await this.checkRateLimit(`reset:${ctx.ip}:${input.email}`, resetLimit, resetWindowSeconds);
    if (!rateLimit.allowed) {
      return err({ type: "RATE_LIMITED", retryAfterSeconds: rateLimit.retryAfterSeconds });
    }
    const user = await this.repository.findUserByEmail(input.email);
    if (user && user.isActive) {
      const token = this.createToken();
      await this.repository.createPasswordResetToken({
        id: uuidv7(),
        adminUserId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: addMinutes(new Date(), 15),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      this.logger.info({ requestId: ctx.requestId, userId: user.id }, "Password reset token created");
    }
    await this.repository.logAccess({
      actorId: user?.id ?? null,
      resourceType: "identity",
      resourceId: user?.id ?? null,
      action: AccessLogAction.PASSWORD_RESET_REQUESTED,
      reason: "password_reset_requested",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return ok({ accepted: true });
  }

  public async completePasswordReset(input: CompletePasswordResetInput, ctx: RequestContext): Promise<Result<{ completed: true }, IdentityDomainError>> {
    const tokenHash = this.hashToken(input.token);
    const token = await this.repository.findPasswordResetToken(tokenHash);
    if (!token || token.usedAt || token.expiresAt.getTime() <= Date.now()) {
      return err({ type: "INVALID_RESET_TOKEN" });
    }
    await this.repository.updatePassword(token.adminUserId, await hash(input.newPassword, { type: 2 }));
    await this.repository.markPasswordResetTokenUsed(token.id, new Date());
    await this.repository.revokeAllUserSessions(token.adminUserId, new Date());
    await this.repository.logAccess({
      actorId: token.adminUserId,
      resourceType: "identity",
      resourceId: token.adminUserId,
      action: AccessLogAction.PASSWORD_RESET_COMPLETED,
      reason: "password_reset_completed",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return ok({ completed: true });
  }

  public async enableMfa(actor: Actor): Promise<Result<{ secret: string; otpauthUrl: string }, IdentityDomainError>> {
    if (actor.kind !== "admin") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const user = await this.repository.findUserById(actor.userId);
    if (!user) {
      return err({ type: "USER_NOT_FOUND" });
    }
    const secret = authenticator.generateSecret();
    await this.repository.setMfaSecret(user.id, this.encrypt(secret), false);
    return ok({
      secret,
      otpauthUrl: authenticator.keyuri(user.email, "CloudCommerce Admin", secret),
    });
  }

  public async verifyMfa(actor: Actor, code: string, ctx: RequestContext): Promise<Result<{ enabled: true }, IdentityDomainError>> {
    if (actor.kind !== "admin") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const user = await this.repository.findUserById(actor.userId);
    const secret = user?.mfaSecretEnc ? this.safeDecrypt(user.mfaSecretEnc) : null;
    if (!user || !secret || !authenticator.check(code, secret)) {
      return err({ type: "INVALID_MFA_CODE" });
    }
    await this.repository.setMfaSecret(user.id, user.mfaSecretEnc, true);
    await this.repository.logAccess({
      actorId: actor.userId,
      resourceType: "identity",
      resourceId: actor.userId,
      action: AccessLogAction.MFA_ENABLED,
      reason: "mfa_enabled",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return ok({ enabled: true });
  }

  public async disableMfa(actor: Actor, password: string, code: string, ctx: RequestContext): Promise<Result<{ disabled: true }, IdentityDomainError>> {
    if (actor.kind !== "admin") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const user = await this.repository.findUserById(actor.userId);
    if (!user) {
      return err({ type: "USER_NOT_FOUND" });
    }
    const secret = user.mfaSecretEnc ? this.safeDecrypt(user.mfaSecretEnc) : null;
    if (!(await verify(user.passwordHash, password)) || !secret || !authenticator.check(code, secret)) {
      return err({ type: "INVALID_CREDENTIALS" });
    }
    await this.repository.setMfaSecret(user.id, null, false);
    await this.repository.logAccess({
      actorId: actor.userId,
      resourceType: "identity",
      resourceId: actor.userId,
      action: AccessLogAction.MFA_DISABLED,
      reason: "mfa_disabled",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return ok({ disabled: true });
  }

  private async logAuthFailure(actorId: string | null, ctx: RequestContext): Promise<void> {
    await this.repository.logAccess({
      actorId,
      resourceType: "identity",
      resourceId: actorId,
      action: AccessLogAction.LOGIN_FAILED,
      reason: "invalid_credentials",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }

  private async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
    const [countRaw, ttlRaw] = (await this.cache.eval(rateLimitScript, 1, key, windowSeconds.toString())) as [number, number];
    const count = Number(countRaw);
    const ttl = Number(ttlRaw);
    if (count > limit) {
      return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
    }
    return { allowed: true };
  }

  private toProfile(user: AdminUser): AdminProfile {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }

  private toListedSession(session: AdminSession): ListedSession {
    return {
      id: session.id,
      deviceLabel: session.deviceLabel,
      ip: session.ip,
      userAgent: session.userAgent,
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
    };
  }

  private createToken(): string {
    return randomBytes(48).toString("base64url");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private deviceLabel(userAgent: string): string {
    return userAgent.trim().slice(0, 120) || "Unknown device";
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.mfaKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
  }

  private decrypt(value: string): string {
    const [ivText, tagText, encryptedText] = value.split(".");
    if (!ivText || !tagText || !encryptedText) {
      throw new Error("Invalid encrypted MFA secret");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.mfaKey, Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]);
    return decrypted.toString("utf8");
  }

  private safeDecrypt(value: string): string | null {
    try {
      return this.decrypt(value);
    } catch {
      return null;
    }
  }
}

const isUniqueConstraintViolation = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { code?: unknown; constraint?: unknown };
  return candidate.code === "23505" || candidate.constraint === "admin_user_email_unique";
};
