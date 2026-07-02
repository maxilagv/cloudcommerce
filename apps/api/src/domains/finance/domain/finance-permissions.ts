import { AdminRole, type Actor } from "@cloudcommerce/types";

const financeRoles = [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.FINANCE] as const;
const documentReadRoles = [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.FINANCE, AdminRole.SUPPORT] as const;

export const canManageFinance = (actor: Actor): boolean =>
  actor.kind === "admin" && financeRoles.includes(actor.role as (typeof financeRoles)[number]);

export const canReadFinanceDocuments = (actor: Actor): boolean =>
  actor.kind === "admin" && documentReadRoles.includes(actor.role as (typeof documentReadRoles)[number]);

export const canViewMargin = (actor: Actor): boolean =>
  actor.kind === "admin" && financeRoles.includes(actor.role as (typeof financeRoles)[number]);

export const requiresDocumentReason = (actor: Actor): boolean =>
  actor.kind === "admin" && actor.role === AdminRole.SUPPORT;
