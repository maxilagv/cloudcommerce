import { AdminRole, type Actor, type Permission } from "@cloudcommerce/types";

const roleRank: Record<AdminRole, number> = {
  [AdminRole.OWNER]: 5,
  [AdminRole.ADMIN]: 4,
  [AdminRole.FINANCE]: 3,
  [AdminRole.CATALOG_MANAGER]: 2,
  [AdminRole.SUPPORT]: 1,
};

export const canManageAdminUsers = (actor: Actor): boolean =>
  actor.kind === "admin" && (actor.role === AdminRole.OWNER || actor.role === AdminRole.ADMIN);

export const canAssignRole = (actor: Actor, targetRole: AdminRole, currentTargetRole?: AdminRole): boolean => {
  if (!canManageAdminUsers(actor)) {
    return false;
  }
  if (targetRole === AdminRole.OWNER) {
    return actor.kind === "admin" && actor.role === AdminRole.OWNER;
  }
  if (actor.kind !== "admin" || (roleRank[actor.role] ?? 0) <= (roleRank[targetRole] ?? 0)) {
    return false;
  }
  return currentTargetRole === undefined || (roleRank[actor.role] ?? 0) > (roleRank[currentTargetRole] ?? 0);
};

export const canRevokeSession = (actor: Actor, sessionUserId: string): boolean =>
  actor.kind === "admin" && (actor.userId === sessionUserId || actor.role === AdminRole.OWNER || actor.role === AdminRole.ADMIN);

export const hasPermission = (permissions: Permission[], resource: string, action: string): boolean =>
  permissions.some(
    (permission) =>
      (permission.resource === "*" || permission.resource === resource) &&
      (permission.action === "*" || permission.action === action),
  );
