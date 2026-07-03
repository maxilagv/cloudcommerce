import {
  accessLog,
  adminPasswordResetToken,
  adminSession,
  adminUser,
  permissionGrant,
} from "@cloudcommerce/database";
import type { AdminRole, Permission } from "@cloudcommerce/types";
import { and, eq, isNull } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import type { AdminSession } from "../../domain/entities/admin-session.js";
import type { AdminUser } from "../../domain/entities/admin-user.js";
import { mapAdminSession, mapAdminUser } from "../mappers/identity-mapper.js";
import type {
  AccessLogInput,
  CreateAdminUserInput,
  CreateSessionInput,
  IdentityRepository,
  PasswordResetTokenInput,
  PasswordResetTokenRecord,
} from "../../application/ports/identity-repository.js";

export class DrizzleIdentityRepository implements IdentityRepository {
  public constructor(private readonly db: Database) {}

  public async findUserByEmail(email: string): Promise<AdminUser | null> {
    const row = await this.db.query.adminUser.findFirst({ where: eq(adminUser.email, email.toLowerCase()) });
    return row ? mapAdminUser(row) : null;
  }

  public async findUserById(id: string): Promise<AdminUser | null> {
    const row = await this.db.query.adminUser.findFirst({ where: eq(adminUser.id, id) });
    return row ? mapAdminUser(row) : null;
  }

  public async createUser(input: CreateAdminUserInput): Promise<AdminUser> {
    const [row] = await this.db.insert(adminUser).values(input).returning();
    if (!row) {
      throw new Error("Failed to create admin user");
    }
    return mapAdminUser(row);
  }

  public async updateUserRole(userId: string, role: AdminRole): Promise<AdminUser | null> {
    const [row] = await this.db
      .update(adminUser)
      .set({ role, updatedAt: new Date() })
      .where(eq(adminUser.id, userId))
      .returning();
    return row ? mapAdminUser(row) : null;
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.db.update(adminUser).set({ passwordHash, updatedAt: new Date() }).where(eq(adminUser.id, userId));
  }

  public async updateLastLogin(userId: string, date: Date): Promise<void> {
    await this.db.update(adminUser).set({ lastLoginAt: date, updatedAt: date }).where(eq(adminUser.id, userId));
  }

  public async setMfaSecret(userId: string, secret: string | null, enabled: boolean): Promise<void> {
    await this.db.update(adminUser).set({ mfaSecretEnc: secret, mfaEnabled: enabled, updatedAt: new Date() }).where(eq(adminUser.id, userId));
  }

  public async listPermissions(role: AdminRole): Promise<Permission[]> {
    const rows = await this.db.select().from(permissionGrant).where(eq(permissionGrant.role, role));
    return rows.map((row) => ({ resource: row.resource, action: row.action }));
  }

  public async createSession(input: CreateSessionInput): Promise<AdminSession> {
    const [row] = await this.db.insert(adminSession).values(input).returning();
    if (!row) {
      throw new Error("Failed to create admin session");
    }
    return mapAdminSession(row);
  }

  public async findSessionById(id: string): Promise<AdminSession | null> {
    const row = await this.db.query.adminSession.findFirst({ where: eq(adminSession.id, id) });
    return row ? mapAdminSession(row) : null;
  }

  public async findSessionByTokenHash(sessionTokenHash: string): Promise<AdminSession | null> {
    const row = await this.db.query.adminSession.findFirst({ where: eq(adminSession.sessionTokenHash, sessionTokenHash) });
    return row ? mapAdminSession(row) : null;
  }

  public async findSessionByRefreshHash(refreshTokenHash: string): Promise<AdminSession | null> {
    const row = await this.db.query.adminSession.findFirst({ where: eq(adminSession.refreshTokenHash, refreshTokenHash) });
    return row ? mapAdminSession(row) : null;
  }

  public async findSessionByPreviousRefreshHash(previousRefreshTokenHash: string): Promise<AdminSession | null> {
    const row = await this.db.query.adminSession.findFirst({
      where: eq(adminSession.previousRefreshTokenHash, previousRefreshTokenHash),
    });
    return row ? mapAdminSession(row) : null;
  }

  public async rotateSession(
    sessionId: string,
    nextSessionTokenHash: string,
    nextRefreshTokenHash: string,
    previousRefreshTokenHash: string,
    expiresAt: Date,
  ): Promise<AdminSession | null> {
    const [row] = await this.db
      .update(adminSession)
      .set({
        sessionTokenHash: nextSessionTokenHash,
        refreshTokenHash: nextRefreshTokenHash,
        previousRefreshTokenHash,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(and(eq(adminSession.id, sessionId), isNull(adminSession.revokedAt)))
      .returning();
    return row ? mapAdminSession(row) : null;
  }

  public async listSessions(userId: string): Promise<AdminSession[]> {
    const rows = await this.db.select().from(adminSession).where(eq(adminSession.adminUserId, userId));
    return rows.map(mapAdminSession);
  }

  public async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    await this.db.update(adminSession).set({ revokedAt, updatedAt: revokedAt }).where(eq(adminSession.id, sessionId));
  }

  public async revokeAllUserSessions(userId: string, revokedAt: Date): Promise<void> {
    await this.db.update(adminSession).set({ revokedAt, updatedAt: revokedAt }).where(eq(adminSession.adminUserId, userId));
  }

  public async revokeSessionFamily(familyId: string, revokedAt: Date): Promise<void> {
    await this.db.update(adminSession).set({ revokedAt, updatedAt: revokedAt }).where(eq(adminSession.familyId, familyId));
  }

  public async createPasswordResetToken(input: PasswordResetTokenInput): Promise<void> {
    await this.db.insert(adminPasswordResetToken).values(input);
  }

  public async findPasswordResetToken(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    const row = await this.db.query.adminPasswordResetToken.findFirst({
      where: eq(adminPasswordResetToken.tokenHash, tokenHash),
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      adminUserId: row.adminUserId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      ip: row.ip,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    };
  }

  public async markPasswordResetTokenUsed(id: string, usedAt: Date): Promise<void> {
    await this.db.update(adminPasswordResetToken).set({ usedAt }).where(eq(adminPasswordResetToken.id, id));
  }

  public async logAccess(input: AccessLogInput): Promise<void> {
    await this.db.insert(accessLog).values({ id: uuidv7(), ...input });
  }
}
