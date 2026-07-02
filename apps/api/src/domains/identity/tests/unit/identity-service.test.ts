import { AdminRole } from "@cloudcommerce/types";
import type { LoginInput } from "@cloudcommerce/validators";
import { hash } from "argon2";
import type { Redis } from "ioredis";
import pino from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { v7 as uuidv7 } from "uuid";
import type { UnitOfWork } from "../../../../infrastructure/database/unit-of-work.js";
import { InMemoryEventBus } from "../../../../shared/events/event-bus.js";
import type { AdminSession } from "../../domain/entities/admin-session.js";
import type { AdminUser } from "../../domain/entities/admin-user.js";
import { IdentityService, type RequestContext } from "../../application/services/identity-service.js";
import type {
  AccessLogInput,
  CreateAdminUserInput,
  CreateSessionInput,
  IdentityRepository,
  PasswordResetTokenInput,
  PasswordResetTokenRecord,
} from "../../application/ports/identity-repository.js";

class FakeRedis {
  private readonly counts = new Map<string, number>();
  private readonly expiries = new Map<string, number>();

  public async incr(key: string): Promise<number> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }

  public async expire(key: string, seconds: number): Promise<number> {
    this.expiries.set(key, seconds);
    return 1;
  }

  public async ttl(key: string): Promise<number> {
    return this.expiries.get(key) ?? -1;
  }
}

class FakeIdentityRepository implements IdentityRepository {
  public readonly users = new Map<string, AdminUser>();
  public readonly sessions = new Map<string, AdminSession>();
  public readonly resetTokens = new Map<string, PasswordResetTokenRecord>();
  public readonly accessLogs: AccessLogInput[] = [];

  public async findUserByEmail(email: string): Promise<AdminUser | null> {
    return [...this.users.values()].find((user) => user.email === email.toLowerCase()) ?? null;
  }

  public async findUserById(id: string): Promise<AdminUser | null> {
    return this.users.get(id) ?? null;
  }

  public async createUser(input: CreateAdminUserInput): Promise<AdminUser> {
    const now = new Date();
    const user: AdminUser = {
      ...input,
      isActive: true,
      mfaEnabled: false,
      mfaSecretEnc: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  public async updateUserRole(userId: string, role: AdminRole): Promise<AdminUser | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }
    const updated = { ...user, role, updatedAt: new Date() };
    this.users.set(userId, updated);
    return updated;
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, { ...user, passwordHash, updatedAt: new Date() });
    }
  }

  public async updateLastLogin(userId: string, date: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, { ...user, lastLoginAt: date, updatedAt: date });
    }
  }

  public async setMfaSecret(userId: string, secret: string | null, enabled: boolean): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, { ...user, mfaSecretEnc: secret, mfaEnabled: enabled, updatedAt: new Date() });
    }
  }

  public async listPermissions(role: AdminRole): Promise<Array<{ resource: string; action: string }>> {
    return role === AdminRole.OWNER || role === AdminRole.ADMIN
      ? [{ resource: "*", action: "*" }]
      : [{ resource: "catalog", action: "read" }];
  }

  public async createSession(input: CreateSessionInput): Promise<AdminSession> {
    const now = new Date();
    const session: AdminSession = {
      ...input,
      previousRefreshTokenHash: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  public async findSessionById(id: string): Promise<AdminSession | null> {
    return this.sessions.get(id) ?? null;
  }

  public async findSessionByRefreshHash(refreshTokenHash: string): Promise<AdminSession | null> {
    return [...this.sessions.values()].find((session) => session.refreshTokenHash === refreshTokenHash) ?? null;
  }

  public async findSessionByPreviousRefreshHash(previousRefreshTokenHash: string): Promise<AdminSession | null> {
    return [...this.sessions.values()].find((session) => session.previousRefreshTokenHash === previousRefreshTokenHash) ?? null;
  }

  public async rotateSession(
    sessionId: string,
    nextRefreshTokenHash: string,
    previousRefreshTokenHash: string,
    expiresAt: Date,
  ): Promise<AdminSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.revokedAt) {
      return null;
    }
    const updated = {
      ...session,
      refreshTokenHash: nextRefreshTokenHash,
      previousRefreshTokenHash,
      expiresAt,
      updatedAt: new Date(),
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  public async listSessions(userId: string): Promise<AdminSession[]> {
    return [...this.sessions.values()].filter((session) => session.adminUserId === userId);
  }

  public async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.set(sessionId, { ...session, revokedAt, updatedAt: revokedAt });
    }
  }

  public async revokeAllUserSessions(userId: string, revokedAt: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.adminUserId === userId) {
        this.sessions.set(session.id, { ...session, revokedAt, updatedAt: revokedAt });
      }
    }
  }

  public async revokeSessionFamily(familyId: string, revokedAt: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.familyId === familyId) {
        this.sessions.set(session.id, { ...session, revokedAt, updatedAt: revokedAt });
      }
    }
  }

  public async createPasswordResetToken(input: PasswordResetTokenInput): Promise<void> {
    this.resetTokens.set(input.tokenHash, { ...input, usedAt: null, createdAt: new Date() });
  }

  public async findPasswordResetToken(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    return this.resetTokens.get(tokenHash) ?? null;
  }

  public async markPasswordResetTokenUsed(id: string, usedAt: Date): Promise<void> {
    for (const [key, token] of this.resetTokens.entries()) {
      if (token.id === id) {
        this.resetTokens.set(key, { ...token, usedAt });
      }
    }
  }

  public async logAccess(input: AccessLogInput): Promise<void> {
    this.accessLogs.push(input);
  }
}

