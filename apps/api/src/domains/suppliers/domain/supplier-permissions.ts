import { AdminRole, type Actor } from "@cloudcommerce/types";

export const canViewSuppliers = (actor: Actor): boolean =>
  actor.kind === "system" ||
  (actor.kind === "admin" &&
    [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.FINANCE].includes(actor.role));

export const canManageSuppliers = (actor: Actor): boolean =>
  actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN].includes(actor.role);

export const canConfigureSupplierSecrets = canManageSuppliers;

export const canRunFeeds = (actor: Actor): boolean =>
  actor.kind === "system" ||
  (actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATALOG_MANAGER].includes(actor.role));

export const canMapSupplierProducts = (actor: Actor): boolean =>
  actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATALOG_MANAGER].includes(actor.role);

export const canRetryForward = (actor: Actor): boolean =>
  actor.kind === "system" || (actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN].includes(actor.role));

export const canViewForwardStatus = (actor: Actor): boolean =>
  actor.kind === "system" ||
  (actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.FINANCE].includes(actor.role));
