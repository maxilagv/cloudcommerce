import { AdminRole } from "@cloudcommerce/types";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const adminRoleEnum = pgEnum("admin_role", [
  AdminRole.OWNER,
  AdminRole.ADMIN,
  AdminRole.CATALOG_MANAGER,
  AdminRole.FINANCE,
  AdminRole.SUPPORT,
]);

export const adminUser = pgTable(
  "admin_user",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: adminRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    mfaSecretEnc: text("mfa_secret_enc"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("admin_user_email_unique").on(sql`lower(${table.email})`),
    roleIdx: index("admin_user_role_idx").on(table.role),
  }),
);

export const adminSession = pgTable(
  "admin_session",
  {
    id: uuid("id").primaryKey(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUser.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    previousRefreshTokenHash: text("previous_refresh_token_hash"),
    familyId: uuid("family_id").notNull(),
    deviceLabel: text("device_label").notNull(),
    deviceFingerprintHash: text("device_fingerprint_hash"),
    ip: text("ip").notNull(),
    userAgent: text("user_agent").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("admin_session_user_idx").on(table.adminUserId),
    familyIdx: index("admin_session_family_idx").on(table.familyId),
    refreshUnique: uniqueIndex("admin_session_refresh_hash_unique").on(table.refreshTokenHash),
    previousRefreshIdx: index("admin_session_previous_refresh_hash_idx").on(table.previousRefreshTokenHash),
  }),
);

export const permissionGrant = pgTable(
  "permission_grant",
  {
    id: uuid("id").primaryKey(),
    role: adminRoleEnum("role").notNull(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
  },
  (table) => ({
    permissionUnique: uniqueIndex("permission_grant_unique").on(table.role, table.resource, table.action),
  }),
);

export const accessLog = pgTable(
  "access_log",
  {
    id: uuid("id").primaryKey(),
    actorId: uuid("actor_id").references(() => adminUser.id, { onDelete: "set null" }),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    action: text("action").notNull(),
    reason: text("reason"),
    ip: text("ip").notNull(),
    userAgent: text("user_agent").notNull(),
    requestId: text("request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actorCreatedIdx: index("access_log_actor_created_idx").on(table.actorId, table.createdAt),
    resourceIdx: index("access_log_resource_idx").on(table.resourceType, table.resourceId),
  }),
);

export const adminPasswordResetToken = pgTable(
  "admin_password_reset_token",
  {
    id: uuid("id").primaryKey(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUser.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ip: text("ip").notNull(),
    userAgent: text("user_agent").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenUnique: uniqueIndex("admin_password_reset_token_hash_unique").on(table.tokenHash),
    userIdx: index("admin_password_reset_user_idx").on(table.adminUserId),
  }),
);

export const adminUserRelations = relations(adminUser, ({ many }) => ({
  sessions: many(adminSession),
  passwordResetTokens: many(adminPasswordResetToken),
}));

export const adminSessionRelations = relations(adminSession, ({ one }) => ({
  adminUser: one(adminUser, {
    fields: [adminSession.adminUserId],
    references: [adminUser.id],
  }),
}));

export const adminPasswordResetTokenRelations = relations(adminPasswordResetToken, ({ one }) => ({
  adminUser: one(adminUser, {
    fields: [adminPasswordResetToken.adminUserId],
    references: [adminUser.id],
  }),
}));
