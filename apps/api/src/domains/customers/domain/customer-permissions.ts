import { AdminRole, type Actor } from "@cloudcommerce/types";

const isAdminActor = (actor: Actor): actor is Extract<Actor, { kind: "admin" }> => actor.kind === "admin";

export const canReadCustomers = (actor: Actor): boolean =>
  isAdminActor(actor) && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPPORT].includes(actor.role);

export const canManageCustomers = (actor: Actor): boolean =>
  isAdminActor(actor) && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPPORT].includes(actor.role);

export const canDeleteCustomers = (actor: Actor): boolean =>
  isAdminActor(actor) && [AdminRole.OWNER, AdminRole.ADMIN].includes(actor.role);

export const canReadCustomerAnalytics = (actor: Actor): boolean =>
  isAdminActor(actor) && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.FINANCE, AdminRole.SUPPORT].includes(actor.role);

export const canViewCustomerInvestment = (actor: Actor): boolean =>
  isAdminActor(actor) && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.FINANCE].includes(actor.role);

export const requiresSensitiveCustomerReason = (actor: Actor): boolean =>
  isAdminActor(actor) && actor.role === AdminRole.SUPPORT;

export const canViewSensitiveCustomerData = (actor: Actor, reason?: string | null): boolean => {
  if (!isAdminActor(actor)) {
    return false;
  }
  if ([AdminRole.OWNER, AdminRole.ADMIN].includes(actor.role)) {
    return true;
  }
  return actor.role === AdminRole.SUPPORT && Boolean(reason?.trim());
};
