import { AdminRole, type Actor } from "@cloudcommerce/types";

export const canReadInventory = (actor: Actor): boolean => actor.kind === "admin";

// system: el import de feeds de proveedores ajusta stock sin sesión admin.
export const canManageInventory = (actor: Actor): boolean =>
  actor.kind === "system" ||
  (actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATALOG_MANAGER].includes(actor.role));

export const canUseReservationWorkflow = (actor: Actor): boolean =>
  actor.kind === "system" || (actor.kind === "admin" && [AdminRole.OWNER, AdminRole.ADMIN].includes(actor.role));
