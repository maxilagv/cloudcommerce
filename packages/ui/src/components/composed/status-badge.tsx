import { Badge, type BadgeTone } from "../primitives/badge";

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
  // ShipmentStatus
  CREATED: { tone: "info", label: "Creado" },
  PREPARED: { tone: "info", label: "Preparado" },
  DISPATCHED: { tone: "info", label: "Despachado" },
  IN_TRANSIT: { tone: "info", label: "En transito" },
  OUT_FOR_DELIVERY: { tone: "warning", label: "En reparto" },
  DELAYED: { tone: "warning", label: "Demorado" },
  FAILED_ATTEMPT: { tone: "danger", label: "Intento fallido" },
  // ProductStatus
  READY_FOR_REVIEW: { tone: "warning", label: "En revisión" },
  PUBLISHED: { tone: "success", label: "Publicado" },
  PAUSED: { tone: "muted", label: "Pausado" },
  ARCHIVED: { tone: "muted", label: "Archivado" },
  // StockStatus
  IN_STOCK: { tone: "success", label: "En stock" },
  SOON: { tone: "warning", label: "Reponiendo" },
  OUT_OF_STOCK: { tone: "danger", label: "Sin stock" },
  // DocumentStatus
  AVAILABLE: { tone: "success", label: "Disponible" },
  PROCESSING: { tone: "info", label: "Procesando" },
  VOID: { tone: "muted", label: "Anulado" },
  // SupplierFeedStatus
  IDLE: { tone: "muted", label: "En espera" },
  RUNNING: { tone: "info", label: "Ejecutando" },
  OK: { tone: "success", label: "OK" },
  PARTIAL: { tone: "warning", label: "Parcial" },
  FAILED: { tone: "danger", label: "Fallido" },
  DISABLED: { tone: "muted", label: "Deshabilitado" },
  // SupplierSyncStatus
  LINKED: { tone: "success", label: "Vinculado" },
  PENDING_REVIEW: { tone: "warning", label: "A revisar" },
  CONFLICT: { tone: "danger", label: "Conflicto" },
  DISCONTINUED: { tone: "muted", label: "Discontinuado" },
  // SupplierForwardStatus
  PENDING: { tone: "warning", label: "Pendiente" },
  SENT: { tone: "info", label: "Enviado" },
  ACCEPTED: { tone: "success", label: "Aceptado" },
  REJECTED: { tone: "danger", label: "Rechazado" },
  // AiGenerationStatus
  QUEUED: { tone: "info", label: "En cola" },
  SUCCEEDED: { tone: "success", label: "Completado" },
  DEGRADED: { tone: "warning", label: "Degradado" },
  // AiAlertStatus
  OPEN: { tone: "warning", label: "Abierta" },
  ACKNOWLEDGED: { tone: "info", label: "Reconocida" },
  RESOLVED: { tone: "success", label: "Resuelta" },
  DISMISSED: { tone: "muted", label: "Descartada" },
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
