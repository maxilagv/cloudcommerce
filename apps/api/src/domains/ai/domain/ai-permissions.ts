import { AdminRole, type Actor } from "@cloudcommerce/types";

export const canUseAiContent = (actor: Actor): boolean =>
  actor.kind === "admin" &&
  (actor.role === AdminRole.OWNER || actor.role === AdminRole.ADMIN || actor.role === AdminRole.CATALOG_MANAGER);

export const canUseAiTrends = (actor: Actor): boolean =>
  (actor.kind === "admin" && (actor.role === AdminRole.OWNER || actor.role === AdminRole.ADMIN)) ||
  actor.kind === "system";

export const canOptimizePricing = (actor: Actor): boolean =>
  actor.kind === "admin" &&
  (actor.role === AdminRole.OWNER || actor.role === AdminRole.ADMIN || actor.role === AdminRole.FINANCE);

export const canViewAiUsage = (actor: Actor): boolean =>
  actor.kind === "admin" && (actor.role === AdminRole.OWNER || actor.role === AdminRole.ADMIN);

export const canManageAiAlerts = (actor: Actor): boolean =>
  actor.kind === "admin" && (actor.role === AdminRole.OWNER || actor.role === AdminRole.ADMIN);

export const canViewSupplierCost = (actor: Actor): boolean =>
  actor.kind === "admin" &&
  (actor.role === AdminRole.OWNER || actor.role === AdminRole.ADMIN || actor.role === AdminRole.FINANCE);
