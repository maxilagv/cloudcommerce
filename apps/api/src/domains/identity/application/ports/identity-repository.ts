import type { AdminRole, Permission } from "@cloudcommerce/types";
import type { AdminSession } from "../../domain/entities/admin-session.js";
import type { AdminUser } from "../../domain/entities/admin-user.js";

export type AccessLogInput = {
  actorId: string | null;
  resourceType: string;
  resourceId: string | null;
  action: string;
  reason: string | null;
  ip: string;
  userAgent: string;
  requestId: string;
};

export type CreateAdminUserInput = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: AdminRole;
};

export type CreateSessionInput = {
  id: string;
  adminUserId: string;
  sessionTokenHash: string;
  refreshTokenHash: string;
  familyId: string;
  deviceLabel: string;
  deviceFingerprintHash: string | null;
  ip: string;
  userAgent: string;
  expiresAt: Date;
};

export type PasswordResetTokenInput = {
  id: string;
  adminUserId: string;
  tokenHash: string;
  expiresAt: Date;
  ip: string;
  userAgent: string;
};

export type PasswordResetTokenRecord = PasswordResetTokenInput & {
  usedAt: Date | null;
  createdAt: Date;
};

export interface IdentityRepository {
  findUserByEmail(email: string): Promise<AdminUser | null>;
  findUserById(id: string): Promise<AdminUser | null>;
  createUser(input: CreateAdminUserInput): Promise<AdminUser>;
  updateUserRole(userId: string, role: AdminRole): Promise<AdminUser | null>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  updateLastLogin(userId: string, date: Date): Promise<void>;
  setMfaSecret(userId: string, secret: string | null, enabled: boolean): Promise<void>;
  listPermissions(role: AdminRole): Promise<Permission[]>;
  createSession(input: CreateSessionInput): Promise<AdminSession>;
  findSessionById(id: string): Promise<AdminSession | null>;
  findSessionByTokenHash(sessionTokenHash: string): Promise<AdminSession | null>;
  findSessionByRefreshHash(refreshTokenHash: string): Promise<AdminSession | null>;
  findSessionByPreviousRefreshHash(previousRefreshTokenHash: string): Promise<AdminSession | null>;
  rotateSession(
    sessionId: string,
    nextSessionTokenHash: string,
    nextRefreshTokenHash: string,
    previousRefreshTokenHash: string,
    expiresAt: Date,
  ): Promise<AdminSession | null>;
  listSessions(userId: string): Promise<AdminSession[]>;
  revokeSession(sessionId: string, revokedAt: Date): Promise<void>;
  revokeAllUserSessions(userId: string, revokedAt: Date): Promise<void>;
  revokeSessionFamily(familyId: string, revokedAt: Date): Promise<void>;
  createPasswordResetToken(input: PasswordResetTokenInput): Promise<void>;
  findPasswordResetToken(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  markPasswordResetTokenUsed(id: string, usedAt: Date): Promise<void>;
  logAccess(input: AccessLogInput): Promise<void>;
}
