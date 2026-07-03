import type { AdminSession } from "../../domain/entities/admin-session.js";
import type { AdminUser } from "../../domain/entities/admin-user.js";
import type { adminSession, adminUser } from "@cloudcommerce/database";

type AdminUserRow = typeof adminUser.$inferSelect;
type AdminSessionRow = typeof adminSession.$inferSelect;

export const mapAdminUser = (row: AdminUserRow): AdminUser => ({
  id: row.id,
  email: row.email,
  passwordHash: row.passwordHash,
  fullName: row.fullName,
  role: row.role,
  isActive: row.isActive,
  mfaEnabled: row.mfaEnabled,
  mfaSecretEnc: row.mfaSecretEnc,
  lastLoginAt: row.lastLoginAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const mapAdminSession = (row: AdminSessionRow): AdminSession => ({
  id: row.id,
  adminUserId: row.adminUserId,
  sessionTokenHash: row.sessionTokenHash,
  refreshTokenHash: row.refreshTokenHash,
  previousRefreshTokenHash: row.previousRefreshTokenHash,
  familyId: row.familyId,
  deviceLabel: row.deviceLabel,
  deviceFingerprintHash: row.deviceFingerprintHash,
  ip: row.ip,
  userAgent: row.userAgent,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
