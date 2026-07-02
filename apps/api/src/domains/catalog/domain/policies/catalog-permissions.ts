import { AdminRole, type Actor } from "@cloudcommerce/types";

const catalogWriteRoles = new Set<AdminRole>([AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATALOG_MANAGER]);

export const canReadCatalog = (actor: Actor): boolean => actor.kind === "admin";

export const canWriteCatalog = (actor: Actor): boolean => actor.kind === "admin" && catalogWriteRoles.has(actor.role);

export const canPublishCatalog = (actor: Actor): boolean => canWriteCatalog(actor);