const context: RequestContext = {
  ip: "127.0.0.1",
  userAgent: "vitest",
  requestId: "req_test",
  deviceFingerprint: "device-12345678",
};

const loginInput: LoginInput = {
  email: "owner@cloudcommerce.local",
  password: "OwnerPassword123",
  deviceFingerprint: "device-12345678",
};

describe("IdentityService", () => {
  let repository: FakeIdentityRepository;
  let service: IdentityService;
  let owner: AdminUser;

  beforeEach(async () => {
    repository = new FakeIdentityRepository();
    owner = await repository.createUser({
      id: uuidv7(),
      email: "owner@cloudcommerce.local",
      fullName: "Owner",
      role: AdminRole.OWNER,
      passwordHash: await hash("OwnerPassword123", { type: 2 }),
    });
    service = new IdentityService({
      repository,
      cache: new FakeRedis() as unknown as Redis,
      unitOfWork: {} as unknown as UnitOfWork,
      eventBus: new InMemoryEventBus(),
      logger: pino({ level: "silent" }),
      mfaSecretKey: "test-secret-test-secret-test-secret-1234",
    });
  });

  it("logs in with valid owner credentials and returns profile plus permissions", async () => {
    const result = await service.login(loginInput, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.profile.email).toBe("owner@cloudcommerce.local");
      expect(result.value.actor.kind).toBe("admin");
      expect(result.value.permissions).toContainEqual({ resource: "*", action: "*" });
      expect(result.value.refreshToken.length).toBeGreaterThan(32);
    }
  });

  it("rejects invalid credentials without exposing whether the email exists", async () => {
    const result = await service.login({ ...loginInput, password: "WrongPassword123" }, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INVALID_CREDENTIALS");
    }
  });

  it("rejects unauthenticated use cases", async () => {
    const result = await service.logout({ kind: "public" }, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("UNAUTHENTICATED");
    }
  });

  it("rejects admin user creation for a role without permission", async () => {
    const result = await service.createUser(
      { kind: "admin", userId: owner.id, role: AdminRole.CATALOG_MANAGER, sessionId: uuidv7() },
      {
        email: "staff@cloudcommerce.local",
        fullName: "Staff",
        role: AdminRole.SUPPORT,
        password: "StaffPassword123",
      },
      context,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("FORBIDDEN");
    }
  });

  it("rate limits repeated login attempts by ip email and device fingerprint", async () => {
    for (let index = 0; index < 5; index += 1) {
      await service.login({ ...loginInput, password: "WrongPassword123" }, context);
    }

    const result = await service.login({ ...loginInput, password: "WrongPassword123" }, context);

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.type === "RATE_LIMITED") {
      expect(result.error.retryAfterSeconds).toBeGreaterThan(0);
    } else {
      expect.unreachable("Expected RATE_LIMITED");
    }
  });

  it("revokes the refresh token family when an already rotated token is reused", async () => {
    const login = await service.login(loginInput, context);
    expect(login.ok).toBe(true);
    if (!login.ok) {
      return;
    }

    const firstRefresh = await service.refresh({ refreshToken: login.value.refreshToken }, context);
    expect(firstRefresh.ok).toBe(true);

    const reuse = await service.refresh({ refreshToken: login.value.refreshToken }, context);
    expect(reuse.ok).toBe(false);
    if (!reuse.ok) {
      expect(reuse.error.type).toBe("REFRESH_REUSE_DETECTED");
    }

    const storedSession = repository.sessions.get(login.value.sessionId);
    expect(storedSession?.revokedAt).toBeInstanceOf(Date);
  });
});
