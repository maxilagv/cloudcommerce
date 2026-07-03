export enum AdminRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  CATALOG_MANAGER = "CATALOG_MANAGER",
  FINANCE = "FINANCE",
  SUPPORT = "SUPPORT",
}

export enum AccessLogAction {
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT = "LOGOUT",
  LOGOUT_ALL = "LOGOUT_ALL",
  REFRESH = "REFRESH",
  REFRESH_REUSE_DETECTED = "REFRESH_REUSE_DETECTED",
  PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_COMPLETED = "PASSWORD_RESET_COMPLETED",
  MFA_ENABLED = "MFA_ENABLED",
  MFA_DISABLED = "MFA_DISABLED",
  ADMIN_USER_CREATED = "ADMIN_USER_CREATED",
  ADMIN_ROLE_UPDATED = "ADMIN_ROLE_UPDATED",
  SESSION_REVOKED = "SESSION_REVOKED",
}

export enum ProductStatus {
  DRAFT = "DRAFT",
  READY_FOR_REVIEW = "READY_FOR_REVIEW",
  PUBLISHED = "PUBLISHED",
  PAUSED = "PAUSED",
  ARCHIVED = "ARCHIVED",
}

export enum StockStatus {
  IN_STOCK = "IN_STOCK",
  SOON = "SOON",
  OUT_OF_STOCK = "OUT_OF_STOCK",
}

export enum MediaSource {
  UPLOAD = "upload",
  AI = "ai",
  IMPORT = "import",
}

export enum ReservationStatus {
  ACTIVE = "ACTIVE",
  CONFIRMED = "CONFIRMED",
  RELEASED = "RELEASED",
  EXPIRED = "EXPIRED",
}

export enum StockMovementType {
  IMPORT = "IMPORT",
  SALE = "SALE",
  RETURN = "RETURN",
  ADJUSTMENT = "ADJUSTMENT",
  RESERVATION = "RESERVATION",
  RELEASE = "RELEASE",
}

export enum PricingScope {
  GLOBAL = "global",
  CATEGORY = "category",
  PRODUCT = "product",
}

export enum PricingValueKind {
  PERCENT = "percent",
  FIXED = "fixed",
}

export enum PriceOrigin {
  COMPUTED = "COMPUTED",
  MANUAL = "MANUAL",
}

export enum CustomerTier {
  CloudBase = "CloudBase",
  CloudPlus = "CloudPlus",
  CloudPrime = "CloudPrime",
}

export enum CustomerConsentKind {
  MARKETING_WHATSAPP = "marketing_whatsapp",
  MARKETING_EMAIL = "marketing_email",
  DATA_PROCESSING = "data_processing",
}

export enum CustomerContactChannel {
  CALL = "call",
  WHATSAPP = "whatsapp",
  EMAIL = "email",
  OTHER = "other",
}

export enum CustomerContactDirection {
  IN = "in",
  OUT = "out",
}

// ---------------------------------------------------------------------------
// Orders (Fase 5) — el ciclo de vida de la venta.
// Valores string = nombre del miembro para que el pgEnum sea legible en la DB.
// ---------------------------------------------------------------------------

export enum OrderStatus {
  DRAFT = "DRAFT",
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
  CONFIRMED = "CONFIRMED",
  PREPARING = "PREPARING",
  READY_TO_SHIP = "READY_TO_SHIP",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  RETURN_REQUESTED = "RETURN_REQUESTED",
  RETURNED = "RETURNED",
}

/** Punto de entrada de la orden: checkout del store (futuro) o alta manual del panel (esta fase). */
export enum OrderChannel {
  STORE = "store",
  ADMIN_MANUAL = "admin_manual",
}

export enum CartStatus {
  ACTIVE = "active",
  CONVERTED = "converted",
  ABANDONED = "abandoned",
}

export enum ShipmentStatus {
  CREATED = "CREATED",
  PREPARED = "PREPARED",
  DISPATCHED = "DISPATCHED",
  IN_TRANSIT = "IN_TRANSIT",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  DELAYED = "DELAYED",
  FAILED_ATTEMPT = "FAILED_ATTEMPT",
}

/** Métodos de envío del store (`apps/store/src/lib/constants.ts`). El backend fija el costo. */
export enum ShippingMethod {
  STANDARD = "STANDARD",
  EXPRESS = "EXPRESS",
  PICKUP = "PICKUP",
}

export enum PaymentMethodId {
  VISA = "VISA",
  MASTERCARD = "MASTERCARD",
  AMEX = "AMEX",
  MERCADOPAGO = "MERCADOPAGO",
  MODO = "MODO",
  EFECTIVO = "EFECTIVO",
}

// ---------------------------------------------------------------------------
// Finance (Fase 5) — documentos comerciales.
// ---------------------------------------------------------------------------

export enum DocumentType {
  REMITO = "REMITO",
  FACTURA = "FACTURA",
  NOTA_CREDITO = "NOTA_CREDITO",
}

export enum DocumentStatus {
  PROCESSING = "PROCESSING",
  AVAILABLE = "AVAILABLE",
  VOID = "VOID",
}

// ---------------------------------------------------------------------------
// AI Gateway (Fase 8) — generaciones y alertas de IA.
// ---------------------------------------------------------------------------

export enum AiGenerationKind {
  DESCRIPTION = "DESCRIPTION",
  SPECS = "SPECS",
  SEO = "SEO",
  IMAGE = "IMAGE",
  RECOMMENDATION = "RECOMMENDATION",
  TRENDS = "TRENDS",
  PRICING = "PRICING",
}

export enum AiGenerationStatus {
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  PARTIAL = "PARTIAL",
  DEGRADED = "DEGRADED",
}

export enum AiAlertKind {
  PRICE = "PRICE",
  STOCK = "STOCK",
  TREND = "TREND",
}

export enum AiAlertStatus {
  OPEN = "OPEN",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  RESOLVED = "RESOLVED",
  DISMISSED = "DISMISSED",
}

export enum AiTargetType {
  PRODUCT = "PRODUCT",
  VARIANT = "VARIANT",
  CATEGORY = "CATEGORY",
  SUPPLIER_FEED = "SUPPLIER_FEED",
  NONE = "NONE",
}

// ---------------------------------------------------------------------------
// Suppliers (Fase 9) — motor del dropshipping.
// ---------------------------------------------------------------------------

export enum SupplierFeedKind {
  CSV = "csv",
  API = "api",
}

export enum SupplierFeedStatus {
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  OK = "OK",
  PARTIAL = "PARTIAL",
  FAILED = "FAILED",
  DISABLED = "DISABLED",
}

export enum SupplierSyncStatus {
  LINKED = "LINKED",
  PENDING_REVIEW = "PENDING_REVIEW",
  CONFLICT = "CONFLICT",
  DISCONTINUED = "DISCONTINUED",
}

export enum SupplierForwardStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  FAILED = "FAILED",
}
