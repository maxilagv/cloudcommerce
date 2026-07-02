import { AdminRole, type Actor } from "@cloudcommerce/types";

export const canViewSettings = (actor: Actor): boolean =>
  actor.kind === "admin" && (actor.role === AdminRole.OWNER || actor.role === AdminRole.ADMIN);

export const canManageSettings = canViewSettings;

export const canManageOwnerOnlySetting = (actor: Actor): boolean =>
  actor.kind === "admin" && actor.role === AdminRole.OWNER;

export const canInviteAdminRole = (actor: Actor, targetRole: AdminRole): boolean => {
  if (!canManageSettings(actor)) {
    return false;
  }
  if (targetRole === AdminRole.OWNER) {
    return actor.kind === "admin" && actor.role === AdminRole.OWNER;
  }
  return true;
};

export const canChangeRoleTo = (actor: Actor, targetRole: AdminRole): boolean => {
  if (!canManageSettings(actor)) {
    return false;
  }
  if (targetRole === AdminRole.OWNER) {
    return actor.kind === "admin" && actor.role === AdminRole.OWNER;
  }
  return true;
};
