import { Badge, type BadgeTone } from "../primitives/badge.js";

/**
 * Centralized enum -> (tone, label) mapping. A new backend status must be added
 * here once; the point of use never decides a color. Keyed by the raw enum value
 * strings from @cloudcommerce/types so this package stays dependency-free.
 */
const STATUS_MAP: Record<string, { tone: BadgeTone; label: string }> = {
  // OrderStatus
  DRAFT: { tone: "muted", label: "Borrador" },
  PENDING_CONFIRMATION: { tone: "warning", label: "Pendiente" },
  CONFIRMED: { tone: "info", label: "Confirmado" },
  PREPARING: { tone: "info", label: "Preparando" },
  READY_TO_SHIP: { tone: "info", label: "Listo para envío" },
  SHIPPED: { tone: "warning", label: "Enviado" },
  DELIVERED: { tone: "success", label: "Entregado" },
  CANCELLED: { tone: "danger", label: "Cancelado" },
  RETURN_REQUESTED: { tone: "danger", label: "Devolución pedida" },
  RETURNED: { tone: "muted", label: "Devuelto" },
  // ProductStatus
  READY_FOR_REVIEW: { tone: "warning", label: "En revisión" },
  PUBLISHED: { tone: "success", label: "Publicado" },
  PAUSED: { tone: "muted", label: "Pausado" },
  ARCHIVED: { tone: "muted", label: "Archivado" },
  // StockStatus
  IN_STOCK: { tone: "success", label: "En stock" },
  SOON: { tone: "warning", label: "Reponiendo" },
  OUT_OF_STOCK: { tone: "danger", label: "Sin stock" },
};

export interface StatusBadgeProps {
  /** Raw enum value from the backend (e.g. "DELIVERED", "PUBLISHED"). */
  status: string;
  /** Override the derived label; falls back to the mapped or raw value. */
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const mapped = STATUS_MAP[status];
  return <Badge tone={mapped?.tone ?? "muted"}>{label ?? mapped?.label ?? status}</Badge>;
}
