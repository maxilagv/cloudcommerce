import { AdminRole, type Actor } from "@cloudcommerce/types";

const privilegedRoles = [AdminRole.OWNER, AdminRole.ADMIN] as const;
const costRoles = [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.FINANCE] as const;
const supportOrderRoles = [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.FINANCE, AdminRole.SUPPORT] as const;

export const canCreateManualOrder = (actor: Actor): boolean =>
  actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPPORT].includes(actor.role);

export const canReadOrders = (actor: Actor): boolean =>
  actor.kind === "admin" && supportOrderRoles.includes(actor.role as (typeof supportOrderRoles)[number]);

export const canViewOrderCost = (actor: Actor): boolean =>
  actor.kind === "admin" && costRoles.includes(actor.role as (typeof costRoles)[number]);

export const canTransitionOrders = (actor: Actor): boolean =>
  actor.kind === "admin" && privilegedRoles.includes(actor.role as (typeof privilegedRoles)[number]);

export const canCancelOrders = (actor: Actor): boolean =>
  actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPPORT].includes(actor.role);

export const canManageShipments = (actor: Actor): boolean =>
  actor.kind === "admin" && privilegedRoles.includes(actor.role as (typeof privilegedRoles)[number]);

export const requiresOrderSensitiveReason = (actor: Actor): boolean =>
  actor.kind === "admin" && actor.role === AdminRole.SUPPORT;
