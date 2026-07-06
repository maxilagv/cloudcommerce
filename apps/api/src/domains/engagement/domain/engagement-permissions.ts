import { AdminRole, type Actor } from "@cloudcommerce/types";

/**
 * El seguimiento inteligente de clientes maneja PII y mensajes salientes:
 * solo el dueño/admin puede operarlo. El actor "system" queda habilitado para
 * los procesos autónomos (workers de follow-up).
 */
export const canUseEngagement = (actor: Actor): boolean =>
  (actor.kind === "admin" && (actor.role === AdminRole.OWNER || actor.role === AdminRole.ADMIN)) ||
  actor.kind === "system";
