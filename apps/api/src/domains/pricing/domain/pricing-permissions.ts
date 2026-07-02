import { AdminRole, type Actor } from "@cloudcommerce/types";

export const canReadPricing = (actor: Actor): boolean => actor.kind === "admin";

export const canViewSensitivePricing = (actor: Actor): boolean =>
  actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.FINANCE].includes(actor.role);

// system: el import de feeds de proveedores registra costo sin sesión admin.
export const canManageSupplierCost = (actor: Actor): boolean =>
  actor.kind === "system" ||
  (actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.FINANCE].includes(actor.role));

export const canManagePricePolicy = (actor: Actor): boolean =>
  actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN].includes(actor.role);
